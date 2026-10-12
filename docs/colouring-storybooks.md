# Colouring storybooks and Lulu

The shared creation flow supports `storybook` and `colouring_storybook`. This is independent of the existing digital/print/gift purchase tier. Existing rows default to storybook.

## Behaviour

- `/projects/create` and `/chat` show a format selector. `/colouring-books` links to the shared flow with colouring preselected.
- Demo choices survive sign-in in session storage and are saved on the project and generated story. Project selector changes are saved immediately.
- Claude can call the validated `set_book_type` tool on an explicit request. The prompt excludes negated, hypothetical, quoted and incidental mentions. This intent classification still needs real-model evaluation before release.
- A colouring book has a full-colour cover and black-outline interiors. The story shell shows the selected format and asks for confirmation before generation. Format is fixed when the story is written; start another book to switch an already-created story.
- Active spread generation, preview, QA repair, lettering, revisions and style samples use colouring requirements. Character and location references retain their source colours for identity; interior rendering is explicitly instructed to translate them into outlines.
- Digital export works without Lulu credentials. Lulu print exports use two files, never the Gelato combined PDF. Existing storybooks keep their Gelato path.
- Physical colouring checkout is unavailable until explicitly enabled. Hardcover colouring books are not supported in this first version.

## Migration

Apply `drizzle/0072_colouring_storybooks.sql` before deploying the application code. It only adds columns and preserves all existing data. The migration and snapshot intentionally exclude unrelated pre-existing schema drift (admin tables, spread QA and style plate fields).

## Lulu configuration

Start with a separate Lulu sandbox account: https://developers.sandbox.lulu.com/

Set these server-side environment variables, through your normal secret manager (never in source control):

```
LULU_ENVIRONMENT=sandbox
LULU_CLIENT_KEY=<sandbox client key>
LULU_CLIENT_SECRET=<sandbox client secret>
LULU_COLOURING_POD_PACKAGE_ID=<exact package ID from Lulu calculator>
LULU_CONTACT_EMAIL=<your order-monitoring email>
LULU_SHIPPING_LEVEL=<shipping level verified for your destinations>
LULU_PRINT_ENABLED=false
```

The first exporter supports **8.5 × 8.5 inch, paperback, black-and-white, 60# white uncoated paper**. Select the available configuration in Lulu's calculator; the code deliberately does not invent a product ID. Standard or Premium B&W and matte/gloss cover finishing are accepted. An incompatible SKU fails explicitly. Size/binding changes require corresponding export changes, not just swapping the ID.

Interior: 0.125-inch bleed, 0.5-inch safe inset, artwork fitted without stretching, first story spread starts on the left-hand page. A title-image page precedes the story; padding provides at least 32 pages. For the usual 28-page story the resulting interior has 32 pages. Cover: a single-page wrap, dimensioned by Lulu for the actual page count, with a white spine and inset front/back artwork. This is intentionally conservative about preserving existing cover text. Inspect the proof before choosing whether to redesign full-bleed covers.

The original illustration pipeline's generated resolution and lettering still determine print quality. These exports do not create additional image detail. Grayscale conversion in the PDF is not a replacement for generating proper line art.

## Test a real sample

1. Create a colouring story in a staging deployment with the migration applied. Confirm the format, create a style preview, and check a spread, a redraw and the cover.
2. Check the stored `book_type` survives guest chat, sign-in, project reload and story creation. Try explicit requests for both formats, negations and incidental mentions of colouring.
3. Finish the book. As its owner, call `POST /api/stories/<id>/export-lulu`. The response supplies `interiorUrl`, `coverUrl`, `pageCount`, and the configured package ID. This creates files only; it does not place or purchase an order.
4. Validate both URLs with Lulu's `/validate-interior/` and `/validate-cover/` APIs and poll their returned validation IDs until complete. The client exposes both calls. Check every page, the spine and actual resolution.
5. Use the sandbox to test a job, rejection, status and duplicate request. Sandbox jobs never print. Configure Lulu billing/autopay and monitor UNPAID/REJECTED jobs before production.
6. Order a physical proof through your Lulu account and test pencils, crayons and any pens you plan to recommend. No sample has been ordered by this change.
7. Verify retail price/margin (the existing FlipWhizz `print` tier price is retained), shipping level, destinations, taxes, phone-number collection, delivery promises and order emails. Generic existing checkout delivery copy has not been reverified for Lulu.
8. After the sample and end-to-end staging test, use production credentials, set `LULU_ENVIRONMENT=production`, and set `LULU_PRINT_ENABLED=true`.

Printing requires a confirmed paid paperback order. Both customer order endpoints route colouring books to Lulu. A story row lock prevents concurrent submissions for the same payment. An uncertain request outcome becomes `pending_manual`; never automatically retry it. Reconcile against Lulu's `external_id` (the local order ID) before clearing the hold. `/api/orders/<id>/status` polls Lulu and persists its last known state. Lulu-specific tracking notifications/webhook automation are not part of this first release; monitor the order account and status endpoint.

## Validation performed

`npm run test:colouring` covers format validation, structured chat selection, unavailable print products, incompatible SKUs, sandbox request contract, no retry on ambiguous submission, separate cover/interior order payloads and actual generated PDF geometry/page counts. No production API calls, image-generation spending, database migration or printing are performed by the tests.

The repository has existing TypeScript errors. Compare `npx tsc --noEmit` against the baseline before attributing failures to this change. Live chat/image quality, payment, storage and Lulu fulfilment need staging credentials; they cannot be verified by the isolated tests.

Official API contract reviewed: https://api.lulu.com/api-docs/openapi-specs/openapi_public.yml
