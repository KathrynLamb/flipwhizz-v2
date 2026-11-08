<!-- docs/christmas-task5.md -->
# Christmas promo rollout

No new application packages or environment variables. The existing `DATABASE_URL` is used. `TEST_DATABASE_URL` is optional and only for the integration test, pointing to an isolated test database.

## Before merge

1. Apply `scripts/sql/christmas-checkout.sql` to an isolated database branch and run the integration test below. Apply the same additive migration to the target database before deploying these routes. Never run `drizzle-kit push` against production as a substitute for this reviewed migration.
2. Generate SQL from the shared campaign config: `node --import tsx scripts/seed-christmas-promos.ts > /tmp/christmas-promos.sql`.
3. Review and execute the generated SQL against the intended database. It inserts missing codes only, preserving existing codes and usage counts. The final SELECT shows any existing collisions that need review. It does not reset or reactivate an existing code.
4. Run a PayPal sandbox checkout and a free checkout, verify the payment record and admin report, and confirm print orders inherit the code. Test an expired code and two customers competing for the last use.

`CHRISTMAS10` is 10% off and expires at `CHRISTMAS.earlyOfferEnds`. `VERONICA10` and `NICK10` are 10% off, labelled by influencer, and expire at `CHRISTMAS.endsAt`. Newly inserted codes start immediately. The influencer names come from the brief and can be edited in the seed script before running it. Re-running the seed does not update existing dates; if campaign dates change after activation, explicitly update the corresponding database rows too.

## Reporting and payment behaviour

Open **Admin > Orders > Orders per promo code** (`/admin/orders/promos`). The report counts completed checkouts once, including digital books, free books and upgrades, with revenue split by currency. It starts when the new tracking is deployed; historical amounts are not guessed or backfilled. Print submissions remain in the existing Orders screen and display their promo code. Existing `promo:CODE` payment references are preserved.

A saved server quote binds each PayPal order to its story, product, price and promo code. The capture route reserves a use transactionally before charging, so concurrent captures cannot exceed the global or per-user limit. Free claims reserve, record and unlock in one transaction. One free basket item consumes one use.

Opening or abandoning the PayPal popup does not consume a use. If capture times out after approval, its result is ambiguous, so the reservation remains held and appears under Payments awaiting confirmation. Retry the same PayPal order to recover it. Do not release a reservation simply because a network call failed: check PayPal first. A confirmed VOIDED order releases its use when retried. A completed payment cannot be released by that path. Per-user limits count payments recorded by this new ledger; old purchases are not backfilled.

The new purchase table avoids creating placeholder fulfilment orders before a book is ready. Old in-flight PayPal orders created before deployment lack a server quote and must restart checkout. Deploy at a quiet time.

## Checks

- `node --import tsx --test tests/promo.test.ts tests/christmas.test.ts tests/christmas-banner.test.ts tests/christmas-page.test.ts tests/christmas-delivery.test.ts`
- `TEST_DATABASE_URL=... node --import tsx --test tests/checkout-store.integration.test.ts`

The integration test creates an isolated schema and removes only that schema afterwards. It checks the actual migration and transactions, including contention for the final use, retries, free claims, rollback, per-user limits, inactive/future/expired codes, cancellation and repeatable seeding. The separate-connection PostgreSQL test requires a real test database. The same assertions have also been exercised using embedded PostgreSQL; that validates SQL and transactional logic but does not replace the multi-connection test or a PayPal sandbox order.
