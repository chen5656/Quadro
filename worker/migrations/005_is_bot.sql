-- Adds hidden is_bot column to scores table.
--
--   npx wrangler d1 execute nodra --remote --file worker/migrations/005_is_bot.sql

ALTER TABLE scores ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;

