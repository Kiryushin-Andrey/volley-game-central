import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { compareUsersForPlayerLevelsList, parsePlayerLevel } from '../domain/playerLevel';

const router = Router();
const levelSetter = alias(users, 'levelSetter');

type PlayerLevelUserRow = {
  id: number;
  displayName: string;
  telegramUsername: string | null;
  telegramId: string | null;
  avatarUrl: string | null;
  blockReason: string | null;
  phoneNumber: string | null;
  playerLevel: string | null;
  playerLevelSetById: number | null;
  setterDisplayName: string | null;
};

function toAdminUserRow(row: PlayerLevelUserRow) {
  const level = row.playerLevel ? parsePlayerLevel(row.playerLevel) : null;
  const playerLevelSetBy =
    level && row.playerLevelSetById && row.setterDisplayName
      ? { displayName: row.setterDisplayName }
      : null;
  return {
    id: row.id,
    displayName: row.displayName,
    telegramUsername: row.telegramUsername,
    telegramId: row.telegramId ?? '',
    avatarUrl: row.avatarUrl,
    blockReason: row.blockReason,
    phoneNumber: row.phoneNumber,
    playerLevel: level,
    playerLevelSetBy,
  };
}

const adminUserSelect = {
  id: users.id,
  displayName: users.displayName,
  telegramUsername: users.telegramUsername,
  telegramId: users.telegramId,
  avatarUrl: users.avatarUrl,
  blockReason: users.blockReason,
  phoneNumber: users.phoneNumber,
  playerLevel: users.playerLevel,
  playerLevelSetById: users.playerLevelSetById,
  setterDisplayName: levelSetter.displayName,
};

async function fetchAdminUserRow(userId: number): Promise<PlayerLevelUserRow | undefined> {
  const rows = await db
    .select(adminUserSelect)
    .from(users)
    .leftJoin(levelSetter, eq(users.playerLevelSetById, levelSetter.id))
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0];
}

router.get('/users', async (_req, res) => {
  try {
    const rows = await db
      .select(adminUserSelect)
      .from(users)
      .leftJoin(levelSetter, eq(users.playerLevelSetById, levelSetter.id));

    const mapped = rows.map(toAdminUserRow);
    mapped.sort(compareUsersForPlayerLevelsList);
    res.json(mapped);
  } catch (error) {
    console.error('Error listing users for player levels:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.get('/users/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const row = await fetchAdminUserRow(userId);
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(toAdminUserRow(row));
  } catch (error) {
    console.error('Error fetching user for player levels:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.patch('/users/:userId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = parseInt(req.params.userId, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const { playerLevel: rawLevel } = req.body as { playerLevel?: unknown };
    if (rawLevel === null || rawLevel === undefined || rawLevel === '') {
      return res.status(400).json({ error: 'playerLevel is required and cannot be cleared' });
    }

    const playerLevel = parsePlayerLevel(rawLevel);
    if (!playerLevel) {
      return res.status(400).json({ error: 'Invalid playerLevel' });
    }

    const updated = await db
      .update(users)
      .set({
        playerLevel,
        playerLevelSetById: req.user.id,
        playerLevelSetAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (!updated.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = await fetchAdminUserRow(userId);
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(toAdminUserRow(row));
  } catch (error) {
    console.error('Error updating player level:', error);
    res.status(500).json({ error: 'Failed to update player level' });
  }
});

export default router;
