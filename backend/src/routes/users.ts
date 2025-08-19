import { Router } from 'express';
import { db } from '../db';
import { users, bunqCredentials, games, gameRegistrations, paymentRequests } from '../db/schema';
import { eq, and, ne, or, ilike, sql, inArray } from 'drizzle-orm';
import { telegramAuthMiddleware } from '../middleware/telegramAuth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { bunqCredentialsService } from '../services/bunqCredentialsService';
import { createInstallation, registerDevice, createSession, fetchMonetaryAccounts } from '../services/bunqService';
import { getUserUnpaidItems } from '../services/unpaidService';
import { sendTelegramNotification } from '../services/telegramService';

const router = Router();



// Get currently authenticated user
router.get('/me', async (req, res) => {
  try {
    // The user is attached to the request by the telegramAuth middleware
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    res.json(req.user);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Get all users
router.get('/', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Search users by query (username) - Must come before :telegramId route
router.get('/search', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      const error = 'Search query must be at least 2 characters long';
      return res.status(400).json({ error });
    }

    const searchTerm = `%${query.toLowerCase()}%`;
    
    // Search for users where username contains the query (case-insensitive)
    const results = await db
      .select({
        id: users.id,
        username: users.username,
        telegramId: users.telegramId,
        avatarUrl: users.avatarUrl,
        blockReason: users.blockReason,
      })
      .from(users)
      .where(
        ilike(users.username, searchTerm)
      )
      .execute();
    
    res.json(results);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Block a user by telegramId with reason (admin only)
router.post('/:telegramId/block', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { reason } = req.body as { reason?: string };

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const [updated] = await db
      .update(users)
      .set({ blockReason: reason.trim() })
      .where(eq(users.telegramId, telegramId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true, message: 'User blocked', user: updated });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock a user by telegramId (admin only)
router.delete('/:telegramId/block', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { telegramId } = req.params;

    const [updated] = await db
      .update(users)
      .set({ blockReason: null })
      .where(eq(users.telegramId, telegramId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true, message: 'User unblocked', user: updated });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Get user by telegramId
router.get('/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await db.select().from(users).where(eq(users.telegramId, telegramId));
    
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get user by ID
router.get('/id/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.select().from(users).where(eq(users.id, parseInt(userId)));
    
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Bunq Integration Management Routes (Admin only)

// Check if Bunq integration is enabled for current user
router.get('/me/bunq/status', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user has Bunq credentials in database
    const hasCredentials = await db
      .select({ userId: bunqCredentials.userId })
      .from(bunqCredentials)
      .where(eq(bunqCredentials.userId, req.user.id))
      .then(rows => rows.length > 0);

    res.json({ enabled: hasCredentials });
  } catch (error) {
    console.error('Error checking Bunq integration status:', error);
    res.status(500).json({ error: 'Failed to check Bunq integration status' });
  }
});

// Enable Bunq integration
router.post('/me/bunq/enable', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { apiKey, password } = req.body;

    if (!apiKey || !password) {
      return res.status(400).json({ error: 'API key and password are required' });
    }

    // Step 1: Create installation token using API key
    console.log('Creating installation token...');
    const installationResult = await createInstallation(apiKey);
    if (!installationResult) {
      return res.status(400).json({ error: 'Failed to create installation token. Please check your API key.' });
    }
    
    const { installationToken, privateKey } = installationResult;

    // Step 2: Register device
    console.log('Registering device...');
    const deviceRegistered = await registerDevice(installationToken, apiKey);
    if (!deviceRegistered) {
      return res.status(400).json({ error: 'Failed to register device with Bunq API' });
    }

    // Step 3: Create session token
    console.log('Creating session token...');
    const sessionToken = await createSession(installationToken, apiKey, privateKey);
    if (!sessionToken) {
      return res.status(400).json({ error: 'Failed to create session token' });
    }

    // Step 4: Validate session token by fetching monetary accounts
    console.log('Validating session token by fetching monetary accounts...');
    const monetaryAccounts = await fetchMonetaryAccounts(sessionToken);
    if (!monetaryAccounts) {
      return res.status(400).json({ error: 'Failed to validate session token. Unable to fetch monetary accounts.' });
    }

    console.log(`Session token validated successfully. Found ${monetaryAccounts.length} monetary accounts.`);

    // Step 5: Store all credentials at once
    const credentialsStored = await bunqCredentialsService.storeAllCredentials(
      req.user.id,
      apiKey,
      installationToken,
      privateKey,
      sessionToken,
      monetaryAccounts.length > 0 ? monetaryAccounts[0].id : null,
      password
    );

    if (!credentialsStored) {
      return res.status(500).json({ error: 'Failed to store Bunq credentials' });
    }

    console.log('Bunq integration enabled successfully for user:', req.user.id);
    res.json({ 
      success: true, 
      message: 'Bunq integration enabled successfully. You can now configure your monetary account.' 
    });
  } catch (error) {
    console.error('Error enabling Bunq integration:', error);
    res.status(500).json({ error: 'Failed to enable Bunq integration' });
  }
});

// Disable Bunq integration
router.delete('/me/bunq/disable', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Delete all Bunq credentials for the user
    const deleted = await bunqCredentialsService.deleteCredentials(req.user.id);

    if (!deleted) {
      return res.status(500).json({ error: 'Failed to disable Bunq integration' });
    }

    console.log('Bunq integration disabled for user:', req.user.id);
    res.json({ 
      success: true, 
      message: 'Bunq integration disabled successfully' 
    });
  } catch (error) {
    console.error('Error disabling Bunq integration:', error);
    res.status(500).json({ error: 'Failed to disable Bunq integration' });
  }
});

// Get monetary accounts for Bunq integration
router.post('/me/bunq/monetary-accounts', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required to decrypt credentials' 
      });
    }

    // Get user's Bunq credentials to retrieve session token
    const userCredentials = await bunqCredentialsService.getCredentials(req.user!.id, password);
    
    if (!userCredentials || !userCredentials.sessionToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bunq integration not enabled or session token not available' 
      });
    }

    // Fetch monetary accounts from Bunq API
    const accounts = await fetchMonetaryAccounts(userCredentials.sessionToken);
    
    if (!accounts) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch monetary accounts from Bunq' 
      });
    }

    res.json({ 
      success: true, 
      accounts: accounts.map(account => ({
        id: account.id,
        description: account.description
      }))
    });
  } catch (error: any) {
    console.error('Error fetching monetary accounts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error while fetching monetary accounts' 
    });
  }
});

// Update monetary account ID for Bunq integration
router.put('/me/bunq/monetary-account', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const { monetaryAccountId } = req.body;
    
    if (!monetaryAccountId || typeof monetaryAccountId !== 'number') {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid monetary account ID is required' 
      });
    }

    // Update monetary account ID in the database
    const updated = await bunqCredentialsService.updateMonetaryAccountId(req.user!.id, monetaryAccountId);
    
    if (!updated) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to update monetary account ID' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Monetary account updated successfully' 
    });
  } catch (error: any) {
    console.error('Error updating monetary account:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error while updating monetary account' 
    });
  }
});

// Current user: Get unpaid games (grouped per game)
// Returns one entry per game with total amount and paymentLink (if exists), excluding waitlist
router.get('/me/unpaid-games', telegramAuthMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const result = await getUserUnpaidItems(req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error fetching unpaid games for current user:', error);
    res.status(500).json({ error: 'Failed to fetch unpaid games' });
  }
});

// Admin-only: Get unpaid games (grouped per game) for a specific user
// Returns one entry per game with total amount and paymentLink (if exists), excluding waitlist
router.get('/id/:userId/unpaid-games', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
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

// Admin-only: Send a payment reminder to a specific user for their unpaid games
router.post('/id/:userId/payment-reminder', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    // Load the user to get telegramId
    const targetUsers = await db.select().from(users).where(eq(users.id, userId));
    if (targetUsers.length === 0 || !targetUsers[0].telegramId) {
      return res.status(404).json({ error: 'User not found or missing Telegram ID' });
    }

    const items = await getUserUnpaidItems(userId);
    if (items.length === 0) {
      return res.json({ success: true, message: 'No unpaid payment requests found for this user', remindersSent: 0 });
    }

    const lines: string[] = [];
    lines.push('💰 <b>Payment reminder</b>');
    lines.push('You still have unpaid registrations:');
    for (const it of items) {
      const formattedDate = it.dateTime.toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
      const location = it.locationName ? ` • ${it.locationName}` : '';
      const amountPart = it.totalAmountCents != null ? ` — €${(it.totalAmountCents / 100).toFixed(2)}` : '';
      const linkPart = it.paymentLink ? ` — <a href="${it.paymentLink}">pay link</a>` : '';
      lines.push(`• ${formattedDate}${location}${amountPart}${linkPart}`);
    }

    const message = lines.join('\n');
    await sendTelegramNotification(targetUsers[0].telegramId!, message);

    return res.json({ success: true, message: 'Reminder sent', remindersSent: 1, items: items.length });
  } catch (error) {
    console.error('Error sending payment reminder:', error);
    res.status(500).json({ error: 'Failed to send payment reminder' });
  }
});

export default router;
