import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { authRouter } from "./routes/auth.routes";
import { applicationsRouter } from "./routes/applications.routes";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { authLimiter, apiLimiter } from "./middleware/rateLimit";
import { getRedis } from "./db/redis";
import { env } from "./config/env";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  if (env.nodeEnv !== "test") app.use(morgan("tiny"));

  // Reports dependency health, not just process liveness: a container that
  // answers 200 while Mongo is unreachable is worse than one that fails.
  app.get("/healthz", async (_req, res) => {
    let redisOk: boolean;
    try {
      redisOk = (await getRedis().ping()) === "PONG";
    } catch {
      redisOk = false;
    }
    const mongoOk = mongoose.connection.readyState === 1;
    res.status(mongoOk ? 200 : 503).json({
      status: mongoOk && redisOk ? "ok" : "degraded",
      mongo: mongoOk,
      redis: redisOk,
    });
  });

  app.use("/api/v1/auth", authLimiter, authRouter);
  app.use("/api/v1/applications", apiLimiter, applicationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
