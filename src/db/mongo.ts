import mongoose from "mongoose";
import { env } from "../config/env";

export async function connectMongo(uri: string = env.mongoUri): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
