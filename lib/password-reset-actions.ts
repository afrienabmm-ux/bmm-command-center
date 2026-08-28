"use server";

import { supabaseAdmin } from "./supabase-server";
import { sendEmail } from "./email";
import { logActivity } from "./activity-log";

const OTP_TTL_MINUTES = 10;

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Same 6-digit-code-by-email pattern already used for services card
// verification (cc_email_otps) — reused here rather than a separate table,
// since it's already exactly "send a code to this address, check it back".
export async function requestPasswordResetAction(email: string): Promise<{ error: string } | { sent: true }> {
  const trimmed = normalizeEmail(email);
  if (!trimmed || !trimmed.includes("@")) return { error: "Enter a valid email address." };

  const { data: profile } = await supabaseAdmin.from("cc_user_profiles").select("id").eq("email", trimmed).maybeSingle();
  // Same "sent" response whether or not an account exists for this email —
  // otherwise this screen could be used to check which addresses are
  // registered staff accounts.
  if (!profile) return { sent: true };

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin.from("cc_email_otps").insert({ email: trimmed, code, expires_at: expiresAt });
  if (error) return { error: error.message };

  const result = await sendEmail({
    to: trimmed,
    subject: "Reset your BMM After-Sales password",
    html: `<p>Your password reset code is <strong style="font-size:20px;letter-spacing:2px;">${code}</strong></p><p>It expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can safely ignore this email.</p>`,
  });
  if ("error" in result) return { error: "Couldn't send the reset email. Please try again." };
  return { sent: true };
}

export async function resetPasswordWithCodeAction(
  email: string,
  code: string,
  newPassword: string
): Promise<{ error: string } | { success: true }> {
  const trimmed = normalizeEmail(email);
  const enteredCode = code.trim();
  if (!enteredCode) return { error: "Enter the code from your email." };
  if (newPassword.length < 8) return { error: "New password must be at least 8 characters." };

  const { data, error } = await supabaseAdmin
    .from("cc_email_otps")
    .select("id, code, expires_at")
    .eq("email", trimmed)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No code was sent to this email. Request a new one." };

  const row = data[0];
  if (new Date(row.expires_at) < new Date()) return { error: "This code has expired. Request a new one." };
  if (row.code !== enteredCode) return { error: "Incorrect code — please try again." };

  const { data: profile } = await supabaseAdmin.from("cc_user_profiles").select("id, name").eq("email", trimmed).maybeSingle();
  if (!profile) return { error: "No account found for that email." };

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, { password: newPassword });
  if (updateError) return { error: updateError.message };

  await supabaseAdmin.from("cc_email_otps").update({ verified: true }).eq("id", row.id);
  await logActivity(
    { id: profile.id, name: profile.name ?? "", email: trimmed },
    "Reset own password (forgot password)"
  );
  return { success: true };
}
