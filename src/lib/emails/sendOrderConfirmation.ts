// src/lib/emails/sendOrderConfirmation.ts

import { resend } from "@/lib/resend";

interface OrderConfirmationParams {
  to: string;
  childName: string;
  storyTitle: string;
  productType: "print" | "gift";
  gelatoOrderId: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postCode: string;
    countryIsoCode: string;
  };
}

const PRODUCT_LABELS: Record<string, string> = {
  print: "Softcover Book",
  gift: "Hardcover Gift Book",
};

export async function sendOrderConfirmation(params: OrderConfirmationParams) {
  const {
    to,
    childName,
    storyTitle,
    productType,
    gelatoOrderId,
    shippingAddress,
  } = params;

  const productLabel = PRODUCT_LABELS[productType] ?? "Book";
  const addressLines = [
    `${shippingAddress.firstName} ${shippingAddress.lastName}`,
    shippingAddress.addressLine1,
    shippingAddress.addressLine2,
    `${shippingAddress.city}, ${shippingAddress.postCode}`,
    shippingAddress.countryIsoCode,
  ]
    .filter(Boolean)
    .join("<br/>");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order Confirmation</title>
</head>
<body style="margin:0; padding:0; background-color:#F9F5FF; font-family:Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9F5FF; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:22px; overflow:hidden; box-shadow:0 4px 24px rgba(128,90,213,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #7C3AED 0%, #EC4899 100%); padding:40px 32px; text-align:center;">
              <h1 style="margin:0; font-size:28px; color:#ffffff; font-weight:700; letter-spacing:-0.5px;">
                FlipWhizz
              </h1>
              <p style="margin:8px 0 0; font-size:14px; color:rgba(255,255,255,0.85); font-style:italic;">
                Stories as unique as your child
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding:36px 32px 24px;">
              <h2 style="margin:0 0 8px; font-size:22px; color:#1a1a2e; font-weight:700;">
                Your book is on its way! ✨
              </h2>
              <p style="margin:0 0 24px; font-size:15px; color:#555; line-height:1.6;">
                Great news — <strong>${childName}</strong>'s personalised story is now being printed and will be with you soon.
              </p>

              <!-- Order details card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9F5FF; border-radius:16px; margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 4px; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#7C3AED; font-weight:700; font-family:Arial,sans-serif;">
                      Order Details
                    </p>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                      <tr>
                        <td style="padding:6px 0; font-size:14px; color:#888; width:120px; vertical-align:top; font-family:Arial,sans-serif;">Story</td>
                        <td style="padding:6px 0; font-size:14px; color:#1a1a2e; font-weight:600;">${storyTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0; font-size:14px; color:#888; vertical-align:top; font-family:Arial,sans-serif;">Format</td>
                        <td style="padding:6px 0; font-size:14px; color:#1a1a2e; font-weight:600;">${productLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0; font-size:14px; color:#888; vertical-align:top; font-family:Arial,sans-serif;">Order ref</td>
                        <td style="padding:6px 0; font-size:13px; color:#1a1a2e; font-family:monospace;">${gelatoOrderId}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Shipping address card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0FDF9; border-radius:16px; margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 12px; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#059669; font-weight:700; font-family:Arial,sans-serif;">
                      Shipping To
                    </p>
                    <p style="margin:0; font-size:14px; color:#1a1a2e; line-height:1.7; font-family:Arial,sans-serif;">
                      ${addressLines}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Timeline note -->
              <p style="margin:0 0 8px; font-size:14px; color:#555; line-height:1.6;">
                Most orders arrive within <strong>4–7 business days</strong>. We'll let you know if there are any updates.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 36px; text-align:center;">
              <a href="https://flipwhizz.com" style="display:inline-block; background:linear-gradient(135deg, #7C3AED 0%, #EC4899 100%); color:#ffffff; text-decoration:none; font-size:15px; font-weight:700; padding:14px 36px; border-radius:99px; font-family:Arial,sans-serif;">
                Create Another Story
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; border-top:1px solid #f0ecf5; text-align:center;">
              <p style="margin:0 0 4px; font-size:12px; color:#aaa; font-family:Arial,sans-serif;">
                Made with love by FlipWhizz
              </p>
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
    subject: `Your book for ${childName} is being printed! 📚`,
    html,
  });

  if (error) {
    console.error("❌ Failed to send order confirmation email:", error);
    throw new Error(`Resend error: ${error.message}`);
  }

  console.log("📧 Order confirmation email sent:", { to, emailId: data?.id });
  return data;
}