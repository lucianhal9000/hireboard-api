import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required("MONGO_URI", "mongodb://127.0.0.1:27017/hireboard"),
  redisUrl: required("REDIS_URL", "redis://127.0.0.1:6379"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
  accessTtl: process.env.ACCESS_TTL ?? "15m",
  refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS ?? 7),
  statsCacheTtlSeconds: Number(process.env.STATS_CACHE_TTL ?? 60),
} as const;
