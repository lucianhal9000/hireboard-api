import jwt from "jsonwebtoken";
import { hashToken } from "../../src/models/RefreshToken";
import { signAccessToken, verifyAccessToken } from "../../src/services/tokens";
import { AppError } from "../../src/utils/errors";

describe("access tokens", () => {
  it("round-trips the user id", () => {
    expect(verifyAccessToken(signAccessToken("507f1f77bcf86cd799439011"))).toBe(
      "507f1f77bcf86cd799439011",
    );
  });

  it("rejects a token signed with a different secret", () => {
    const forged = jwt.sign({ sub: "abc" }, "not-the-real-secret");
    expect(() => verifyAccessToken(forged)).toThrow(AppError);
  });

  it("rejects a tampered payload", () => {
    const parts = signAccessToken("user-1").split(".");
    const tampered = `${parts[0]}.${Buffer.from('{"sub":"user-2"}').toString("base64url")}.${parts[2]}`;
    expect(() => verifyAccessToken(tampered)).toThrow(AppError);
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ sub: "u" }, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me", {
      expiresIn: "-1s",
    });
    expect(() => verifyAccessToken(expired)).toThrow(AppError);
  });
});

describe("refresh token hashing", () => {
  it("is deterministic", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("does not store the raw token", () => {
    expect(hashToken("secret-value")).not.toContain("secret-value");
    expect(hashToken("secret-value")).toHaveLength(64);
  });
});
