import { Router } from 'express';
import { db } from '../db';
import { bunqCredentials } from '../db/schema';
import { eq } from 'drizzle-orm';
import { bunqCredentialsService } from '../services/bunqCredentialsService';
import { createInstallation, registerDevice, createSession, fetchMonetaryAccounts } from '../services/bunqService';

const router = Router();

// Base path will be mounted as /users/me/bunq in index.ts

// Check if Bunq integration is enabled for current user
router.get('/status', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

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
router.post('/enable', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { apiKey, password } = req.body as { apiKey?: string; password?: string };

    if (!apiKey || !password) {
      return res.status(400).json({ error: 'API key and password are required' });
    }

    console.log('Creating installation token...');
    const installationResult = await createInstallation(apiKey);
    if (!installationResult) {
      return res.status(400).json({ error: 'Failed to create installation token. Please check your API key.' });
    }

    const { installationToken, privateKey } = installationResult;

    console.log('Registering device...');
    const deviceRegistered = await registerDevice(installationToken, apiKey);
    if (!deviceRegistered) {
      return res.status(400).json({ error: 'Failed to register device with Bunq API' });
    }

    console.log('Creating session token...');
    const sessionToken = await createSession(installationToken, apiKey, privateKey);
    if (!sessionToken) {
      return res.status(400).json({ error: 'Failed to create session token' });
    }

    console.log('Validating session token by fetching monetary accounts...');
    const monetaryAccounts = await fetchMonetaryAccounts(sessionToken);
    if (!monetaryAccounts) {
      return res.status(400).json({ error: 'Failed to validate session token. Unable to fetch monetary accounts.' });
    }

    console.log(`Session token validated successfully. Found ${monetaryAccounts.length} monetary accounts.`);

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
router.delete('/disable', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

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
router.post('/monetary-accounts', async (req, res) => {
  try {
    const { password } = req.body as { password?: string };

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to decrypt credentials'
      });
    }

    const userCredentials = await bunqCredentialsService.getCredentials(req.user!.id, password);

    if (!userCredentials || !userCredentials.sessionToken) {
      return res.status(400).json({
        success: false,
        message: 'Bunq integration not enabled or session token not available'
      });
    }

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
router.put('/monetary-account', async (req, res) => {
  try {
    const { monetaryAccountId } = req.body as { monetaryAccountId?: number };

    if (!monetaryAccountId || typeof monetaryAccountId !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Valid monetary account ID is required'
      });
    }

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

export default router;
