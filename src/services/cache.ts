import type Redis from "ioredis";
import { getRedis } from "../db/redis";

/**
 * Cache helpers used by the stats endpoint.
 *
 * Every operation is fail-open: if Redis is unreachable the request still
 * succeeds by falling through to Mongo. A cache is an optimisation, and an
 * optimisation that can take the API down is a liability.
 */

export const statsKey = (userId: string) => `stats:${userId}`;

export async function readCache<T>(key: string, redis: Redis = getRedis()): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeCache(
  key: string,
  value: unknown,
  ttlSeconds: number,
  redis: Redis = getRedis(),
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* fail open */
  }
}

/**
 * Called on every write to a user's applications.
 *
 * Without this, creating an application leaves a stale funnel chart on screen
 * for the remainder of the TTL — the bug that makes naive TTL caching wrong
 * for data the same user just changed.
 */
export async function invalidateStats(userId: string, redis: Redis = getRedis()): Promise<void> {
  try {
    await redis.del(statsKey(userId));
  } catch {
    /* fail open */
  }
}
