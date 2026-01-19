import { redis } from './redis';

const RATELIMIT_WINDOW_SECONDS = 60;
const RATELIMIT_MAX_REQUESTS = 100;

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp in seconds
}

/**
 * Checks the rate limit for a given identifier (e.g. API key hash or ID).
 * Implements a sliding window or fixed window counter.
 * Using fixed window for simplicity: keys are `rate_limit:<id>:<minute_timestamp>`
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / RATELIMIT_WINDOW_SECONDS) * RATELIMIT_WINDOW_SECONDS;
    const key = `rate_limit:${identifier}:${windowStart}`;

    // Pipeline for atomicity and speed: increment and set expiry
    const [incrRes] = await redis
        .pipeline()
        .incr(key)
        .expire(key, RATELIMIT_WINDOW_SECONDS * 2) // Expire key after 2 windows to keep Redis clean
        .exec() as [error: Error | null, result: number][];

    const currentCount = incrRes[1];
    const remaining = Math.max(0, RATELIMIT_MAX_REQUESTS - currentCount);

    return {
        success: currentCount <= RATELIMIT_MAX_REQUESTS,
        limit: RATELIMIT_MAX_REQUESTS,
        remaining,
        reset: windowStart + RATELIMIT_WINDOW_SECONDS,
    };
}
