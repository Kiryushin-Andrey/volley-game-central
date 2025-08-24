import express from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { authSessions, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { sendSms } from '../services/smsService';
import jwt from 'jsonwebtoken';

const router = express.Router();

function normalizePhone(input: string): string {
  return input.replace(/\s|\-|\(|\)/g, '');
}

function generateCode(length = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min)).toString();
}

const RESEND_COOLDOWN_MS = 60_000; // 60 seconds cooldown between code sends

// Start authentication: create/update session and send SMS with code
router.post('/start', async (req, res) => {
  try {
    const { phoneNumber } = req.body as { phoneNumber?: string };
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({ error: 'phoneNumber is required' });
    }

    const normalized = normalizePhone(phoneNumber);
    // Dutch phone numbers must start with +31 and contain 9 digits after the country code
    if (!/^\+31\d{9}$/.test(normalized)) {
      return res.status(400).json({ error: 'phoneNumber must be a valid Dutch number starting with +31' });
    }

    const code = generateCode(6);

    // Check if session exists for this phone
    const existing = await db.select().from(authSessions).where(eq(authSessions.phoneNumber, normalized));
    let sessionId: string;

    if (existing.length > 0) {
      // Enforce cooldown for resending code on existing session
      const session = existing[0] as typeof existing[number] & { createdAt: Date };
      const lastTs = new Date(session.createdAt).getTime();
      const nowTs = Date.now();
      const elapsed = nowTs - lastTs;
      if (elapsed < RESEND_COOLDOWN_MS) {
        const retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        res.setHeader('Retry-After', String(retryAfterSec));
        return res.status(429).json({ error: `Please wait ${retryAfterSec}s before requesting a new code`, retryAfterSec });
      }

      // Update existing session (new code and timestamp)
      sessionId = session.id as string;
      await db
        .update(authSessions)
        .set({ authCode: code, createdAt: new Date() })
        .where(eq(authSessions.phoneNumber, normalized));
    } else {
      // Create new session
      sessionId = randomUUID();
      await db.insert(authSessions).values({
        id: sessionId,
        phoneNumber: normalized,
        authCode: code,
      });
    }

    // Send SMS
    const appName = process.env.APP_NAME || 'VolleyBot';
    await sendSms(normalized, `Your ${appName} login code: ${code}`);

    return res.json({ success: true, sessionId });
  } catch (err) {
    console.error('Error starting auth:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify code and issue JWT cookie if user exists
router.post('/verify', async (req, res) => {
  try {
    const { sessionId, code } = req.body as { sessionId?: string; code?: string };
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'code is required' });
    }

    // Fetch session
    const sessionRows = await db.select().from(authSessions).where(eq(authSessions.id, sessionId));
    if (sessionRows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRows[0]

    // Validate code
    if (session.authCode !== code) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    // Check if user exists
    const userRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNumber, session.phoneNumber));

    if (userRows.length > 0) {
      const userId = userRows[0].id as number;
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error('JWT_SECRET is not configured');
        return res.status(500).json({ error: 'Server misconfiguration' });
      }
      const token = jwt.sign({ userId }, secret, { expiresIn: '7d' });

      // Set HttpOnly cookie for 7 days
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      res.cookie('auth_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: weekMs,
      });

      return res.json({ success: true, userExists: true });
    } else {
      // Mark session as creating new user
      await db
        .update(authSessions)
        .set({ creatingNewUser: true })
        .where(eq(authSessions.id, sessionId));

      return res.json({ success: true, userExists: false, creatingNewUser: true });
    }
  } catch (err) {
    console.error('Error verifying auth code:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Check if a display name is available for a session in user-creation mode
// - Expects: { sessionId: string, displayName: string }
// - Validates session exists and has creatingNewUser=true
// - Returns: { available: boolean }
router.post('/check-display-name', async (req, res) => {
  try {
    const { sessionId, displayName } = req.body as { sessionId?: string; displayName?: string };
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    if (!displayName || typeof displayName !== 'string') {
      return res.status(400).json({ error: 'displayName is required' });
    }

    const safeDisplayName = displayName.trim();
    if (safeDisplayName.length === 0) {
      return res.status(400).json({ error: 'displayName must not be empty' });
    }
    if (safeDisplayName.length > 255) {
      return res.status(400).json({ error: 'displayName must be at most 255 characters' });
    }

    // Validate session and state
    const sessionRows = await db.select().from(authSessions).where(eq(authSessions.id, sessionId));
    if (sessionRows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!sessionRows[0].creatingNewUser) {
      return res.status(400).json({ error: 'Session is not in user creation mode' });
    }

    // Check display name uniqueness
    const nameRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.displayName, safeDisplayName));

    return res.json({ available: nameRows.length === 0 });
  } catch (err) {
    console.error('Error checking display name availability:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new user using a verified auth session
// - Expects: { sessionId: string, displayName: string }
// - The session must have creatingNewUser=true (set by /verify when user doesn't exist)
// - Ensures displayName uniqueness
// - Creates the user, deletes the auth session, and issues JWT cookie
router.post('/create-user', async (req, res) => {
  try {
    const { sessionId, displayName } = req.body as { sessionId?: string; displayName?: string };
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'displayName is required' });
    }

    const safeDisplayName = displayName.trim();
    if (safeDisplayName.length > 255) {
      return res.status(400).json({ error: 'displayName must be at most 255 characters' });
    }

    // Fetch session
    const sessionRows = await db.select().from(authSessions).where(eq(authSessions.id, sessionId));
    if (sessionRows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRows[0];

    // Ensure the session is in creating new user state
    if (!session.creatingNewUser) {
      return res.status(400).json({ error: 'Session is not authorized for creating a new user' });
    }

    // Ensure display name is unique
    const existingName = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.displayName, safeDisplayName));
    if (existingName.length > 0) {
      return res.status(409).json({ error: 'Display name is already taken' });
    }

    // Create user with phone number from session
    const [newUser] = await db
      .insert(users)
      .values({
        displayName: safeDisplayName,
        phoneNumber: session.phoneNumber,
      })
      .returning();

    // Delete the auth session (consume it)
    await db.delete(authSessions).where(eq(authSessions.id, sessionId));

    // Issue JWT cookie
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not configured');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }
    const token = jwt.sign({ userId: newUser.id }, secret, { expiresIn: '7d' });

    const weekMs = 7 * 24 * 60 * 60 * 1000;
    res.cookie('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: weekMs,
    });

    return res.json({ success: true, userCreated: true, userId: newUser.id });
  } catch (err) {
    console.error('Error creating user from session:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout: clear JWT cookie for browser sessions
router.post('/logout', async (_req, res) => {
  try {
    // Clear the same cookie as set during verify/create-user
    res.clearCookie('auth_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('Error during logout:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
