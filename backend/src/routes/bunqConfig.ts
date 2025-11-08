import { Router, Request, Response } from 'express';
import { db } from '../db';
import { bunqCredentials, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { bunqCredentialsService } from '../services/bunqCredentialsService';
import { createInstallation, registerDevice, createSession, fetchMonetaryAccounts, installWebhookFilters } from '../services/bunqService';

const router = Router({ mergeParams: true });

// Base path will be mounted as /users/me/bunq or /users/admin/id/:collectorUserId/bunq in index.ts

/**
 * Helper function to get the target user ID
 * - If collectorUserId is in params (admin route), use that
 * - Otherwise, use req.user.id (user's own route)
 */
function getTargetUserId(req: Request): number | null {
  const params = req.params as { collectorUserId?: string };
  if (params.collectorUserId) {
    const userId = parseInt(params.collectorUserId, 10);
    if (isNaN(userId)) {
      return null;
    }
    return userId;
  }
  return req.user?.id ?? null;
}

/**
 * Type guard to check if req.params has collectorUserId
 */
function hasCollectorUserId(params: unknown): params is { collectorUserId: string } {
  return typeof params === 'object' && params !== null && 'collectorUserId' in params;
}

/**
 * Validates and returns the target user ID, sending error responses if validation fails
 * @param req The Express request object
 * @param res The Express response object
 * @returns The target user ID if valid, or null if validation failed (error response already sent)
 */
async function validateAndGetTargetUserId(
  req: Request, 
  res: Response
): Promise<number | null> {
  // Always require authentication
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }

  const targetUserId = getTargetUserId(req);
  if (!targetUserId) {
    res.status(400).json({ error: 'Invalid user ID' });
    return null;
  }

  // Validate user exists if collectorUserId is provided
  if (hasCollectorUserId(req.params)) {
    const userExists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, targetUserId))
      .then(rows => rows.length > 0);
    
    if (!userExists) {
      res.status(400).json({ error: 'User not found' });
      return null;
    }
  }

  return targetUserId;
}

// Check if Bunq integration is enabled
router.get('/status', async (req, res) => {
  try {
    const targetUserId = await validateAndGetTargetUserId(req, res);
    if (!targetUserId) {
      return;
    }

    const hasCredentials = await db
      .select({ userId: bunqCredentials.userId })
      .from(bunqCredentials)
      .where(eq(bunqCredentials.userId, targetUserId))
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
    const targetUserId = await validateAndGetTargetUserId(req, res);
    if (!targetUserId) {
      return;
    }

    const { apiKey, password, apiKeyName } = req.body as { apiKey?: string; password?: string; apiKeyName?: string };

    if (!apiKey || !password) {
      return res.status(400).json({ error: 'API key and password are required' });
    }

    const apiKeyNameToUse = apiKeyName || 'VolleyBot API Client';

    console.log('Creating installation token...');
    const installationResult = await createInstallation(apiKey, apiKeyNameToUse);
    if (!installationResult) {
      return res.status(400).json({ error: 'Failed to create installation token. Please check your API key.' });
    }

    const { installationToken, privateKey } = installationResult;

    console.log('Registering device...');
    const deviceRegistered = await registerDevice(installationToken, apiKey, apiKeyNameToUse);
    if (!deviceRegistered) {
      return res.status(400).json({ error: 'Failed to register device with Bunq API' });
    }

    console.log('Creating session token...');
    const sessionToken = await createSession(installationToken, apiKey, privateKey, apiKeyNameToUse);
    if (!sessionToken) {
      return res.status(400).json({ error: 'Failed to create session token' });
    }

    console.log('Validating session token by fetching monetary accounts...');
    const monetaryAccounts = await fetchMonetaryAccounts(sessionToken, apiKeyNameToUse);
    if (!monetaryAccounts) {
      return res.status(400).json({ error: 'Failed to validate session token. Unable to fetch monetary accounts.' });
    }

    console.log(`Session token validated successfully. Found ${monetaryAccounts.length} monetary accounts.`);

    const credentialsStored = await bunqCredentialsService.storeAllCredentials(
      targetUserId,
      apiKey,
      apiKeyNameToUse,
      installationToken,
      privateKey,
      sessionToken,
      monetaryAccounts.length > 0 ? monetaryAccounts[0].id : null,
      password
    );

    if (!credentialsStored) {
      return res.status(500).json({ error: 'Failed to store Bunq credentials' });
    }

    console.log('Bunq integration enabled successfully for user:', targetUserId);

    // Attempt to install webhook filters so bunq notifies us on request updates
    await installWebhookFilters(targetUserId, password);

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
    const targetUserId = await validateAndGetTargetUserId(req, res);
    if (!targetUserId) {
      return;
    }

    const deleted = await bunqCredentialsService.deleteCredentials(targetUserId);

    if (!deleted) {
      console.error('Failed to delete credentials for userId:', targetUserId);
      return res.status(500).json({ error: 'Failed to disable Bunq integration' });
    }

    console.log('Bunq integration disabled for user:', targetUserId);
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
    const targetUserId = await validateAndGetTargetUserId(req, res);
    if (!targetUserId) {
      return;
    }

    const { password } = req.body as { password?: string };

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to decrypt credentials'
      });
    }

    const userCredentials = await bunqCredentialsService.getCredentials(targetUserId, password);

    if (!userCredentials || !userCredentials.sessionToken) {
      return res.status(400).json({
        success: false,
        message: 'Bunq integration not enabled or session token not available'
      });
    }

    const apiKeyName = userCredentials.apiKeyName || 'VolleyBot API Client';
    const accounts = await fetchMonetaryAccounts(userCredentials.sessionToken, apiKeyName);

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
    const targetUserId = await validateAndGetTargetUserId(req, res);
    if (!targetUserId) {
      return;
    }

    const { monetaryAccountId } = req.body as { monetaryAccountId?: number };

    if (!monetaryAccountId || typeof monetaryAccountId !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Valid monetary account ID is required'
      });
    }

    const updated = await bunqCredentialsService.updateMonetaryAccountId(targetUserId, monetaryAccountId);

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
  } catch (error: unknown) {
    console.error('Error updating monetary account:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating monetary account'
    });
  }
});

// Manually install Bunq webhook filters
router.post('/webhook/install', async (req, res) => {
  try {
    const targetUserId = await validateAndGetTargetUserId(req, res);
    if (!targetUserId) {
      return;
    }

    const { password } = req.body as { password?: string };
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const result = await installWebhookFilters(targetUserId, password);
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to install webhook filters' });
    }

    console.log('[Bunq] Webhook installed at', result.targetUrl, 'for user', targetUserId);
    return res.json({ success: true, message: 'Webhook installed successfully' });
  } catch (error: unknown) {
    console.error('Error installing Bunq webhook:', error);
    return res.status(500).json({ error: 'Internal server error while installing webhook' });
  }
});

export default router;
