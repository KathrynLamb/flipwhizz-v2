// scripts/seed-christmas-promos.ts
// Generates reviewable SQL; this script never connects to a database.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { CHRISTMAS } from "../src/lib/christmas";

export function christmasPromoSeedSQL() {
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const campaigns = [
    { code: CHRISTMAS.earlyOfferCode, label: "Christmas early offer", expires: CHRISTMAS.earlyOfferEnds },
    { code: "VERONICA10", label: "Veronica Christmas campaign", expires: CHRISTMAS.endsAt },
    { code: "NICK10", label: "Nick Christmas campaign", expires: CHRISTMAS.endsAt },
  ];
  const values = campaigns.map(p => `(${quote(p.code)}, ${quote(p.label)}, (${quote(p.expires)}::timestamptz AT TIME ZONE 'UTC'))`).join(",\n    ");
  return `-- Generated from scripts/seed-christmas-promos.ts and src/lib/christmas.ts
BEGIN;
-- Serialise campaign setup. Never reset usage counts or overwrite an existing code.
LOCK TABLE promo_codes IN SHARE ROW EXCLUSIVE MODE;
WITH campaign(code, label, expires_at) AS (VALUES
    ${values}
)
INSERT INTO promo_codes (code, label, discount_type, discount_percent, discount_fixed_cents,
  digital_override, print_override, gift_override, active, starts_at, expires_at)
SELECT code, label, 'percent', 10, 0, NULL, NULL, NULL, true, now() AT TIME ZONE 'UTC', expires_at
FROM campaign c WHERE NOT EXISTS (SELECT 1 FROM promo_codes p WHERE lower(p.code) = lower(c.code));
COMMIT;
-- Review existing collisions as well as newly inserted codes before launch.
SELECT code, label, active, starts_at, expires_at, discount_percent, current_uses, max_uses
FROM promo_codes WHERE lower(code) IN (${campaigns.map(p => quote(p.code.toLowerCase())).join(", ")});
`;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.stdout.write(christmasPromoSeedSQL());
