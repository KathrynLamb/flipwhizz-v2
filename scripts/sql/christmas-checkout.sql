-- scripts/sql/christmas-checkout.sql
-- Apply before deploying Task 5. Additive; does not alter historical payments.
BEGIN;
CREATE TABLE IF NOT EXISTS checkout_payments (
  id text PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES stories(id),
  user_id text NOT NULL,
  product_type text NOT NULL,
  book_type text NOT NULL,
  currency text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  promo_id uuid REFERENCES promo_codes(id),
  promo_code text,
  is_upgrade boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'reserved', 'paid', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS checkout_payments_promo_user_idx ON checkout_payments(promo_id, user_id, status);
CREATE INDEX IF NOT EXISTS checkout_payments_story_idx ON checkout_payments(story_id);
COMMIT;
