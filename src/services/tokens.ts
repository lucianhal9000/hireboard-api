import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env";
import { RefreshTokenModel, hashToken } from "../models/RefreshToken";
import { unauthorized } from "../utils/errors";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtAccessSecret, {
    expiresIn: env.accessTtl as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as jwt.JwtPayload;
    if (!payload.sub) throw new Error("no subject");
    return payload.sub;
  } catch {
    throw unauthorized("Invalid or expired access token");
  }
}

export async function issueTokenPair(userId: string): Promise<TokenPair> {
  const refreshToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + env.refreshTtlDays * 86_400_000);
  await RefreshTokenModel.create({ userId, tokenHash: hashToken(refreshToken), expiresAt });
  return { accessToken: signAccessToken(userId), refreshToken };
}

/**
 * Rotation: the presented token is revoked and a new pair issued.
 *
 * Presenting an already-revoked token means it leaked and is being replayed,
 * so every session for that user is killed rather than just rejecting the call.
 */
export async function rotateRefreshToken(rawToken: string): Promise<TokenPair> {
  const stored = await RefreshTokenModel.findOne({ tokenHash: hashToken(rawToken) });
  if (!stored) throw unauthorized("Invalid refresh token");

  if (stored.revokedAt) {
    await RefreshTokenModel.updateMany(
      { userId: stored.userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    throw unauthorized("Refresh token reuse detected; all sessions revoked");
  }

  if (stored.expiresAt.getTime() < Date.now()) throw unauthorized("Refresh token expired");

  const pair = await issueTokenPair(String(stored.userId));
  stored.revokedAt = new Date();
  stored.replacedBy = hashToken(pair.refreshToken);
  await stored.save();
  return pair;
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await RefreshTokenModel.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}
