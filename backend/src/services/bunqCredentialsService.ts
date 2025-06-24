import { db } from '../db';
import { bunqCredentials, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { encryptionUtils } from '../utils/encryptionUtils';

/**
 * Interface for Bunq credentials
 */
interface BunqCredentials {
  apiKey: string;
  installationToken?: string;
  sessionToken?: string;
}

/**
 * Interface for encrypted Bunq credentials as stored in the database
 */
interface EncryptedBunqCredentials {
  userId: number;
  
  // API Key
  apiKeyEncrypted: string;
  apiKeyIv: string;
  apiKeyAuthTag: string;
  apiKeySalt: string;
  
  // Installation Token
  installationTokenEncrypted: string | null;
  installationTokenIv: string | null;
  installationTokenAuthTag: string | null;
  installationTokenSalt: string | null;
  
  // Session Token
  sessionTokenEncrypted: string | null;
  sessionTokenIv: string | null;
  sessionTokenAuthTag: string | null;
  sessionTokenSalt: string | null;
  
  // Timestamps for each credential type
  apiKeyUpdatedAt: Date | null;
  installationTokenUpdatedAt: Date | null;
  sessionTokenUpdatedAt: Date | null;
}

/**
 * Service for managing Bunq credentials
 */
export const bunqCredentialsService = {
  /**
   * Check if a user exists
   * @param userId User ID
   * @returns True if user exists, false otherwise
   */
  async checkUserExists(userId: number): Promise<boolean> {
    return await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .then(rows => rows.length > 0);
  },

  /**
   * Store API key for a user
   * @param userId User ID
   * @param apiKey API key to store
   * @param password Password for encryption
   * @returns True if successful, false otherwise
   * @description Storing a new API key will reset installation token and session token to null
   */
  async storeApiKey(userId: number, apiKey: string, password: string): Promise<boolean> {
    try {
      // Check if user exists
      const userExists = await this.checkUserExists(userId);
      if (!userExists) {
        console.error(`User with ID ${userId} not found`);
        return false;
      }
      
      // Generate salt and encrypt API key
      const apiKeySalt = encryptionUtils.generateSalt();
      const apiKeyKey = encryptionUtils.deriveKey(password, apiKeySalt);
      const encryptedApiKey = encryptionUtils.encrypt(apiKey, apiKeyKey);
      
      // Check if credentials already exist for this user
      const existingCredentials = await db
        .select({ userId: bunqCredentials.userId })
        .from(bunqCredentials)
        .where(eq(bunqCredentials.userId, userId))
        .then(rows => rows.length > 0);
      
      if (existingCredentials) {
        // Update existing credentials and reset installation and session tokens
        await db
          .update(bunqCredentials)
          .set({
            apiKeyEncrypted: encryptedApiKey.encrypted,
            apiKeyIv: encryptedApiKey.iv,
            apiKeyAuthTag: encryptedApiKey.authTag,
            apiKeySalt,
            
            // Reset installation token
            installationTokenEncrypted: null,
            installationTokenIv: null,
            installationTokenAuthTag: null,
            installationTokenSalt: null,
            
            // Reset session token
            sessionTokenEncrypted: null,
            sessionTokenIv: null,
            sessionTokenAuthTag: null,
            sessionTokenSalt: null,
            
            apiKeyUpdatedAt: new Date(),
            installationTokenUpdatedAt: null,
            sessionTokenUpdatedAt: null
          })
          .where(eq(bunqCredentials.userId, userId));
      } else {
        // Insert new credentials
        await db
          .insert(bunqCredentials)
          .values({
            userId,
            
            apiKeyEncrypted: encryptedApiKey.encrypted,
            apiKeyIv: encryptedApiKey.iv,
            apiKeyAuthTag: encryptedApiKey.authTag,
            apiKeySalt,
            
            // No installation token
            installationTokenEncrypted: null,
            installationTokenIv: null,
            installationTokenAuthTag: null,
            installationTokenSalt: null,
            
            // No session token
            sessionTokenEncrypted: null,
            sessionTokenIv: null,
            sessionTokenAuthTag: null,
            sessionTokenSalt: null,
            
            // Timestamps
            apiKeyUpdatedAt: new Date(),
            installationTokenUpdatedAt: null,
            sessionTokenUpdatedAt: null
          });
      }
      
      return true;
    } catch (error: any) {
      console.error('Error storing Bunq API key:', error);
      return false;
    }
  },
  
  /**
   * Store installation token for a user
   * @param userId User ID
   * @param installationToken Installation token to store
   * @param password Password for encryption
   * @returns True if successful, false otherwise
   * @description Storing a new installation token will reset session token to null
   */
  async storeInstallationToken(userId: number, installationToken: string, password: string): Promise<boolean> {
    try {
      // Check if user exists and has API key
      const credentials = await db
        .select()
        .from(bunqCredentials)
        .where(eq(bunqCredentials.userId, userId))
        .then(rows => rows[0]);
      
      if (!credentials) {
        console.error(`No Bunq credentials found for user ${userId}. API key must be stored first.`);
        return false;
      }
      
      // Generate salt and encrypt installation token
      const installationTokenSalt = encryptionUtils.generateSalt();
      const installationTokenKey = encryptionUtils.deriveKey(password, installationTokenSalt);
      const encrypted = encryptionUtils.encrypt(installationToken, installationTokenKey);
      
      // Update credentials and reset session token
      await db
        .update(bunqCredentials)
        .set({
          // Keep existing API key
          
          // Update installation token
          installationTokenEncrypted: encrypted.encrypted,
          installationTokenIv: encrypted.iv,
          installationTokenAuthTag: encrypted.authTag,
          installationTokenSalt,
          
          // Reset session token
          sessionTokenEncrypted: null,
          sessionTokenIv: null,
          sessionTokenAuthTag: null,
          sessionTokenSalt: null,
          
          installationTokenUpdatedAt: new Date(),
          sessionTokenUpdatedAt: null
        })
        .where(eq(bunqCredentials.userId, userId));
      
      return true;
    } catch (error: any) {
      console.error('Error storing Bunq installation token:', error);
      return false;
    }
  },
  
  /**
   * Store session token for a user
   * @param userId User ID
   * @param sessionToken Session token to store
   * @param password Password for encryption
   * @returns True if successful, false otherwise
   */
  async storeSessionToken(userId: number, sessionToken: string, password: string): Promise<boolean> {
    try {
      // Check if user exists and has API key and installation token
      const credentials = await db
        .select()
        .from(bunqCredentials)
        .where(eq(bunqCredentials.userId, userId))
        .then(rows => rows[0]);
      
      if (!credentials) {
        console.error(`No Bunq credentials found for user ${userId}. API key must be stored first.`);
        return false;
      }
      
      if (!credentials.installationTokenEncrypted) {
        console.error(`No installation token found for user ${userId}. Installation token must be stored first.`);
        return false;
      }
      
      // Generate salt and encrypt session token
      const sessionTokenSalt = encryptionUtils.generateSalt();
      const sessionTokenKey = encryptionUtils.deriveKey(password, sessionTokenSalt);
      const encrypted = encryptionUtils.encrypt(sessionToken, sessionTokenKey);
      
      // Update credentials
      await db
        .update(bunqCredentials)
        .set({
          // Keep existing API key and installation token
          
          // Update session token
          sessionTokenEncrypted: encrypted.encrypted,
          sessionTokenIv: encrypted.iv,
          sessionTokenAuthTag: encrypted.authTag,
          sessionTokenSalt,
          
          sessionTokenUpdatedAt: new Date()
        })
        .where(eq(bunqCredentials.userId, userId));
      
      return true;
    } catch (error: any) {
      console.error('Error storing Bunq session token:', error);
      return false;
    }
  },
  
  /**
   * Retrieve Bunq credentials for a user
   * @param userId User ID
   * @param password Password for decryption
   * @returns Decrypted Bunq credentials or null if not found
   */
  async getCredentials(userId: number, password: string): Promise<BunqCredentials | null> {
    try {
      // Get encrypted credentials from database
      const encryptedCredentials = await db
        .select()
        .from(bunqCredentials)
        .where(eq(bunqCredentials.userId, userId))
        .then(rows => rows[0] as EncryptedBunqCredentials | undefined);
      
      if (!encryptedCredentials) {
        console.error(`No Bunq credentials found for user ${userId}`);
        return null;
      }
      
      // Decrypt API key
      const apiKeyKey = encryptionUtils.deriveKey(password, encryptedCredentials.apiKeySalt);
      const apiKey = encryptionUtils.decrypt(
        encryptedCredentials.apiKeyEncrypted,
        encryptedCredentials.apiKeyIv,
        encryptedCredentials.apiKeyAuthTag,
        apiKeyKey
      );
      
      // Decrypt installation token if available
      let installationToken: string | undefined;
      if (
        encryptedCredentials.installationTokenEncrypted &&
        encryptedCredentials.installationTokenIv &&
        encryptedCredentials.installationTokenAuthTag &&
        encryptedCredentials.installationTokenSalt
      ) {
        const installationTokenKey = encryptionUtils.deriveKey(
          password,
          encryptedCredentials.installationTokenSalt
        );
        
        installationToken = encryptionUtils.decrypt(
          encryptedCredentials.installationTokenEncrypted,
          encryptedCredentials.installationTokenIv,
          encryptedCredentials.installationTokenAuthTag,
          installationTokenKey
        );
      }
      
      // Decrypt session token if available
      let sessionToken: string | undefined;
      if (
        encryptedCredentials.sessionTokenEncrypted &&
        encryptedCredentials.sessionTokenIv &&
        encryptedCredentials.sessionTokenAuthTag &&
        encryptedCredentials.sessionTokenSalt
      ) {
        const sessionTokenKey = encryptionUtils.deriveKey(
          password,
          encryptedCredentials.sessionTokenSalt
        );
        
        sessionToken = encryptionUtils.decrypt(
          encryptedCredentials.sessionTokenEncrypted,
          encryptedCredentials.sessionTokenIv,
          encryptedCredentials.sessionTokenAuthTag,
          sessionTokenKey
        );
      }
      
      return {
        apiKey,
        installationToken,
        sessionToken
      };
    } catch (error: any) {
      console.error('Error retrieving Bunq credentials:', error);
      return null;
    }
  },
  
  /**
   * Delete Bunq credentials for a user
   * @param userId User ID
   * @returns True if successful, false otherwise
   */
  async deleteCredentials(userId: number): Promise<boolean> {
    try {
      await db
        .delete(bunqCredentials)
        .where(eq(bunqCredentials.userId, userId));
      
      return true;
    } catch (error: any) {
      console.error('Error deleting Bunq credentials:', error);
      return false;
    }
  }
};
