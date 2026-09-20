CREATE TABLE IF NOT EXISTS listings (
  id              BIGSERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  deal            TEXT NOT NULL DEFAULT 'rent',
  type            TEXT,
  price           NUMERIC DEFAULT 0,
  beds            INTEGER DEFAULT 0,
  baths           INTEGER DEFAULT 0,
  size            TEXT,
  region          TEXT,
  county          TEXT,
  location        TEXT,
  description     TEXT,
  photos          JSONB NOT NULL DEFAULT '[]'::jsonb,
  videos          JSONB NOT NULL DEFAULT '[]'::jsonb,
  rooms           JSONB NOT NULL DEFAULT '[]'::jsonb,
  tier            TEXT NOT NULL DEFAULT 'standard',
  submitter_name  TEXT,
  submitter_phone TEXT,
  submitter_email TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  paid            BOOLEAN NOT NULL DEFAULT false,
  amount          NUMERIC DEFAULT 0,
  checkout_id     TEXT,
  receipt         TEXT,
  pay_error       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_public ON listings (paid, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_region ON listings (region);
CREATE INDEX IF NOT EXISTS idx_listings_checkout ON listings (checkout_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id              BIGSERIAL PRIMARY KEY,
  plan_id         TEXT NOT NULL,
  plan_name       TEXT,
  audience        TEXT,
  phone           TEXT NOT NULL,
  name            TEXT,
  email           TEXT,
  billing         TEXT NOT NULL DEFAULT 'monthly',
  amount          NUMERIC DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  checkout_id     TEXT,
  receipt         TEXT,
  current_period_end TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subs_phone ON subscriptions (phone, status);
CREATE INDEX IF NOT EXISTS idx_subs_checkout ON subscriptions (checkout_id);

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'landlord',
  company       TEXT,
  password_hash TEXT NOT NULL,
  verified      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS owner_id BIGINT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings (owner_id, status);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions (user_id, status);

CREATE TABLE IF NOT EXISTS leads (
  id          BIGSERIAL PRIMARY KEY,
  listing_id  BIGINT,
  owner_id    BIGINT,
  name        TEXT,
  phone       TEXT,
  message     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads (owner_id, created_at DESC);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS county TEXT;
CREATE INDEX IF NOT EXISTS idx_listings_county ON listings (county);

-- Payout / KYC details for landlords & agents
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_method TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_mpesa TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kra_pin TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name TEXT;

-- Escrow: rent/sale payments held by the platform, split on release
CREATE TABLE IF NOT EXISTS escrows (
  id             BIGSERIAL PRIMARY KEY,
  listing_id     BIGINT,
  listing_title  TEXT,
  owner_id       BIGINT,
  tenant_name    TEXT,
  tenant_phone   TEXT,
  tenant_email   TEXT,
  gross          NUMERIC NOT NULL DEFAULT 0,
  commission     NUMERIC NOT NULL DEFAULT 0,
  net            NUMERIC NOT NULL DEFAULT 0,
  provider       TEXT,
  checkout_id    TEXT,
  receipt        TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  payout_ref     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_escrows_owner ON escrows (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_escrows_checkout ON escrows (checkout_id);

-- Transaction record columns (rent paid direct to landlord; we record + invoice 8%)
ALTER TABLE escrows ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'rent';
ALTER TABLE escrows ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE escrows ADD COLUMN IF NOT EXISTS invoice_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE escrows ADD COLUMN IF NOT EXISTS invoice_ref TEXT;
ALTER TABLE escrows ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ratings (
  id         BIGSERIAL PRIMARY KEY,
  stars      INTEGER NOT NULL,
  comment    TEXT,
  context    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS area_acres NUMERIC;

ALTER TABLE listings ADD COLUMN IF NOT EXISTS lat NUMERIC;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS lng NUMERIC;

ALTER TABLE listings ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_listings_featured ON listings (featured);

CREATE TABLE IF NOT EXISTS favourites (
  user_id     BIGINT NOT NULL,
  listing_id  BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
