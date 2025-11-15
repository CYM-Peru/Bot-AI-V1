import crypto from 'crypto';

/**
 * Encryption utilities for sensitive data storage
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derives encryption key from secret using PBKDF2
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Gets encryption secret from environment
 * Falls back to generating one if not set (dev only)
 */
function getEncryptionSecret(): string {
  let secret = process.env.ENCRYPTION_SECRET;

  if (!secret) {
    console.warn('[Encryption] ENCRYPTION_SECRET not set, generating random secret (DEV ONLY)');
    secret = crypto.randomBytes(32).toString('hex');
  }

  if (secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be at least 32 characters long');
  }

  return secret;
}

/**
 * Encrypts data using AES-256-GCM
 * Returns base64 encoded string: salt:iv:authTag:encryptedData
 */
export function encrypt(plaintext: string): string {
  const secret = getEncryptionSecret();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Combine salt:iv:authTag:encrypted and encode as base64
  const combined = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, 'hex')
  ]);

  return combined.toString('base64');
}

/**
 * Decrypts data encrypted with encrypt()
 */
export function decrypt(encryptedData: string): string {
  const secret = getEncryptionSecret();
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + TAG_LENGTH
  );
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(secret, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypts an object by encrypting each sensitive field
 */
export function encryptObject<T extends Record<string, any>>(
  obj: T,
  sensitiveFields: (keyof T)[]
): T {
  const result = { ...obj };

  for (const field of sensitiveFields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encrypt(result[field] as string) as any;
    }
  }

  return result;
}

/**
 * Decrypts an object by decrypting each sensitive field
 */
export function decryptObject<T extends Record<string, any>>(
  obj: T,
  sensitiveFields: (keyof T)[]
): T {
  const result = { ...obj };

  for (const field of sensitiveFields) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        result[field] = decrypt(result[field] as string) as any;
      } catch (error) {
        // If decryption fails, assume it's not encrypted (backwards compatibility)
        console.warn(`[Encryption] Failed to decrypt field ${String(field)}, using as-is`);
      }
    }
  }

  return result;
}
