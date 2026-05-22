import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import {
  compareUsersForPlayerLevelsList,
  isValidPlayerLevel,
  type PlayerLevel,
} from '../domain/playerLevel';

const router = Router();

/** All users for player-levels admin list (global admin only). */
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
      .from(users)
      .execute();

    const sorted = rows
      .map((row) => ({
        ...row,
        playerLevel: (row.playerLevel as PlayerLevel | null) ?? null,
      }))
      .sort(compareUsersForPlayerLevelsList);

    res.json(sorted);
  } catch (error) {
    console.error('Error listing admin users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/** Set player level (reject clearing to unassigned). */
router.patch('/users/:userId/player-level', async (req, res) => {
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

    const updatedResult = await db
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
      }) as InferSelectModel<typeof users>[];

    const updated = updatedResult[0];
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: updated.id,
      displayName: updated.displayName,
      telegramUsername: updated.telegramUsername,
      telegramId: updated.telegramId,
      avatarUrl: updated.avatarUrl,
      blockReason: updated.blockReason,
      phoneNumber: updated.phoneNumber,
      playerLevel: updated.playerLevel,
    });
  } catch (error) {
    console.error('Error updating player level:', error);
    res.status(500).json({ error: 'Failed to update player level' });
  }
});

export default router;
