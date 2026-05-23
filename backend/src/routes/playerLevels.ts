import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { compareUsersForPlayerLevelsList, parsePlayerLevel } from '../domain/playerLevel';

const router = Router();

function toAdminUserRow(row: {
  id: number;
  displayName: string;
  telegramUsername: string | null;
  telegramId: string | null;
  avatarUrl: string | null;
  blockReason: string | null;
  phoneNumber: string | null;
  playerLevel: string | null;
}) {
  const level = row.playerLevel ? parsePlayerLevel(row.playerLevel) : null;
  return {
    id: row.id,
    displayName: row.displayName,
    telegramUsername: row.telegramUsername,
    telegramId: row.telegramId ?? '',
    avatarUrl: row.avatarUrl,
    blockReason: row.blockReason,
    phoneNumber: row.phoneNumber,
    playerLevel: level,
  };
}

router.get('/users', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        telegramUsername: users.telegramUsername,
        telegramId: users.telegramId,
        avatarUrl: users.avatarUrl,
        blockReason: users.blockReason,
        phoneNumber: users.phoneNumber,
        playerLevel: users.playerLevel,
      })
      .from(users);

    const mapped = rows.map(toAdminUserRow);
    mapped.sort(compareUsersForPlayerLevelsList);
    res.json(mapped);
  } catch (error) {
    console.error('Error listing users for player levels:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.patch('/users/:userId', async (req, res) => {
  try {
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
      .set({ playerLevel })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        displayName: users.displayName,
        telegramUsername: users.telegramUsername,
        telegramId: users.telegramId,
        avatarUrl: users.avatarUrl,
        blockReason: users.blockReason,
        phoneNumber: users.phoneNumber,
        playerLevel: users.playerLevel,
      });

    if (!updated.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(toAdminUserRow(updated[0]));
  } catch (error) {
    console.error('Error updating player level:', error);
    res.status(500).json({ error: 'Failed to update player level' });
  }
});

export default router;
