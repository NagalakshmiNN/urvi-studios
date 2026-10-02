"use server";

import { db, schema } from "@/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";
import { SITE } from "@/lib/site-config";
import crypto from "crypto";

export type ForgotState = { error?: string; success?: boolean } | undefined;
export type ResetState = { error?: string; success?: boolean } | undefined;

export async function forgotPasswordAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return { error: "Please enter your email address." };

  // Always show success message to prevent email enumeration
  const customer = await db.query.customers.findFirst({ where: eq(schema.customers.email, email) });
  if (!customer) return { success: true };

  // Generate a secure token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(schema.passwordResetTokens).values({
    customerId: customer.id,
    token,
    expiresAt,
  });

  const resetUrl = `${SITE.siteUrl}/account/reset-password?token=${token}`;

  try {
    await sendMail({
      to: email,
      subject: "Reset your Urvi Studios password",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #3F4827;">Reset your password</h2>
          <p>Hi ${customer.name},</p>
          <p>We received a request to reset your Urvi Studios password. Click the button below to choose a new one:</p>
          <p style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="background: #3F4827; color: #F7F0E4; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-weight: 600;">
              Reset Password
            </a>
          </p>
          <p style="font-size: 13px; color: #666;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    return { error: "Could not send the reset email right now. Please try again shortly." };
  }

  return { success: true };
}

export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!token) return { error: "Invalid reset link." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const record = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(schema.passwordResetTokens.token, token),
      gt(schema.passwordResetTokens.expiresAt, new Date()),
      isNull(schema.passwordResetTokens.usedAt)
    ),
  });

  if (!record) return { error: "This reset link has expired or already been used. Please request a new one." };

  const passwordHash = await hashPassword(password);
  await db.update(schema.customers).set({ passwordHash }).where(eq(schema.customers.id, record.customerId));
  await db.update(schema.passwordResetTokens).set({ usedAt: new Date() }).where(eq(schema.passwordResetTokens.id, record.id));

  return { success: true };
}
