import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587/25
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Sends an email via the configured SMTP transport.
 * Throws if SMTP is not configured or sending fails - callers should catch
 * and decide whether to surface the error to the user.
 */
export async function sendMail({ to, subject, html, text }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env');
  }

  const mailer = getTransporter();

  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

export async function sendPasswordResetEmail(toEmail, resetUrl) {
  const subject = 'Reset your Alraziq-Cloud password';
  const text = `We received a request to reset your password.\n\nReset your password using this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`;
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#0066FF;">Alraziq-Cloud</h2>
      <p>We received a request to reset your password.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block; padding:12px 24px; background:#0066FF; color:#fff; text-decoration:none; border-radius:8px; font-weight:600;">
          Reset Password
        </a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break:break-all; color:#0066FF;">${resetUrl}</p>
      <p style="color:#94A3B8; font-size:0.85rem;">This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  await sendMail({ to: toEmail, subject, text, html });
}
