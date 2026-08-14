import { createApp } from "./app";
import { connectMongo, disconnectMongo } from "./db/mongo";
import { closeRedis } from "./db/redis";
import { env } from "./config/env";

async function main(): Promise<void> {
  await connectMongo();
  const server = createApp().listen(env.port, () => {
    console.log(`hireboard-api listening on :${env.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close();
    await Promise.allSettled([disconnectMongo(), closeRedis()]);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
