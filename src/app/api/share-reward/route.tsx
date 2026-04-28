// app/api/share-reward/route.ts

import { NextResponse } from "next/server";
import { db } from "@/db";
import { promoCodes, users } from "@/db/schema";
import { eq, like, and } from "drizzle-orm";
import { Resend } from "resend";
import { nanoid } from "nanoid";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email, childName } = await req.json();

    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    // 1. Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const codePrefix = `SHARE-${user.id.slice(0, 8).toUpperCase()}`;

    // 2. Check if they already have a share reward code — resend rather than create a new one
    const existing = await db.query.promoCodes.findFirst({
      where: and(
        like(promoCodes.code, `${codePrefix}%`),
        eq(promoCodes.active, true)
      ),
      columns: { code: true },
    });

    let code: string;

    if (existing) {
      code = existing.code;
    } else {
      // 3. Generate unique code
      code = `${codePrefix}-${nanoid(4).toUpperCase()}`;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // 4. Insert — column names match your Drizzle schema (camelCase)
      await db.insert(promoCodes).values({
        code,
        label: `Share reward – ${email}`,
        discountType: "percent",
        discountPercent: 40,
        discountFixedCents: 0,
        digitalOverride: null,
        printOverride: null,
        giftOverride: null,
        maxUses: 1,
        currentUses: 0,
        maxUsesPerUser: 1,
        active: true,
        expiresAt,
      });
    }

    // 5. Send email via Resend
    await resend.emails.send({
      from: "FlipWhizz <hello@flipwhizz.com>",
      to: email,
      subject: "🎉 Here's your 40% off — thank you for sharing!",
      html: shareRewardEmailHtml({ code, childName }),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[share-reward] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function shareRewardEmailHtml({ code, childName }: { code: string; childName: string }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#FEFCFA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEFCFA;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <tr>
          <td style="padding:0 24px 32px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#2D2235;letter-spacing:-0.5px;">
              Flip<span style="color:#D94590;">Whizz</span>
            </div>
          </td>
        </tr>

        <tr>
          <td style="background:#2D2235;border-radius:24px;padding:40px 32px;text-align:center;">
            <div style="font-size:48px;margin-bottom:16px;">🎉</div>
            <h1 style="color:#FEFCFA;font-size:26px;font-weight:800;margin:0 0 12px;line-height:1.2;">
              Thank you for sharing ${childName}'s story!
            </h1>
            <p style="color:#c9b8d8;font-size:15px;margin:0 0 32px;line-height:1.6;">
              You've earned 40% off your next FlipWhizz book.<br/>Use the code below at checkout.
            </p>
            <div style="background:#D94590;border-radius:16px;padding:20px 32px;display:inline-block;margin-bottom:8px;">
              <div style="color:rgba(255,255,255,0.7);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">
                Your discount code
              </div>
              <div style="color:white;font-size:28px;font-weight:800;letter-spacing:3px;">
                ${code}
              </div>
            </div>
            <div style="color:#8a6a9a;font-size:12px;margin-top:12px;">
              Valid for 30 days · One use · Any book
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 24px;text-align:center;">
            <a href="https://flipwhizz.com/create"
              style="display:inline-block;background:#D94590;color:white;font-size:15px;font-weight:700;padding:16px 36px;border-radius:22px;text-decoration:none;">
              Create Another Book →
            </a>
          </td>
        </tr>

        <tr>
          <td style="padding:0 24px 40px;text-align:center;">
            <p style="color:#b0a0bc;font-size:12px;line-height:1.6;margin:0;">
              One-time use · Expires 30 days from today · Valid on digital, print and gift books.<br/>
              Cannot be combined with other offers.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}