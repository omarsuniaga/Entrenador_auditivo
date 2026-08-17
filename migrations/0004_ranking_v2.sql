-- El nivel numérico permite comparar solo intentos del mismo reto.
ALTER TABLE solo_attempts ADD COLUMN difficulty_level INTEGER NOT NULL DEFAULT 1
  CHECK (difficulty_level BETWEEN 1 AND 20);

UPDATE solo_attempts
SET difficulty_level = CAST(difficulty AS INTEGER)
WHERE difficulty GLOB '[0-9]*'
  AND CAST(difficulty AS INTEGER) BETWEEN 1 AND 20;

CREATE INDEX IF NOT EXISTS idx_solo_rankings_v2
  ON solo_attempts (
    mode,
    difficulty_level,
    is_valid,
    score DESC,
    accuracy DESC,
    duration_ms ASC,
    completed_at ASC,
    id ASC
  );

-- Una clave representa una acción del jugador y conserva el resultado de un reintento.
CREATE TABLE IF NOT EXISTS idempotency_records (
  scope TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id),
  idempotency_key TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (scope, player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_expiry
  ON idempotency_records (expires_at);

-- Las columnas existentes id, winner_player_id y completed_at conservan el cierre.
ALTER TABLE duel_matches ADD COLUMN room_id TEXT;
ALTER TABLE duel_matches ADD COLUMN difficulty_level INTEGER
  CHECK (difficulty_level BETWEEN 1 AND 20);
ALTER TABLE duel_matches ADD COLUMN ended_reason TEXT NOT NULL DEFAULT 'completed'
  CHECK (ended_reason IN ('completed', 'abandoned', 'cancelled', 'draw'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_duel_matches_room_id
  ON duel_matches (room_id)
  WHERE room_id IS NOT NULL;

ALTER TABLE duel_participants ADD COLUMN response_time_ms INTEGER
  CHECK (response_time_ms >= 0);

CREATE INDEX IF NOT EXISTS idx_duel_rankings_v2
  ON duel_participants (result, score DESC, accuracy DESC, response_time_ms ASC, match_id ASC);
