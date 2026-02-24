CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  authority VARCHAR(64),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature VARCHAR(128) NOT NULL,
  slot BIGINT,
  data JSONB,
  UNIQUE(signature, name)
);

CREATE INDEX idx_events_name ON events(name);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);

CREATE TABLE IF NOT EXISTS blacklist (
  address VARCHAR(64) PRIMARY KEY,
  reason TEXT NOT NULL,
  blacklisted_by VARCHAR(64),
  blacklisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  action VARCHAR(64) NOT NULL,
  operator VARCHAR(64),
  target VARCHAR(64),
  details JSONB,
  signature VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id VARCHAR(36) PRIMARY KEY,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mint_burn_requests (
  id VARCHAR(36) PRIMARY KEY,
  action VARCHAR(8) NOT NULL CHECK (action IN ('mint', 'burn')),
  amount VARCHAR(64) NOT NULL,
  recipient VARCHAR(64),
  token_account VARCHAR(64),
  config_pda VARCHAR(64),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  signature VARCHAR(128),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mint_burn_status ON mint_burn_requests(status);
