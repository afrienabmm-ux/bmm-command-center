"use server";

import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase-auth-server";
import { supabaseAdmin } from "./supabase-server";
import { logActivity } from "./activity-log";

export type AuthResult = { error: string } | { needsEmailConfirmation: true } | void;

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
    options: { data: { name } },
  });

  if (error) return { error: error.message };
  if (data.user) await logActivity({ id: data.user.id, name, email }, "Signed up");
  if (!data.session) return { needsEmailConfirmation: true };

  redirect("/");
}

export async function signInAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "");

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: "Incorrect email or password." };

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
  redirect("/login");
}

// Self-service password change — re-verifies the current password via a
// real sign-in attempt before allowing the change, so someone who walks up
// to an already-logged-in session can't silently take it over.
export async function changeOwnPasswordAction(
  currentPassword: string,
  newPassword: string
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
  });
  if (verifyError) return { error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  const { data: profile } = await supabaseAdmin.from("cc_user_profiles").select("name").eq("id", user.id).single();
  await logActivity({ id: user.id, name: profile?.name ?? "", email: user.email }, "Changed own password");
}
