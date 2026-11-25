"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAuthClient } from "./supabase-auth-server";
import { supabaseAdmin } from "./supabase-server";
import { logActivity } from "./activity-log";
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE } from "./auth-cookie";

export type AuthResult = { error: string } | { needsEmailConfirmation: true } | void;

// Cloudflare robot check: the login, sign-up and change-password boxes send a
// one-time token; Supabase checks it once Bot Protection is on there.
function robotOption(token: unknown) {
  const t = String(token ?? "").trim();
  return t ? { captchaToken: t } : {};
}
const ROBOT_FAILED = "The robot check didn't go through. Wait for the Cloudflare box to finish, then try again. If it keeps failing, refresh the page.";
function isRobotError(error: { code?: string; message?: string }) {
  return error.code === "captcha_failed" || /captcha/i.test(error.message ?? "");
}

export async function signUpAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();

  if (!email || !password) return { error: "Enter an email and password." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (!name) return { error: "Enter your name." };

  // Branch and position aren't picked here — a Manager assigns both when
  // approving the account, from the Team page.
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name }, ...robotOption(formData.get("captchaToken")) },
  });

  if (error) return { error: isRobotError(error) ? ROBOT_FAILED : error.message };
  if (data.user) await logActivity({ id: data.user.id, name, email }, "Signed up");
  if (!data.session) return { needsEmailConfirmation: true };

  redirect("/");
}

export async function signInAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "");
  const rememberMe = formData.get("rememberMe") === "on";

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createAuthClient(rememberMe);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: robotOption(formData.get("captchaToken")),
  });

  if (error && isRobotError(error)) return { error: ROBOT_FAILED };
  if (error) return { error: "Incorrect email or password." };

  // A plain marker cookie, not a secret — just tells middleware (on every
  // later request, when it refreshes the Supabase session) whether to keep
  // stretching this session's cookies to 30 days or let them behave as a
  // normal session cookie. Cleared on an unchecked login so a previous
  // "remember me" choice on this device doesn't linger.
  const cookieStore = await cookies();
  if (rememberMe) {
    cookieStore.set(REMEMBER_ME_COOKIE, "1", {
      maxAge: REMEMBER_ME_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  } else {
    cookieStore.delete(REMEMBER_ME_COOKIE);
  }

  if (data.user) {
    const { data: profile } = await supabaseAdmin
      .from("cc_user_profiles")
      .select("name")
      .eq("id", data.user.id)
      .single();
    await logActivity({ id: data.user.id, name: profile?.name ?? "", email }, "Logged in");
  }

  // Only ever redirect to a path within this app (starts with a single
  // "/", not "//") — a "next" value is attacker-controllable via the URL,
  // and an unchecked redirect could otherwise send a freshly-authenticated
  // session off to an external site.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  // Tags the landing page with a one-time flag so AppShell can greet the
  // person by name right after signing in, then strips it from the URL.
  redirect(`${target}${target.includes("?") ? "&" : "?"}welcome=1`);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) {
    const { data: profile } = await supabaseAdmin.from("cc_user_profiles").select("name").eq("id", user.id).single();
    await logActivity({ id: user.id, name: profile?.name ?? "", email: user.email }, "Logged out");
  }
  await supabase.auth.signOut();
  (await cookies()).delete(REMEMBER_ME_COOKIE);
  redirect("/login");
}

// Self-service password change — re-verifies the current password via a
// real sign-in attempt before allowing the change, so someone who walks up
// to an already-logged-in session can't silently take it over.
export async function changeOwnPasswordAction(
  currentPassword: string,
  newPassword: string,
  captchaToken?: string | null
): Promise<{ error: string } | void> {
  if (newPassword.length < 8) return { error: "New password must be at least 8 characters." };

  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Your session has expired — please sign in again." };

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
    options: robotOption(captchaToken),
  });
  if (verifyError && isRobotError(verifyError)) return { error: ROBOT_FAILED };
  if (verifyError) return { error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  const { data: profile } = await supabaseAdmin.from("cc_user_profiles").select("name").eq("id", user.id).single();
  await logActivity({ id: user.id, name: profile?.name ?? "", email: user.email }, "Changed own password");
}
