"use server";

import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase-auth-server";

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
  if (!data.session) return { needsEmailConfirmation: true };

  redirect("/");
}

export async function signInAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: "Incorrect email or password." };

  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
