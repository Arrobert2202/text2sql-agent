import crypto from 'crypto';
import { env } from '../config/env';

// AES-256-GCM encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit nonce for GCM

// Ensure key is strictly 32 bytes (256 bits)
function getKey(): Buffer {
    return crypto.createHash('sha256').update(env.ENCRYPTION_KEY).digest();
}

/**
 * Encrypts plaintext string using AES-256-GCM.
 * Returns a serialized string format: `iv:authTag:encryptedData` (all hex encoded).
 */
export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts serialized AES-256-GCM ciphertext (`iv:authTag:encryptedData`).
 * Verifies authenticity tag to prevent tampering.
 */
export function decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format. Expected iv:authTag:ciphertext');
    }

    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
