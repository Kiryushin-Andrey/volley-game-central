/**
 * One-time broadcast: inform recent registrants about the player-level system and
 * their own assigned level.
 *
 * Audience: players who self-registered for a game in the last 6 months and who have a
 * player_level assigned and a telegram_id. Delivery is Telegram-only.
 *
 * Usage (from backend/):
 *   npx tsx src/scripts/notifyPlayerLevels.ts                     # dry run, full audience
 *   npx tsx src/scripts/notifyPlayerLevels.ts --send              # send to everyone
 *   npx tsx src/scripts/notifyPlayerLevels.ts --user 123 --send   # send to a single player
 *
 * --user accepts an internal users.id (numeric) or a Telegram username (e.g. @handle or
 * handle). When provided, the 6-month recency filter is bypassed so it can be used to
 * test/re-send to one person.
 *
 * IMPORTANT: this script deliberately does NOT import ./services/telegramService — that
 * module launches a Telegram long-polling consumer on import, which would conflict (HTTP 409)
 * with the running production bot. We build a standalone Telegraf sender and only call
 * bot.telegram.sendMessage(...), which never starts a poller.
 */
import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { and, eq, gte, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../db';
import { users, gameRegistrations } from '../db/schema';
import { parsePlayerLevel, type PlayerLevel } from '../domain/playerLevel';
import { INTERMEDIATE_LEVEL_REGISTRATION_OPEN_DAYS } from '../domain/positionsGameRegistrationEligibility';

const PLAYER_LEVEL_LABELS: Record<PlayerLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/** Delay between sends to stay well under Telegram's ~30 msg/sec limit. */
const SEND_DELAY_MS = 150;

interface Recipient {
  id: number;
  telegramId: string;
  telegramUsername: string | null;
  playerLevel: PlayerLevel;
  displayName: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Human-readable handle for logs. */
function formatHandle(username: string | null): string {
  return username ? `@${username}` : '(no username)';
}

interface CliArgs {
  send: boolean;
  user: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  let send = false;
  let user: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--send') {
      send = true;
    } else if (arg === '--dry-run') {
      send = false;
    } else if (arg === '--user') {
      user = argv[i + 1] ?? null;
      i++;
    } else if (arg.startsWith('--user=')) {
      user = arg.slice('--user='.length);
    }
  }
  return { send, user };
}

function buildMessage(level: PlayerLevel): string {
  const intro =
    `🏐 <b>Player levels on 5-1 games</b>\n\n` +
    `5-1 games are advanced-level games played with the 5-1 scheme. To keep the level and ` +
    `manage demand, self-registration for these games now depends on your player level:\n\n` +
    `• <b>Advanced</b> — register as usual as soon as registration opens.\n` +
    `• <b>Intermediate</b> — you can self-register starting ${INTERMEDIATE_LEVEL_REGISTRATION_OPEN_DAYS} days before the game.\n` +
    `• <b>Beginner</b> — self-registration for 5-1 games isn't available; reach out to the ` +
    `experienced members of the group who can help you join and grow into these games.\n\n` +
    `These rules apply to 5-1 games only. Recreational games (e.g. Sunday) are unaffected — ` +
    `everyone registers as usual.`;
  return `${intro}\n\n<b>Your assigned level: ${PLAYER_LEVEL_LABELS[level]}</b>`;
}

/** Normalize a DB row into a Recipient, or return a skip reason. */
function toRecipient(row: {
  id: number;
  telegramId: string | null;
  telegramUsername: string | null;
  playerLevel: string | null;
  displayName: string;
}): Recipient | { skip: string } {
  if (!row.telegramId) return { skip: 'no telegram_id' };
  const level = parsePlayerLevel(row.playerLevel);
  if (!level) return { skip: 'no player level assigned' };
  return {
    id: row.id,
    telegramId: row.telegramId,
    telegramUsername: row.telegramUsername,
    playerLevel: level,
    displayName: row.displayName,
  };
}

async function loadAudience(): Promise<Recipient[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const rows = await db
    .selectDistinct({
      id: users.id,
      telegramId: users.telegramId,
      telegramUsername: users.telegramUsername,
      playerLevel: users.playerLevel,
      displayName: users.displayName,
    })
    .from(users)
    .innerJoin(gameRegistrations, eq(gameRegistrations.userId, users.id))
    .where(
      and(
        gte(gameRegistrations.createdAt, sixMonthsAgo),
        isNull(gameRegistrations.guestName),
        isNotNull(users.playerLevel),
        isNotNull(users.telegramId),
      ),
    );

  return rows.map(toRecipient).filter((r): r is Recipient => !('skip' in r));
}

async function loadSingleUser(userArg: string): Promise<Recipient> {
  const isNumericId = /^\d+$/.test(userArg);
  const username = userArg.replace(/^@/, '');
  const rows = await db
    .select({
      id: users.id,
      telegramId: users.telegramId,
      telegramUsername: users.telegramUsername,
      playerLevel: users.playerLevel,
      displayName: users.displayName,
    })
    .from(users)
    .where(isNumericId ? eq(users.id, Number(userArg)) : eq(users.telegramUsername, username))
    .limit(1);

  if (rows.length === 0) {
    throw new Error(`No user found matching ${isNumericId ? `id ${userArg}` : `telegram username @${username}`}`);
  }
  const result = toRecipient(rows[0]);
  if ('skip' in result) {
    throw new Error(`User ${userArg} is not eligible: ${result.skip}`);
  }
  return result;
}

/** Extract Telegram's retry_after (seconds) from a 429 error, if present. */
function getRetryAfterMs(err: any): number | null {
  const retryAfter = err?.response?.parameters?.retry_after ?? err?.parameters?.retry_after;
  return typeof retryAfter === 'number' ? retryAfter * 1000 : null;
}

async function main(): Promise<void> {
  const { send, user } = parseArgs(process.argv.slice(2));

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set. Aborting.');
    process.exit(1);
  }

  const recipients = user ? [await loadSingleUser(user)] : await loadAudience();

  console.log(`Mode: ${send ? 'SEND' : 'DRY RUN'}${user ? ` (single user: ${user})` : ''}`);
  console.log(`Recipients: ${recipients.length}`);
  for (const r of recipients) {
    console.log(`  - ${r.displayName} (id=${r.id}, username=${formatHandle(r.telegramUsername)}, level=${r.playerLevel})`);
  }

  if (recipients.length === 0) {
    console.log('Nothing to send.');
    process.exit(0);
  }

  if (!send) {
    console.log('\n--- Message preview (per assigned level) ---');
    console.log(buildMessage(recipients[0].playerLevel));
    console.log('\nDry run only. Re-run with --send to deliver.');
    process.exit(0);
  }

  const bot = new Telegraf(token);
  let sent = 0;
  const failures: Array<{ recipient: Recipient; error: string }> = [];

  for (const r of recipients) {
    const message = buildMessage(r.playerLevel);
    const handle = formatHandle(r.telegramUsername);
    try {
      await bot.telegram.sendMessage(r.telegramId, message, { parse_mode: 'HTML' });
      sent++;
      console.log(`Sent to ${r.displayName} (${handle})`);
    } catch (err: any) {
      const retryAfterMs = getRetryAfterMs(err);
      if (retryAfterMs) {
        console.warn(`Rate limited on ${handle}; waiting ${retryAfterMs}ms and retrying once`);
        await sleep(retryAfterMs);
        try {
          await bot.telegram.sendMessage(r.telegramId, message, { parse_mode: 'HTML' });
          sent++;
          console.log(`Sent to ${r.displayName} (${handle}) after retry`);
          await sleep(SEND_DELAY_MS);
          continue;
        } catch (retryErr: any) {
          failures.push({ recipient: r, error: retryErr?.message ?? String(retryErr) });
          console.error(`Failed to send to ${r.displayName} (${handle}) after retry:`, retryErr?.message ?? retryErr);
          await sleep(SEND_DELAY_MS);
          continue;
        }
      }
      failures.push({ recipient: r, error: err?.message ?? String(err) });
      console.error(`Failed to send to ${r.displayName} (${handle}):`, err?.message ?? err);
    }
    await sleep(SEND_DELAY_MS);
  }

  console.log('\n--- Summary ---');
  console.log(`Sent:   ${sent}`);
  console.log(`Failed: ${failures.length}`);
  for (const f of failures) {
    console.log(`  - ${f.recipient.displayName} (${formatHandle(f.recipient.telegramUsername)}): ${f.error}`);
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('notifyPlayerLevels failed:', err);
  process.exit(1);
});
