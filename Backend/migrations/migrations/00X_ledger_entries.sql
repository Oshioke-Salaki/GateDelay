CREATE TABLE IF NOT EXISTS ledger_entries (
  id               BIGSERIAL PRIMARY KEY,
  idempotency_key  TEXT NOT NULL UNIQUE,
  user_id          TEXT NOT NULL,
  asset            TEXT NOT NULL,
  amount           NUMERIC(38, 18) NOT NULL CHECK (amount > 0),
  type             TEXT NOT NULL DEFAULT 'deposit',
  reference_id     TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_user_asset ON ledger_entries (user_id, asset);
