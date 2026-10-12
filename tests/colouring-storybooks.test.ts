import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { bookTypeFromToolBlocks, normalizeBookType, bookTypeChatContext } from "../src/lib/books/bookType";
import { LuluClient, colouringPurchaseError, colouringPodPackageId } from "../src/lib/lulu/client";
import { luluJobPayload, luluShippingAddress } from "../src/lib/lulu/contract";
import { buildColouringInterior, buildColouringCover, interiorPageCount, TRIM_PT, BLEED_PT } from "../src/lib/lulu/pdf";

// This suite makes no network calls, paid generation requests or print orders.
test("legacy stories retain storybook; invalid values cannot set a format", () => {
  assert.equal(normalizeBookType(null), "storybook");
  assert.equal(normalizeBookType("colouring_storybook"), "colouring_storybook");
  assert.equal(bookTypeFromToolBlocks([{ type: "tool_use", name: "set_book_type", input: { bookType: "hardcover" } }], "storybook"), "storybook");
});
test("only a validated format tool changes the saved choice; prose about colouring does not", () => {
  assert.equal(bookTypeFromToolBlocks([{ type: "text", text: "She loves coloring books" }], "storybook"), "storybook");
  assert.equal(bookTypeFromToolBlocks([{ type: "tool_use", name: "set_book_type", input: { bookType: "colouring_storybook" } }], "storybook"), "colouring_storybook");
  assert.equal(bookTypeFromToolBlocks([{ type: "tool_use", name: "set_book_type", input: { bookType: "storybook" } }], "colouring_storybook"), "storybook");
  assert.match(bookTypeChatContext("colouring_storybook"), /overrides earlier mentions/);
});
test("printing cannot fall back to Gelato when Lulu has not been launched", () => {
  const before = process.env.LULU_PRINT_ENABLED;
  process.env.LULU_PRINT_ENABLED = "false";
  try {
    assert.equal(colouringPurchaseError("storybook", "gift"), null);
    assert.equal(colouringPurchaseError("colouring_storybook", "digital"), null);
    assert.match(colouringPurchaseError("colouring_storybook", "print")!, /not available yet/);
    assert.match(colouringPurchaseError("colouring_storybook", "gift")!, /paperback/);
  } finally { if (before === undefined) delete process.env.LULU_PRINT_ENABLED; else process.env.LULU_PRINT_ENABLED = before; }
});
test("a incompatible paper or size is rejected instead of exporting to a guessed SKU", () => {
  const old = process.env.LULU_COLOURING_POD_PACKAGE_ID;
  process.env.LULU_COLOURING_POD_PACKAGE_ID = "0600X0900.FC.STD.PB.080CW444.GXX";
  try { assert.throws(colouringPodPackageId, /uncoated/); }
  finally { if (old === undefined) delete process.env.LULU_COLOURING_POD_PACKAGE_ID; else process.env.LULU_COLOURING_POD_PACKAGE_ID = old; }
});
test("Lulu client defaults are explicit and contract uses interior_page_count with point units", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const mock: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return Response.json(requests.length === 1 ? { access_token: "fake-token" } : { width: "1250", height: "630", unit: "pt" });
  };
  const client = new LuluClient({ clientKey: "test", clientSecret: "test", environment: "sandbox" }, mock);
  await client.coverDimensions("configured-package", 32);
  assert.ok(requests.every(r => r.url.startsWith("https://api.sandbox.lulu.com/")));
  assert.deepEqual(JSON.parse(requests[1].init!.body as string), { pod_package_id: "configured-package", interior_page_count: 32, unit: "pt" });
});
test("an ambiguous failed submission is not automatically retried", async () => {
  let calls = 0;
  const mock: typeof fetch = async () => { calls++; if (calls === 1) return Response.json({ access_token: "test" }); throw new Error("timeout"); };
  const client = new LuluClient({ clientKey: "test", clientSecret: "test", environment: "sandbox" }, mock);
  await assert.rejects(client.request("/print-jobs/", {}), /timeout/);
  assert.equal(calls, 2);
});
test("order contract supplies separate PDFs and maps the customer's address", () => {
  const shipping = luluShippingAddress({ firstName: "Test", lastName: "Reader", addressLine1: "1 Example Road", city: "York", postCode: "YO1 1AA", countryIsoCode: "gb", phone: "01234567890", email: "test@example.com" });
  const payload = luluJobPayload({ orderId: "unique-order", title: "Test", podPackageId: "configured-package", coverUrl: "https://example.com/cover.pdf", interiorUrl: "https://example.com/interior.pdf", contactEmail: "orders@example.com", shippingLevel: "MAIL", shipping });
  assert.equal(payload.shipping_address.country_code, "GB");
  assert.equal(payload.external_id, "unique-order");
  assert.notEqual(payload.line_items[0].printable_normalization.cover.source_url, payload.line_items[0].printable_normalization.interior.source_url);
  assert.throws(() => luluShippingAddress({} as Parameters<typeof luluShippingAddress>[0]), /Complete/);
});
test("28 story pages become 32 interior pages with correct bleed and a separate one-page cover", async () => {
  const image = await sharp(Buffer.from('<svg width="1600" height="900"><rect width="1600" height="900" fill="white"/><circle cx="400" cy="450" r="200" fill="none" stroke="black" stroke-width="8"/><rect x="1000" y="250" width="400" height="400" fill="none" stroke="black" stroke-width="8"/></svg>')).png().toBuffer();
  const { buffer, pageCount } = await buildColouringInterior({ title: "Test", cover: image, spreads: Array.from({ length: 14 }, () => ({ image, hasRightPage: true })) });
  const pdf = await PDFDocument.load(buffer);
  assert.equal(pageCount, 32); assert.equal(pdf.getPageCount(), 32);
  for (const page of pdf.getPages()) {
    assert.equal(page.getWidth(), 630);
    assert.deepEqual(page.getTrimBox(), { x: BLEED_PT, y: BLEED_PT, width: TRIM_PT, height: TRIM_PT });
  }
  const cover = await buildColouringCover(image, { width: 1250, height: 630 });
  const coverPdf = await PDFDocument.load(cover);
  assert.equal(coverPdf.getPageCount(), 1); assert.equal(coverPdf.getPage(0).getWidth(), 1250);
  await assert.rejects(buildColouringCover(image, { width: 100, height: 100 }), /dimensions/);
  assert.equal(interiorPageCount(32), 34);
  assert.throws(() => interiorPageCount(0));
});
