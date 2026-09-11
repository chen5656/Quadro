-- Removes the UNIQUE (puzzle_id, user_id, ai_level) constraint so all attempts are preserved.
--
-- Run with:
--   npx wrangler d1 execute nodra --remote --file worker/migrations/006_allow_all_history.sql

CREATE TABLE IF NOT EXISTS scores_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  puzzle_id     TEXT    NOT NULL,
  user_id       TEXT    NOT NULL,
  display_name  TEXT    NOT NULL,
  elapsed_ms    INTEGER NOT NULL,
  final_score   INTEGER NOT NULL,
  opponent_score INTEGER NOT NULL,
  ai_level      TEXT    NOT NULL DEFAULT 'extreme',
  rounds        INTEGER NOT NULL,
  client_version TEXT   NOT NULL,
  replay        TEXT,
  verified      INTEGER NOT NULL DEFAULT 0,
  attempts      INTEGER NOT NULL DEFAULT 1,
  is_bot        INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

INSERT INTO scores_new (
  id, puzzle_id, user_id, display_name, elapsed_ms, final_score,
  opponent_score, ai_level, rounds, client_version, replay,
  verified, attempts, is_bot, created_at, updated_at
)
SELECT
  id, puzzle_id, user_id, display_name, elapsed_ms, final_score,
  opponent_score, ai_level, rounds, client_version, replay,
  verified, attempts, is_bot, created_at, updated_at
FROM scores;

DROP TABLE scores;

ALTER TABLE scores_new RENAME TO scores;

CREATE INDEX IF NOT EXISTS idx_scores_board
  ON scores (puzzle_id, ai_level, (final_score - opponent_score) DESC, elapsed_ms ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_scores_user
  ON scores (user_id, created_at DESC);
