import { Types } from "mongoose";
import { ApplicationModel, STATUSES, type Status } from "../models/Application";
import { env } from "../config/env";
import { readCache, writeCache, statsKey } from "./cache";

export interface Stats {
  total: number;
  byStatus: Record<Status, number>;
  funnel: { responseRate: number; interviewRate: number; offerRate: number };
  cached: boolean;
}

/** Multi-stage aggregation: the expensive call this endpoint exists to cache. */
async function computeStats(userId: string): Promise<Omit<Stats, "cached">> {
  const rows = await ApplicationModel.aggregate<{ _id: Status; count: number }>([
    { $match: { userId: new Types.ObjectId(userId) } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const row of rows) byStatus[row._id] = row.count;

  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const submitted = total - byStatus.wishlist;
  const reached = byStatus.screening + byStatus.interview + byStatus.offer;
  const interviewed = byStatus.interview + byStatus.offer;

  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

  return {
    total,
    byStatus,
    funnel: {
      responseRate: pct(reached, submitted),
      interviewRate: pct(interviewed, submitted),
      offerRate: pct(byStatus.offer, submitted),
    },
  };
}

/**
 * Read-through cache.
 *
 * The TTL bounds staleness for changes this service did not see; explicit
 * invalidation on every write is what keeps a user's own edits from showing a
 * stale funnel. TTL alone would leave the dashboard wrong for up to a minute
 * immediately after the user acted, which is exactly when they are looking.
 */
export async function getStats(userId: string): Promise<Stats> {
  const key = statsKey(userId);
  const hit = await readCache<Omit<Stats, "cached">>(key);
  if (hit) return { ...hit, cached: true };

  const fresh = await computeStats(userId);
  await writeCache(key, fresh, env.statsCacheTtlSeconds);
  return { ...fresh, cached: false };
}
