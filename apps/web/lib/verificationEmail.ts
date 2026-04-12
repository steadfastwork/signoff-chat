import { Resend } from "resend";
import { render } from "@react-email/render";
import VerificationEmail from "@/emails/VerificationEmail";

/**
 * Send an email verification link to the user.
 * `to` must be the plaintext email address — it is never persisted here.
 */
export async function sendVerificationEmail({
  to,
  screenname,
  verificationToken,
}: {
  to: string;
  screenname: string;
  verificationToken: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "noreply@signoff.chat";
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  if (!apiKey) {
    // Dev: log the link so you can click it without a real email provider.
    const verificationUrl = `${appUrl}/api/auth/verify-email?token=${verificationToken}`;
    console.info(`[verificationEmail] DEV — verify URL for ${screenname}: ${verificationUrl}`);
    return;
  }

  const verificationUrl = `${appUrl}/api/auth/verify-email?token=${verificationToken}`;
  const html = await render(VerificationEmail({ screenname, verificationUrl }));

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Verify your Signoff Chat email",
    html,
  });

  if (error) {
    console.error("[verificationEmail] Resend error:", error);
    throw new Error("Failed to send verification email");
  }
}
