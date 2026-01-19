import { createHash, randomBytes } from 'crypto';

/**
 * Generates a new random API key.
 * Format: sk_live_<random_hex>
 */
export function generateApiKey(): string {
    const bytes = randomBytes(32);
    return `sk_live_${bytes.toString('hex')}`;
}

/**
 * Hashes an API key for storage.
 * Uses SHA-256.
 */
export function hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

/**
 * Masks an API key for display.
 * Shows only the prefix and the last 4 characters.
 */
export function maskApiKey(key: string): string {
    // If it's already a hash or short, just return truncated
    if (key.length <= 10) return key;

    // Assuming format sk_live_...
    // We want to verify it starts with sk_live_ but for general robustness, just take last 4
    const last4 = key.slice(-4);
    return `sk_live_...${last4}`;
}
