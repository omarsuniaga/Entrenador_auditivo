CREATE TABLE IF NOT EXISTS solo_sessions (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  mode TEXT NOT NULL CHECK (mode = 'frequency'),
  difficulty_level INTEGER NOT NULL CHECK (difficulty_level BETWEEN 1 AND 20),
  targets_json TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_solo_sessions_player_status
  ON solo_sessions (player_id, status, expires_at);

ALTER TABLE solo_attempts ADD COLUMN session_id TEXT REFERENCES solo_sessions(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_solo_attempts_session_id
  ON solo_attempts (session_id)
  WHERE session_id IS NOT NULL;
