// src/lib/emails/sendOrderShipped.ts

import { resend } from "@/lib/resend";

interface OrderShippedParams {
  to: string;
  storyTitle: string;
  storyId: string;
  trackingUrl?: string;
  trackingCode?: string;
  minDelivery?: string;
  maxDelivery?: string;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long",
    });
  } catch {
    return dateStr;
  }
}

export async function sendOrderShipped({
  to, storyTitle, storyId, trackingUrl, trackingCode, minDelivery, maxDelivery,
}: OrderShippedParams) {
  const hasTracking = !!trackingUrl;
  const deliveryRange =
    minDelivery && maxDelivery
      ? `${formatDate(minDelivery)} – ${formatDate(maxDelivery)}`
      : minDelivery
      ? `from ${formatDate(minDelivery)}`
      : null;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your book is on its way!</title>
</head>
<body style="margin:0; padding:0; background-color:#F9F5FF; font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9F5FF; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:22px; overflow:hidden; box-shadow:0 4px 24px rgba(128,90,213,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #7C3AED 0%, #EC4899 100%); padding:40px 32px; text-align:center;">
              <h1 style="margin:0; font-size:28px; color:#ffffff; font-weight:700; letter-spacing:-0.5px;">FlipWhizz</h1>
              <p style="margin:8px 0 0; font-size:14px; color:rgba(255,255,255,0.85); font-style:italic;">Stories as unique as your child</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 24px;">
              <h2 style="margin:0 0 12px; font-size:22px; color:#1a1a2e; font-weight:700;">
                Your book is on its way! 🚀
              </h2>
              <p style="margin:0 0 20px; font-size:15px; color:#555; line-height:1.7;">
                <strong>${storyTitle}</strong> has been shipped and is heading to you now.
              </p>

              ${deliveryRange ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF9; border-radius:16px; margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#059669; font-weight:700; font-family:Arial,sans-serif;">Estimated Delivery</p>
                    <p style="margin:0; font-size:15px; color:#1a1a2e; font-weight:600; font-family:Arial,sans-serif;">${deliveryRange}</p>
                  </td>
                </tr>
              </table>` : ""}

              ${hasTracking ? `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:99px; background:linear-gradient(135deg, #059669 0%, #10B981 100%);">
                    <a href="${trackingUrl}"
                       style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; font-family:Arial,sans-serif; border-radius:99px;">
                      Track your delivery
                    </a>
                  </td>
                </tr>
              </table>
              ${trackingCode ? `<p style="margin:0 0 20px; font-size:13px; color:#888; font-family:Arial,sans-serif;">Tracking number: <code>${trackingCode}</code></p>` : ""}
              ` : ""}

              <p style="margin:0; font-size:14px; color:#888; line-height:1.6; font-family:Arial,sans-serif;">
                Get excited — a very special book is nearly there! 📚
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; border-top:1px solid #f0ecf5; text-align:center;">
              <p style="margin:0 0 4px; font-size:12px; color:#aaa; font-family:Arial,sans-serif;">Made with love by FlipWhizz</p>
              <p style="margin:0; font-size:11px; color:#ccc; font-family:Arial,sans-serif;">
                <a href="https://flipwhizz.com/stories/${storyId}/print" style="color:#7C3AED; text-decoration:none;">View order status</a>
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

  const { data, error } = await resend.emails.send({
    from: "FlipWhizz <orders@flipwhizz.com>",
    to,
    subject: `Your FlipWhizz book has shipped! 🚀`,
    html,
  });

  if (error) {
    console.error("❌ Failed to send shipped email:", error);
    throw new Error(`Resend error: ${error.message}`);
  }

  console.log("📧 Shipped email sent:", { to, emailId: data?.id });
  return data;
}