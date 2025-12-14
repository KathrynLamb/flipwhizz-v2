// src/services/gelato.ts
import { v4 as uuid } from 'uuid';

const GELATO_API_KEY = process.env.GELATO_API_KEY;

export class Logistics {
  static async createOrder(
    userEmail: string, 
    shippingAddress: any, 
    pdfUrl: string
  ) {
    const orderRef = uuid();
    
    const payload = {
      orderType: "order",
      orderReferenceId: orderRef,
      customerReferenceId: userEmail,
      currency: "USD",
      items: [
        {
          itemReferenceId: `book_${orderRef}`,
          productUid: "hardcover_book_8x8_in_24_pages", // Check Gelato catalog for exact UID
          files: [
            {
              type: "default", // This applies to interior pages
              url: pdfUrl
            }
            // Note: In real prod, you generate a separate Cover PDF and add it here as type: 'cover'
          ],
          quantity: 1
        }
      ],
      shippingAddress: shippingAddress
    };

    const res = await fetch("https://api.gelato.com/v4/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": GELATO_API_KEY!
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Gelato Error: ${JSON.stringify(err)}`);
    }

    return await res.json();
  }
}