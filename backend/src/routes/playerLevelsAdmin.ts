import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { asc, eq, ilike, or, sql } from 'drizzle-orm';
import { PLAYER_SKILL_LEVELS, type PlayerSkillLevel } from '../types/gamePlayMode';

const router = Router();

const levelOrderSql = sql`(case 
  when ${users.playerLevel} is null then 0 
  when ${users.playerLevel} = 'advanced' then 1 
  when ${users.playerLevel} = 'intermediate' then 2 
  else 3 end)`;

router.get('/levels', async (_req, res) => {
  try {
    const page = Math.max(1, parseInt(String(_req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(_req.query.limit ?? '50'), 10) || 50));
    const offset = (page - 1) * limit;
    const q = typeof _req.query.q === 'string' ? _req.query.q.trim() : '';

    const searchCond =
      q.length > 0
        ? or(ilike(users.displayName, `%${q}%`), ilike(users.telegramUsername, `%${q}%`))
        : undefined;

    const countRows = searchCond
      ? await db.select({ count: sql<number>`count(*)::int` }).from(users).where(searchCond)
      : await db.select({ count: sql<number>`count(*)::int` }).from(users);

    const total = countRows[0]?.count ?? 0;

    const rows = searchCond
      ? await db
          .select({
            id: users.id,
            displayName: users.displayName,
            telegramUsername: users.telegramUsername,
            telegramId: users.telegramId,
            avatarUrl: users.avatarUrl,
            playerLevel: users.playerLevel,
          })
          .from(users)
          .where(searchCond)
          .orderBy(levelOrderSql, asc(users.displayName))
          .limit(limit)
          .offset(offset)
      : await db
          .select({
            id: users.id,
            displayName: users.displayName,
            telegramUsername: users.telegramUsername,
            telegramId: users.telegramId,
            avatarUrl: users.avatarUrl,
            playerLevel: users.playerLevel,
          })
          .from(users)
          .orderBy(levelOrderSql, asc(users.displayName))
          .limit(limit)
          .offset(offset);

    res.json({
      users: rows,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error listing player levels:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.patch('/:id/level', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    if (!Object.prototype.hasOwnProperty.call(req.body, 'playerLevel')) {
      return res.status(400).json({ error: 'playerLevel is required' });
    }

    const raw = req.body.playerLevel as unknown;
    if (raw !== null && (typeof raw !== 'string' || !PLAYER_SKILL_LEVELS.includes(raw as PlayerSkillLevel))) {
      return res.status(400).json({ error: 'Invalid playerLevel' });
    }

    const updatedResult = await db
      .update(users)
      .set({ playerLevel: raw === null ? null : (raw as PlayerSkillLevel) })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        displayName: users.displayName,
        telegramUsername: users.telegramUsername,
        telegramId: users.telegramId,
        avatarUrl: users.avatarUrl,
        playerLevel: users.playerLevel,
      });

    const updated = updatedResult[0];
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating player level:', error);
    res.status(500).json({ error: 'Failed to update player level' });
  }
});

export default router;
