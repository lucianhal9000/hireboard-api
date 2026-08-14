/**
 * Cache behaviour against a real Redis.
 *
 * ioredis-mock would let these pass while proving nothing about TTL handling
 * or connection failure, which is most of what the cache layer has to get
 * right.
 */
import Redis from "ioredis";
import { readCache, writeCache, invalidateStats, statsKey } from "../../src/services/cache";

const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
let redis: Redis;

beforeAll(() => {
  redis = new Redis(url, { maxRetriesPerRequest: 2 });
});

afterAll(async () => {
  await redis.flushall();
  await redis.quit();
});

beforeEach(async () => {
  await redis.flushall();
});

describe("read/write", () => {
  it("returns null for a key that was never written", async () => {
    expect(await readCache("missing", redis)).toBeNull();
  });

  it("round-trips a structured value", async () => {
    const value = { total: 3, byStatus: { applied: 3 }, funnel: { offerRate: 12.5 } };
    await writeCache("k", value, 60, redis);
    expect(await readCache("k", redis)).toEqual(value);
  });

  it("sets a TTL rather than persisting forever", async () => {
    await writeCache("k", { a: 1 }, 60, redis);
    const ttl = await redis.ttl("k");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it("actually expires", async () => {
    await writeCache("k", { a: 1 }, 1, redis);
    await new Promise((r) => setTimeout(r, 1200));
    expect(await readCache("k", redis)).toBeNull();
  });

  it("survives a corrupted cache entry instead of throwing", async () => {
    await redis.set("k", "{not valid json");
    expect(await readCache("k", redis)).toBeNull();
  });
});

describe("invalidation", () => {
  it("removes only the given user's stats", async () => {
    await writeCache(statsKey("userA"), { total: 1 }, 60, redis);
    await writeCache(statsKey("userB"), { total: 9 }, 60, redis);

    await invalidateStats("userA", redis);

    expect(await readCache(statsKey("userA"), redis)).toBeNull();
    expect(await readCache(statsKey("userB"), redis)).toEqual({ total: 9 });
  });

  it("is safe to call when nothing is cached", async () => {
    await expect(invalidateStats("nobody", redis)).resolves.toBeUndefined();
  });
});

describe("fail-open behaviour", () => {
  it("returns null instead of throwing when Redis is unreachable", async () => {
    const dead = new Redis("redis://127.0.0.1:6399", {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    dead.on("error", () => {});
    expect(await readCache("k", dead)).toBeNull();
    dead.disconnect();
  });

  it("swallows write failures so a cache outage cannot fail a request", async () => {
    const dead = new Redis("redis://127.0.0.1:6399", {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    dead.on("error", () => {});
    await expect(writeCache("k", { a: 1 }, 60, dead)).resolves.toBeUndefined();
    dead.disconnect();
  });
});
