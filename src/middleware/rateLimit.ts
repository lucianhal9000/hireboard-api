import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedis } from "../db/redis";

/**
 * Redis-backed so the limit is shared across instances.
 *
 * The default memory store counts per process, so running three replicas
 * silently triples every limit — the protection quietly disappears at exactly
 * the point you scale out to handle load.
 */
function store() {
  const redis = getRedis();
  return new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as never,
  });
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: store(),
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts, try again later" } },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: store(),
  message: { error: { code: "RATE_LIMITED", message: "Too many requests" } },
});
