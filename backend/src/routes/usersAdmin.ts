import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq, or, ilike } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { getUserUnpaidItems } from '../services/unpaidService';
import { notifyUser } from '../services/notificationService';
import { formatGameDateShort } from '../utils/dateUtils';

const router = Router();

// Search users by query (displayName or telegramUsername)
router.get('/search', async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 1) {
      const error = 'Search query must be at least 1 character long';
      return res.status(400).json({ error });
    }

    const searchTerm = `%${query.toLowerCase()}%`;

    const results = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        telegramUsername: users.telegramUsername,
        telegramId: users.telegramId,
        avatarUrl: users.avatarUrl,
        blockReason: users.blockReason,
      })
      .from(users)
      .where(or(ilike(users.displayName, searchTerm), ilike(users.telegramUsername, searchTerm)))
      .execute();

    res.json(results);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Block a user by ID with reason
router.post('/id/:userId/block', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { reason } = req.body as { reason?: string };

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const updatedResult = await db
      .update(users)
      .set({ 
        blockReason: reason.trim(),
        blockedById: req.user.id
      })
      .where(eq(users.id, userId))
      .returning() as InferSelectModel<typeof users>[];

    const updated = updatedResult[0];
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true, message: 'User blocked', user: updated });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock a user by ID
router.delete('/id/:userId/block', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const updatedResult = await db
      .update(users)
      .set({ 
        blockReason: null,
        blockedById: null
      })
      .where(eq(users.id, userId))
      .returning() as InferSelectModel<typeof users>[];

    const updated = updatedResult[0];
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true, message: 'User unblocked', user: updated });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Get unpaid games (grouped per game) for a specific user
router.get('/id/:userId/unpaid-games', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    const result = await getUserUnpaidItems(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching unpaid games for user:', error);
    res.status(500).json({ error: 'Failed to fetch unpaid games' });
  }
});

// Send a payment reminder to a specific user for their unpaid games
router.post('/id/:userId/payment-reminder', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const targetUsers = await db.select().from(users).where(eq(users.id, userId));
    if (targetUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const items = await getUserUnpaidItems(userId);
    if (items.length === 0) {
      return res.json({ success: true, message: 'No unpaid payment requests found for this user', remindersSent: 0 });
    }

    const lines: string[] = [];
    lines.push('💰 <b>Payment reminder</b>');
    lines.push('You still have unpaid registrations:');
    for (const it of items) {
      const formattedDate = formatGameDateShort(it.dateTime);
      const location = it.locationName ? ` • ${it.locationName}` : '';
      const amountPart = it.totalAmountCents != null ? ` — €${(it.totalAmountCents / 100).toFixed(2)}` : '';
      const linkPart = it.paymentLink ? ` — <a href="${it.paymentLink}">pay link</a>` : '';
      lines.push(`• ${formattedDate}${location}${amountPart}${linkPart}`);
    }

    const message = lines.join('\n');
    await notifyUser(targetUsers[0], message);

    return res.json({ success: true, message: 'Reminder sent', remindersSent: 1, items: items.length });
  } catch (error) {
    console.error('Error sending payment reminder:', error);
    res.status(500).json({ error: 'Failed to send payment reminder' });
  }
});

// Get user by ID (must be after more specific routes like /id/:userId/unpaid-games)
router.get('/id/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
