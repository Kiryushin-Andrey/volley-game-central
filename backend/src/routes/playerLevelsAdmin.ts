import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  compareUsersForPlayerLevelsList,
  isValidPlayerLevel,
  type PlayerLevel,
} from '../domain/playerLevel';
import {
  mapPlayerLevelMetadata,
  playerLevelMetadataJoin,
  playerLevelMetadataSelect,
  playerLevelSetter,
} from '../utils/playerLevelUser';
import { getUserSelectFields } from '../utils/dbQueryUtils';

const router = Router();

function mapListRow(
  row: {
    id: number;
    displayName: string;
    telegramUsername: string | null;
    telegramId: string | null;
    avatarUrl: string | null;
    blockReason: string | null;
    phoneNumber: string | null;
    playerLevel: string | null;
    playerLevelSetAt: Date | null;
    setterId: number | null;
    setterDisplayName: string | null;
  },
) {
  const levelMeta = mapPlayerLevelMetadata(row);
  return {
    id: row.id,
    displayName: row.displayName,
    telegramUsername: row.telegramUsername,
    telegramId: row.telegramId,
    avatarUrl: row.avatarUrl,
    blockReason: row.blockReason,
    phoneNumber: row.phoneNumber,
    ...levelMeta,
  };
}

router.get('/', async (_req, res) => {
  try {
    const rows = await db
      .select({
        ...getUserSelectFields(),
        ...playerLevelMetadataSelect,
      })
      .from(users)
      .leftJoin(playerLevelSetter, playerLevelMetadataJoin());

    const sorted = rows.map(mapListRow).sort(compareUsersForPlayerLevelsList);

    res.json(sorted);
  } catch (error) {
    console.error('Error listing users for player levels:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const rows = await db
      .select({
        ...getUserSelectFields(),
        ...playerLevelMetadataSelect,
      })
      .from(users)
      .leftJoin(playerLevelSetter, playerLevelMetadataJoin())
      .where(eq(users.id, userId))
      .limit(1);

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(mapListRow(rows[0]));
  } catch (error) {
    console.error('Error fetching user for player levels:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.patch('/:userId/player-level', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

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

    const setAt = new Date();
    await db
      .update(users)
      .set({
        playerLevel,
        playerLevelSetById: req.user.id,
        playerLevelSetAt: setAt,
      })
      .where(eq(users.id, userId));

    const rows = await db
      .select({
        ...getUserSelectFields(),
        ...playerLevelMetadataSelect,
      })
      .from(users)
      .leftJoin(playerLevelSetter, playerLevelMetadataJoin())
      .where(eq(users.id, userId))
      .limit(1);

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(mapListRow(rows[0]));
  } catch (error) {
    console.error('Error updating player level:', error);
    res.status(500).json({ error: 'Failed to update player level' });
  }
});

export default router;
