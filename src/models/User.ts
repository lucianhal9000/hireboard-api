import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

// Case-insensitive uniqueness via collation, so Alice@x.com and alice@x.com
// cannot both register. Lowercasing alone would not stop a direct driver write.
userSchema.index({ email: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

userSchema.methods.verifyPassword = function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, (this as UserDoc).passwordHash);
};

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User> & { verifyPassword(plain: string): Promise<boolean> };

export const UserModel = model<User>("User", userSchema);

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
