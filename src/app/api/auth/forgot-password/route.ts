// app/api/auth/forgot-password/route.ts
import { NextResponse } from "next/server";
// import { db } from "@/lib/db"; // adjust to your db import
// import { users } from "@/lib/schema"; // adjust
// import { passwordResetTokens } from "@/lib/schema"; // adjust
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import crypto from "crypto";
import { db } from "@/db";
import { passwordResetTokens } from "@/db/schema";
import { users } from "drizzle/schema";

const resend = new Resend(process.env.RESEND_API_KEY);

// Token is valid for 1 hour
const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const normalised = email.trim().toLowerCase();

    // Always return 200 — never confirm whether an email is registered
    const [user] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.email, normalised))
      .limit(1);

    if (user) {
      // Invalidate any existing unused tokens for this user
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, user.id));

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

      await db.insert(passwordResetTokens).values({
        id: crypto.randomUUID(),
        userId: user.id,
        token,
        expiresAt,
      });

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;

      await resend.emails.send({
        from: "FlipWhizz <noreply@flipwhizz.com>", // adjust sender
        to: normalised,
        subject: "Reset your FlipWhizz password",
        html: buildEmailHtml({ name: user.name ?? "there", resetUrl }),
      });
    }

    // Always return the same response
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

// ---- email template ----
function buildEmailHtml({ name, resetUrl }: { name: string; resetUrl: string }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#FEFCFA;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEFCFA;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(45,34,53,0.08);">
          <!-- gradient bar -->
          <tr>
            <td style="background:linear-gradient(to right,#D94590,#7C3AED,#5EEAD4);height:4px;"></td>
          </tr>
          <!-- body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2D2235;">
                Hi ${name} 👋
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#6B5D52;line-height:1.6;">
                We received a request to reset the password for your FlipWhizz account.
                Click the button below — the link is valid for <strong>1 hour</strong>.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:12px;background:#D94590;box-shadow:0 4px 16px rgba(217,69,144,0.3);">
                    <a
                      href="${resetUrl}"
                      style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.03em;"
                    >
                      Reset my password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#A89B8E;line-height:1.5;">
                If you didn't request this, you can safely ignore this email —
                your password won't change.
              </p>
              <p style="margin:0;font-size:12px;color:#C4B8B0;word-break:break-all;">
                Or copy this link into your browser:<br/>
                <a href="${resetUrl}" style="color:#D94590;">${resetUrl}</a>
              </p>
            </td>
          </tr>
          <!-- footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #F0EBE6;">
              <p style="margin:0;font-size:12px;color:#C4B8B0;text-align:center;">
                FlipWhizz · Every story finds its way
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}