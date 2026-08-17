CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  display_name_normalized TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS solo_attempts (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  mode TEXT NOT NULL CHECK (mode IN ('frequency', 'notes')),
  difficulty TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  accuracy REAL NOT NULL CHECK (accuracy >= 0 AND accuracy <= 100),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  ruleset_version TEXT NOT NULL,
  is_valid INTEGER NOT NULL DEFAULT 1 CHECK (is_valid IN (0, 1)),
  completed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_solo_rankings
  ON solo_attempts (mode, is_valid, score DESC, accuracy DESC, completed_at ASC);

CREATE TABLE IF NOT EXISTS duel_matches (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('frequency', 'notes')),
  status TEXT NOT NULL CHECK (status IN ('completed', 'abandoned', 'draw')),
  winner_player_id TEXT REFERENCES players(id),
  ruleset_version TEXT NOT NULL,
  completed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS duel_participants (
  match_id TEXT NOT NULL REFERENCES duel_matches(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  score INTEGER NOT NULL CHECK (score >= 0),
  rounds_won INTEGER NOT NULL CHECK (rounds_won >= 0),
  accuracy REAL NOT NULL CHECK (accuracy >= 0 AND accuracy <= 100),
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw', 'abandoned')),
  PRIMARY KEY (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_duel_player_rankings
  ON duel_participants (player_id, result, rounds_won DESC);
