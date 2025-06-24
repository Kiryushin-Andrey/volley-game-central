import * as crypto from 'crypto';

/**
 * Utility functions for encrypting and decrypting sensitive data
 * using AES-256-GCM with password-based key derivation
 */
export const encryptionUtils = {
  /**
   * Generate a random salt for key derivation
   * @returns Base64 encoded salt string
   */
  generateSalt(): string {
    const salt = crypto.randomBytes(16);
    return salt.toString('base64');
  },

  /**
   * Derive an encryption key from a password and salt using PBKDF2
   * @param password User-provided password
   * @param salt Base64 encoded salt string
   * @returns Derived key as a Buffer
   */
  deriveKey(password: string, salt: string): Buffer {
    // Convert base64 salt back to Buffer
    const saltBuffer = Buffer.from(salt, 'base64');
    
    // Derive a 32-byte key (256 bits) using PBKDF2 with 100,000 iterations
    return crypto.pbkdf2Sync(password, saltBuffer, 100000, 32, 'sha256');
  },

  /**
   * Encrypt data using AES-256-GCM
   * @param data Data to encrypt
   * @param key Encryption key
   * @returns Object containing encrypted data, iv, and authTag
   */
  encrypt(data: string, key: Buffer): { encrypted: string; iv: string; authTag: string } {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(12);
    
    // Create cipher using AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag().toString('base64');
    
    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag
    };
  },

  /**
   * Decrypt data using AES-256-GCM
   * @param encrypted Encrypted data as base64 string
   * @param iv Initialization vector as base64 string
   * @param authTag Authentication tag as base64 string
   * @param key Decryption key
   * @returns Decrypted data as string
   */
  decrypt(encrypted: string, iv: string, authTag: string, key: Buffer): string {
    // Convert base64 strings back to Buffers
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
    decipher.setAuthTag(authTagBuffer);
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
};
