import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  compareUsersForPlayerLevelsList,
  isValidPlayerLevel,
  type PlayerLevel,
} from '../domain/playerLevel';

const router = Router();

router.get('/', async (_req, res) => {
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

    const sorted = rows
      .map((row) => ({
        id: row.id,
        displayName: row.displayName,
        telegramUsername: row.telegramUsername,
        telegramId: row.telegramId,
        avatarUrl: row.avatarUrl,
        blockReason: row.blockReason,
        phoneNumber: row.phoneNumber,
        playerLevel: (row.playerLevel as PlayerLevel | null) ?? null,
      }))
      .sort(compareUsersForPlayerLevelsList);

    res.json(sorted);
  } catch (error) {
    console.error('Error listing users for player levels:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.patch('/:userId/player-level', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const { playerLevel } = req.body as { playerLevel?: unknown };
    if (!isValidPlayerLevel(playerLevel)) {
      return res.status(400).json({
        error: 'playerLevel must be beginner, intermediate, or advanced',
      });
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

    const row = updated[0];
    res.json({
      id: row.id,
      displayName: row.displayName,
      telegramUsername: row.telegramUsername,
      telegramId: row.telegramId,
      avatarUrl: row.avatarUrl,
      blockReason: row.blockReason,
      phoneNumber: row.phoneNumber,
      playerLevel: row.playerLevel as PlayerLevel,
    });
  } catch (error) {
    console.error('Error updating player level:', error);
    res.status(500).json({ error: 'Failed to update player level' });
  }
});

export default router;
