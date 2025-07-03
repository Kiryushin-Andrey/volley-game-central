import { Router } from 'express';
import { db } from '../db';
import { users, bunqCredentials } from '../db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { telegramAuthMiddleware } from '../middleware/telegramAuth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { bunqCredentialsService } from '../services/bunqCredentialsService';
import { createInstallation, registerDevice, createSession, fetchMonetaryAccounts } from '../services/bunqService';

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
      null, // monetaryAccountId will be set later
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

export default router;
