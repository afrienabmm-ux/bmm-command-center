import nodemailer from "nodemailer";

// Shared Gmail SMTP sender (free, via an app password) — used for both
// membership OTP codes and promo blasts, so there's one place that knows
// how to actually send an email.
let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  cachedTransporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  return cachedTransporter;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  // Inline images — referenced in `html` as <img src="cid:THIS_CID">
  // instead of an external URL, so they display without depending on any
  // link staying valid after the email is sent.
  attachments?: { filename: string; content: Buffer; cid: string }[];
}): Promise<{ error: string } | { sent: true }> {
  const transporter = getTransporter();
  if (!transporter) return { error: "Email sending isn't set up yet." };
  try {
    await transporter.sendMail({
      from: `BMM Membership <${process.env.GMAIL_USER}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    });
  } catch {
    return { error: "Couldn't send the email." };
  }
  return { sent: true };
}
