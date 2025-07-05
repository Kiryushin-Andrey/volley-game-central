import { db } from '../db';
import { bunqCredentials, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { encryptionUtils } from '../utils/encryptionUtils';

/**
 * Interface for Bunq credentials
 */
export interface BunqCredentials {
  apiKey: string;
  monetaryAccountId?: number;
  installationToken?: string;
  privateKey?: string;
  sessionToken?: string;
}

/**
 * Interface for encrypted Bunq credentials as stored in the database
 */
interface EncryptedBunqCredentials {
  userId: number;
  
  // Monetary Account ID (unencrypted)
  monetaryAccountId: number | null;
  
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
  
  // Private Key
  privateKeyEncrypted: string | null;
  privateKeyIv: string | null;
  privateKeyAuthTag: string | null;
  privateKeySalt: string | null;
  
  // Session Token
  sessionTokenEncrypted: string | null;
  sessionTokenIv: string | null;
  sessionTokenAuthTag: string | null;
  sessionTokenSalt: string | null;
  
  // Timestamps for each credential type
  apiKeyUpdatedAt: Date | null;
  installationTokenUpdatedAt: Date | null;
  privateKeyUpdatedAt: Date | null;
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
   * Retrieve Bunq credentials for a user
   * @param userId User ID
   * @param password Password for decryption
   * @returns Decrypted Bunq credentials or null if not found
   */
  async getCredentials(userId: number, password: string): Promise<BunqCredentials | null> {
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

    try {
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

    // Decrypt private key if available
    let privateKey: string | undefined;
    if (
      encryptedCredentials.privateKeyEncrypted &&
        encryptedCredentials.privateKeyIv &&
        encryptedCredentials.privateKeyAuthTag &&
      encryptedCredentials.privateKeySalt
    ) {
        const privateKeyKey = encryptionUtils.deriveKey(
          password,
          encryptedCredentials.privateKeySalt
        );

        privateKey = encryptionUtils.decrypt(
          encryptedCredentials.privateKeyEncrypted,
          encryptedCredentials.privateKeyIv,
          encryptedCredentials.privateKeyAuthTag,
          privateKeyKey
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
        monetaryAccountId: encryptedCredentials.monetaryAccountId || undefined,
        installationToken,
        privateKey,
        sessionToken
      };
    } catch (error: any) {
      if (error.message == "Unsupported state or unable to authenticate data") {
        throw new Error('Invalid password');
      } else {
        throw error;
      }
    }
  },

  /**
   * Update monetary account ID for a user
   * @param userId User ID
   * @param monetaryAccountId Bunq monetary account ID
   * @returns True if successful, false otherwise
   */
  async updateMonetaryAccountId(userId: number, monetaryAccountId: number): Promise<boolean> {
    try {
      // Check if user exists
      const userExists = await this.checkUserExists(userId);
      if (!userExists) {
        console.error(`User ${userId} does not exist`);
        return false;
      }
      
      // Check if credentials exist for this user
      const existingCredentials = await db
        .select()
        .from(bunqCredentials)
        .where(eq(bunqCredentials.userId, userId))
        .then(rows => rows[0]);
      
      if (!existingCredentials) {
        console.error(`No Bunq credentials found for user ${userId}`);
        return false;
      }
      
      // Update monetary account ID
      await db
        .update(bunqCredentials)
        .set({
          monetaryAccountId
        })
        .where(eq(bunqCredentials.userId, userId));
      
      return true;
    } catch (error: any) {
      console.error('Error updating monetary account ID:', error);
      return false;
    }
  },
  
  /**
   * Store all Bunq credentials at once (API key, installation token, private key, and session token)
   * @param userId User ID
   * @param apiKey API key to store
   * @param installationToken Installation token to store
   * @param privateKey Private key to store
   * @param sessionToken Session token to store
   * @param monetaryAccountId Bunq monetary account ID (optional)
   * @param password Password for encryption
   * @returns True if successful, false otherwise
   */
  async storeAllCredentials(
    userId: number, 
    apiKey: string, 
    installationToken: string, 
    privateKey: string,
    sessionToken: string, 
    monetaryAccountId: number | null, 
    password: string
  ): Promise<boolean> {
    try {
      // Check if user exists
      const userExists = await this.checkUserExists(userId);
      if (!userExists) {
        console.error(`User with ID ${userId} not found`);
        return false;
      }
      
      // Generate salts and encrypt all credentials
      const apiKeySalt = encryptionUtils.generateSalt();
      const installationTokenSalt = encryptionUtils.generateSalt();
      const privateKeySalt = encryptionUtils.generateSalt();
      const sessionTokenSalt = encryptionUtils.generateSalt();
      
      const apiKeyKey = encryptionUtils.deriveKey(password, apiKeySalt);
      const installationTokenKey = encryptionUtils.deriveKey(password, installationTokenSalt);
      const privateKeyKey = encryptionUtils.deriveKey(password, privateKeySalt);
      const sessionTokenKey = encryptionUtils.deriveKey(password, sessionTokenSalt);
      
      const encryptedApiKey = encryptionUtils.encrypt(apiKey, apiKeyKey);
      const encryptedInstallationToken = encryptionUtils.encrypt(installationToken, installationTokenKey);
      const encryptedPrivateKey = encryptionUtils.encrypt(privateKey, privateKeyKey);
      const encryptedSessionToken = encryptionUtils.encrypt(sessionToken, sessionTokenKey);
      
      const now = new Date();
      
      // Check if credentials already exist for this user
      const existingCredentials = await db
        .select({ userId: bunqCredentials.userId })
        .from(bunqCredentials)
        .where(eq(bunqCredentials.userId, userId))
        .then(rows => rows.length > 0);
      
      if (existingCredentials) {
        // Update existing credentials
        await db
          .update(bunqCredentials)
          .set({
            monetaryAccountId,
            
            // API Key
            apiKeyEncrypted: encryptedApiKey.encrypted,
            apiKeyIv: encryptedApiKey.iv,
            apiKeyAuthTag: encryptedApiKey.authTag,
            apiKeySalt,
            
            // Installation Token
            installationTokenEncrypted: encryptedInstallationToken.encrypted,
            installationTokenIv: encryptedInstallationToken.iv,
            installationTokenAuthTag: encryptedInstallationToken.authTag,
            installationTokenSalt,
            
            // Private Key
            privateKeyEncrypted: encryptedPrivateKey.encrypted,
            privateKeyIv: encryptedPrivateKey.iv,
            privateKeyAuthTag: encryptedPrivateKey.authTag,
            privateKeySalt,
            
            // Session Token
            sessionTokenEncrypted: encryptedSessionToken.encrypted,
            sessionTokenIv: encryptedSessionToken.iv,
            sessionTokenAuthTag: encryptedSessionToken.authTag,
            sessionTokenSalt,
            
            // Update all timestamps
            apiKeyUpdatedAt: now,
            installationTokenUpdatedAt: now,
            privateKeyUpdatedAt: now,
            sessionTokenUpdatedAt: now
          })
          .where(eq(bunqCredentials.userId, userId));
      } else {
        // Insert new credentials
        await db
          .insert(bunqCredentials)
          .values({
            userId,
            monetaryAccountId,
            
            // API Key
            apiKeyEncrypted: encryptedApiKey.encrypted,
            apiKeyIv: encryptedApiKey.iv,
            apiKeyAuthTag: encryptedApiKey.authTag,
            apiKeySalt,
            
            // Installation Token
            installationTokenEncrypted: encryptedInstallationToken.encrypted,
            installationTokenIv: encryptedInstallationToken.iv,
            installationTokenAuthTag: encryptedInstallationToken.authTag,
            installationTokenSalt,
            
            // Private Key
            privateKeyEncrypted: encryptedPrivateKey.encrypted,
            privateKeyIv: encryptedPrivateKey.iv,
            privateKeyAuthTag: encryptedPrivateKey.authTag,
            privateKeySalt,
            
            // Session Token
            sessionTokenEncrypted: encryptedSessionToken.encrypted,
            sessionTokenIv: encryptedSessionToken.iv,
            sessionTokenAuthTag: encryptedSessionToken.authTag,
            sessionTokenSalt,
            
            // Set all timestamps
            apiKeyUpdatedAt: now,
            installationTokenUpdatedAt: now,
            privateKeyUpdatedAt: now,
            sessionTokenUpdatedAt: now
          });
      }
      
      return true;
    } catch (error: any) {
      console.error('Error storing all Bunq credentials:', error);
      return false;
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
