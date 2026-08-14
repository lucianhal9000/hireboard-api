import Redis from "ioredis";
import { env } from "../config/env";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    client.on("error", (err) => {
      // A cache outage must not take the API down — see cache.ts.
      console.error("[redis]", err.message);
    });
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
