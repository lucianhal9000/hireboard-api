import mongoose from "mongoose";
import { connectMongo, disconnectMongo } from "../../src/db/mongo";
import { getRedis, closeRedis } from "../../src/db/redis";

export const MONGO_URI = process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/hireboard_test";

export async function setupDb(): Promise<void> {
  await connectMongo(MONGO_URI);
  // Indexes are not built implicitly on a fresh database, and several tests
  // assert on unique-index behaviour.
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
}

export async function teardownDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await disconnectMongo();
  await closeRedis();
}

export async function clearDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  await getRedis().flushall();
}
