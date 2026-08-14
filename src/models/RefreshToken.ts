import { Schema, model, type InferSchemaType } from "mongoose";
import crypto from "node:crypto";

const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // The raw token is never stored. A database leak therefore does not hand an
    // attacker usable sessions.
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedBy: { type: String },
  },
  { timestamps: true },
);

// Mongo removes expired rows on its own; no cleanup job to forget about.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const hashToken = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

export type RefreshToken = InferSchemaType<typeof refreshTokenSchema>;
export const RefreshTokenModel = model<RefreshToken>("RefreshToken", refreshTokenSchema);
