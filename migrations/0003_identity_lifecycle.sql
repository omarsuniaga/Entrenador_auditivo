-- Ciclo de vida anónimo: la aplicación revoca o anonimiza identidades,
-- pero nunca persiste tokens ni direcciones IP en texto plano.
ALTER TABLE players ADD COLUMN revoked_at INTEGER;
ALTER TABLE players ADD COLUMN deleted_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_players_active
  ON players (id, revoked_at, deleted_at);

CREATE TABLE IF NOT EXISTS token_revocations (
  token_hash TEXT NOT NULL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  revoked_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_revocations_expiry
  ON token_revocations (expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_windows (
  scope TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scope, subject_hash)
);
