// src/lib/emails/sendOrderFailed.ts

import { resend } from "@/lib/resend";

interface OrderFailedParams {
  to: string;
  storyTitle: string;
  storyId: string;
}

export async function sendOrderFailed({ to, storyTitle, storyId }: OrderFailedParams) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order Update</title>
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
              <h2 style="margin:0 0 12px; font-size:20px; color:#1a1a2e; font-weight:700;">
                There was a problem with your order
              </h2>
              <p style="margin:0 0 20px; font-size:15px; color:#555; line-height:1.7;">
                Unfortunately, our printing partner ran into an issue processing your order for
                <strong>${storyTitle}</strong>.
              </p>
              <p style="margin:0 0 20px; font-size:15px; color:#555; line-height:1.7;">
                Don't worry — your digital book is completely safe and nothing has been lost.
                You can head back to your book page and try ordering again, or just reply to
                this email and we'll sort it out personally.
              </p>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:99px; background:linear-gradient(135deg, #7C3AED 0%, #EC4899 100%);">
                    <a href="https://flipwhizz.com/stories/${storyId}/print"
                       style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; font-family:Arial,sans-serif; border-radius:99px;">
                      Go to your book
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0; font-size:14px; color:#888; line-height:1.6; font-family:Arial,sans-serif;">
                Sorry for the inconvenience — this is rare and we'll make sure it gets fixed.
                Just reply here if you need anything at all.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; border-top:1px solid #f0ecf5; text-align:center;">
              <p style="margin:0 0 4px; font-size:12px; color:#aaa; font-family:Arial,sans-serif;">Made with love by FlipWhizz</p>
              <p style="margin:0; font-size:11px; color:#ccc; font-family:Arial,sans-serif;">
                <a href="https://flipwhizz.com" style="color:#7C3AED; text-decoration:none;">flipwhizz.com</a>
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
    subject: `An update about your FlipWhizz order`,
    html,
  });

  if (error) {
    console.error("❌ Failed to send order failed email:", error);
    throw new Error(`Resend error: ${error.message}`);
  }

  console.log("📧 Order failed email sent:", { to, emailId: data?.id });
  return data;
}