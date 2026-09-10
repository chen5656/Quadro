/**
 * Synthetic "house" bot players for the leaderboard.
 *
 * Seeded into the Daily leaderboard so the board looks active and alive.
 * Real players will naturally compete with and replace them as they post scores.
 * All bots have `is_bot = 1` in the database.
 */

import { fnv1a32 } from '../src/engine/rng';
import type { AiLevel } from './leaderboard';

export interface BotProfile {
  id: string;
  name: string;
  avatarColor: string;
  skillTier: 'top' | 'strong' | 'average' | 'casual';
}

/**
 * 40 clearly synthetic USA player profiles.
 * Names represent USA gamer conventions (regional tags, common handles, states/cities).
 */
export const BOT_PROFILES: BotProfile[] = [
  // Top tier
  { id: 'bot-usa-01', name: 'Austin_TX_92', avatarColor: 'sky', skillTier: 'top' },
  { id: 'bot-usa-02', name: 'SeattleGamer', avatarColor: 'emerald', skillTier: 'top' },
  { id: 'bot-usa-03', name: 'MidwestMando', avatarColor: 'amber', skillTier: 'top' },
  { id: 'bot-usa-04', name: 'Cali_Roll_88', avatarColor: 'purple', skillTier: 'top' },
  { id: 'bot-usa-05', name: 'BrooklynDave', avatarColor: 'rose', skillTier: 'top' },
  { id: 'bot-usa-06', name: 'DenverPeak', avatarColor: 'sky', skillTier: 'top' },
  { id: 'bot-usa-07', name: 'Phoenix_Sun_99', avatarColor: 'amber', skillTier: 'top' },
  { id: 'bot-usa-08', name: 'BostonSam', avatarColor: 'emerald', skillTier: 'top' },

  // Strong tier
  { id: 'bot-usa-09', name: 'Sarah_Chicago', avatarColor: 'rose', skillTier: 'strong' },
  { id: 'bot-usa-10', name: 'JerseyDan', avatarColor: 'neutral', skillTier: 'strong' },
  { id: 'bot-usa-11', name: 'MiamiHeatFan', avatarColor: 'amber', skillTier: 'strong' },
  { id: 'bot-usa-12', name: 'PortlandBreeze', avatarColor: 'emerald', skillTier: 'strong' },
  { id: 'bot-usa-13', name: 'AtlantaAce', avatarColor: 'sky', skillTier: 'strong' },
  { id: 'bot-usa-14', name: 'Vegas_Slots_7', avatarColor: 'purple', skillTier: 'strong' },
  { id: 'bot-usa-15', name: 'PhillyCheez', avatarColor: 'amber', skillTier: 'strong' },
  { id: 'bot-usa-16', name: 'Dallas_Ranger', avatarColor: 'sky', skillTier: 'strong' },
  { id: 'bot-usa-17', name: 'SanDiegoSurfer', avatarColor: 'sky', skillTier: 'strong' },
  { id: 'bot-usa-18', name: 'NashvilleTunes', avatarColor: 'purple', skillTier: 'strong' },
  { id: 'bot-usa-19', name: 'TwinCities_MN', avatarColor: 'emerald', skillTier: 'strong' },
  { id: 'bot-usa-20', name: 'BayAreaTechie', avatarColor: 'sky', skillTier: 'strong' },

  // Average tier
  { id: 'bot-usa-21', name: 'Indy_Racer_500', avatarColor: 'neutral', skillTier: 'average' },
  { id: 'bot-usa-22', name: 'CarolinaBlue', avatarColor: 'sky', skillTier: 'average' },
  { id: 'bot-usa-23', name: 'RockyMountainHigh', avatarColor: 'emerald', skillTier: 'average' },
  { id: 'bot-usa-24', name: 'DetroitGrit', avatarColor: 'neutral', skillTier: 'average' },
  { id: 'bot-usa-25', name: 'TampaBay_Tom', avatarColor: 'amber', skillTier: 'average' },
  { id: 'bot-usa-26', name: 'HoustonRockets84', avatarColor: 'rose', skillTier: 'average' },
  { id: 'bot-usa-27', name: 'RustBeltRich', avatarColor: 'neutral', skillTier: 'average' },
  { id: 'bot-usa-28', name: 'YellowstoneGuy', avatarColor: 'amber', skillTier: 'average' },
  { id: 'bot-usa-29', name: 'BadgerState91', avatarColor: 'rose', skillTier: 'average' },
  { id: 'bot-usa-30', name: 'AlaskanWolf', avatarColor: 'sky', skillTier: 'average' },

  // Casual tier
  { id: 'bot-usa-31', name: 'SoCalChiller', avatarColor: 'amber', skillTier: 'casual' },
  { id: 'bot-usa-32', name: 'LoneStarLady', avatarColor: 'rose', skillTier: 'casual' },
  { id: 'bot-usa-33', name: 'SmokyMtn_Climber', avatarColor: 'emerald', skillTier: 'casual' },
  { id: 'bot-usa-34', name: 'HeartlandHarper', avatarColor: 'purple', skillTier: 'casual' },
  { id: 'bot-usa-35', name: 'GreatLakesLou', avatarColor: 'sky', skillTier: 'casual' },
  { id: 'bot-usa-36', name: 'BigSkyMontana', avatarColor: 'sky', skillTier: 'casual' },
  { id: 'bot-usa-37', name: 'OzarksExplorer', avatarColor: 'emerald', skillTier: 'casual' },
  { id: 'bot-usa-38', name: 'DesertCactusAZ', avatarColor: 'amber', skillTier: 'casual' },
  { id: 'bot-usa-39', name: 'AppalachianTrail', avatarColor: 'emerald', skillTier: 'casual' },
  { id: 'bot-usa-40', name: 'AlohaHawaii96', avatarColor: 'rose', skillTier: 'casual' },
];

/** Pseudo-random generator seeded for deterministic daily results. */
function createSeededRng(seed: number) {
  let s = seed;
  return () => {
    // Linear congruential generator
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Shuffle array in-place deterministically using rng */
function shuffle<T>(array: T[], rng: () => number): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface BotScore {
  userId: string;
  displayName: string;
  aiLevel: AiLevel;
  finalScore: number;
  opponentScore: number;
  elapsedMs: number;
  rounds: number;
  attempts: number;
}

/**
 * Generates scores for each bot on a given board.
 * Board 3 (extreme) will always have more bots than Board 2 (master),
 * which will have more than Board 1 (expert).
 *
 * All 3 boards are populated randomly from the 40 bot profiles.
 */
export function generateDailyBotScores(puzzleId: string): BotScore[] {
  const seed = fnv1a32(`house-bots:${puzzleId}`);
  const rng = createSeededRng(seed);

  // Shuffle profiles for today
  const shuffled = shuffle(BOT_PROFILES, rng);

  // Dynamic board counts per day:
  // Board 1: Extreme (least players, e.g. 6 - 9 bots)
  // Board 2: Master (middle players, e.g. 11 - 14 bots)
  // Board 3: Expert (most players, e.g. 16 - 20 bots)
  // Board 3 (expert) > Board 2 (master) > Board 1 (extreme) always holds.
  const countExtreme = 6 + Math.floor(rng() * 4); // 6..9
  const countMaster = 11 + Math.floor(rng() * 4); // 11..14
  const countExpert = 16 + Math.floor(rng() * 5); // 16..20

  const extremeBots = shuffled.slice(0, countExtreme);
  const masterBots = shuffled.slice(countExtreme, countExtreme + countMaster);
  const expertBots = shuffled.slice(countExtreme + countMaster, countExtreme + countMaster + countExpert);

  const results: BotScore[] = [];

  function generateScore(bot: BotProfile, aiLevel: AiLevel): BotScore {
    let finalScore: number;
    let opponentScore: number;
    let baseTimeSec: number;

    if (aiLevel === 'expert') {
      // Expert board: larger margins and wider spread.
      // Top bots reach 100+ vs ~50s AI, casual bots score 50+ vs 10s AI.
      switch (bot.skillTier) {
        case 'top':
          finalScore = 100 + Math.floor(rng() * 16); // 100..115
          opponentScore = 50 + Math.floor(rng() * 10); // 50..59
          baseTimeSec = 220 + Math.floor(rng() * 180); // 3.5 - 6.5 mins
          break;
        case 'strong':
          finalScore = 80 + Math.floor(rng() * 15); // 80..94
          opponentScore = 36 + Math.floor(rng() * 12); // 36..47
          baseTimeSec = 260 + Math.floor(rng() * 200); // 4 - 7.5 mins
          break;
        case 'average':
          finalScore = 65 + Math.floor(rng() * 14); // 65..78
          opponentScore = 24 + Math.floor(rng() * 14); // 24..37
          baseTimeSec = 320 + Math.floor(rng() * 240); // 5 - 9 mins
          break;
        case 'casual':
        default:
          finalScore = 50 + Math.floor(rng() * 10); // 50..59
          opponentScore = 12 + Math.floor(rng() * 8); // 12..19 (AI in the 10s)
          baseTimeSec = 380 + Math.floor(rng() * 300); // 6 - 11 mins
          break;
      }
    } else {
      // Generate realistic Azul final score and margin based on skill tier for master/extreme
      let targetDiff: number;

      switch (bot.skillTier) {
        case 'top':
          targetDiff = 12 + Math.floor(rng() * 14); // +12 to +25
          baseTimeSec = 240 + Math.floor(rng() * 200); // 4 - 7 mins
          break;
        case 'strong':
          targetDiff = 4 + Math.floor(rng() * 12); // +4 to +15
          baseTimeSec = 300 + Math.floor(rng() * 240); // 5 - 9 mins
          break;
        case 'average':
          targetDiff = -3 + Math.floor(rng() * 10); // -3 to +6
          baseTimeSec = 360 + Math.floor(rng() * 300); // 6 - 11 mins
          break;
        case 'casual':
        default:
          targetDiff = -10 + Math.floor(rng() * 10); // -10 to -1
          baseTimeSec = 420 + Math.floor(rng() * 360); // 7 - 13 mins
          break;
      }

      // Opponent score typical 50 - 75
      opponentScore = 52 + Math.floor(rng() * 20);
      finalScore = opponentScore + targetDiff;
    }

    const elapsedMs = baseTimeSec * 1000 + Math.floor(rng() * 999);
    const rounds = 5 + Math.floor(rng() * 2); // 5 or 6 rounds
    const attempts = 1 + Math.floor(rng() * 3); // 1 to 3 attempts

    return {
      userId: bot.id,
      displayName: bot.name,
      aiLevel,
      finalScore,
      opponentScore,
      elapsedMs,
      rounds,
      attempts,
    };
  }

  for (const bot of expertBots) {
    results.push(generateScore(bot, 'expert'));
  }
  for (const bot of masterBots) {
    results.push(generateScore(bot, 'master'));
  }
  for (const bot of extremeBots) {
    results.push(generateScore(bot, 'extreme'));
  }

  return results;
}

/**
 * Seeds or updates synthetic bots in the D1 database for the given puzzleId.
 * Only updates or inserts records where is_bot = 1, ensuring real user data is never touched.
 */
export async function seedOrUpdateBots(
  db: D1Database,
  puzzleId: string,
  now = Date.now(),
): Promise<number> {
  const botScores = generateDailyBotScores(puzzleId);
  const statements: D1PreparedStatement[] = [];

  for (const score of botScores) {
    statements.push(
      db
        .prepare(
          `INSERT INTO scores (puzzle_id, user_id, display_name, elapsed_ms, final_score,
                               opponent_score, ai_level, rounds, client_version, replay,
                               verified, attempts, is_bot, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1.0.0', NULL, 0, ?, 1, ?, ?)
           ON CONFLICT (puzzle_id, user_id, ai_level) DO UPDATE SET
             display_name = excluded.display_name,
             elapsed_ms = excluded.elapsed_ms,
             final_score = excluded.final_score,
             opponent_score = excluded.opponent_score,
             rounds = excluded.rounds,
             attempts = excluded.attempts,
             updated_at = excluded.updated_at
           WHERE scores.is_bot = 1`,
        )
        .bind(
          puzzleId,
          score.userId,
          score.displayName,
          score.elapsedMs,
          score.finalScore,
          score.opponentScore,
          score.aiLevel,
          score.rounds,
          score.attempts,
          now,
          now,
        ),
    );
  }

  if (statements.length > 0) {
    await db.batch(statements);
  }

  return statements.length;
}
