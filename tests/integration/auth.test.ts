import request from "supertest";
import { createApp } from "../../src/app";
import { setupDb, teardownDb, clearDb } from "./setup";

const app = createApp();
const creds = { email: "ada@example.com", name: "Ada", password: "correct-horse" };

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(clearDb);

describe("POST /auth/register", () => {
  it("creates an account and returns a token pair", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(creds);
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it("never returns the password hash", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(creds);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("rejects a duplicate email", async () => {
    await request(app).post("/api/v1/auth/register").send(creds);
    const res = await request(app).post("/api/v1/auth/register").send(creds);
    expect(res.status).toBe(409);
  });

  it("treats emails case-insensitively", async () => {
    await request(app).post("/api/v1/auth/register").send(creds);
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...creds, email: "ADA@example.com" });
    expect(res.status).toBe(409);
  });

  it("rejects a short password with field-level detail", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...creds, password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("password");
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/v1/auth/register").send(creds);
  });

  it("returns a token pair for valid credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: creds.email, password: creds.password });
    expect(res.status).toBe(200);
  });

  it("gives the same response for a wrong password and an unknown account", async () => {
    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: creds.email, password: "nope" });
    const unknownUser = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "nope" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
  });
});

describe("POST /auth/refresh", () => {
  let refreshToken: string;

  beforeEach(async () => {
    const res = await request(app).post("/api/v1/auth/register").send(creds);
    refreshToken = res.body.refreshToken;
  });

  it("rotates the token, returning a different one", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it("rejects the old token after rotation", async () => {
    await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    const replay = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(replay.status).toBe(401);
  });

  it("revokes every session when a used token is replayed", async () => {
    const rotated = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    await request(app).post("/api/v1/auth/refresh").send({ refreshToken }); // replay

    // The token issued by the legitimate rotation must also now be dead.
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rotated.body.refreshToken });
    expect(res.status).toBe(401);
  });

  it("rejects a token that was never issued", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: "made-up" });
    expect(res.status).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("requires a bearer token", async () => {
    expect((await request(app).get("/api/v1/auth/me")).status).toBe(401);
  });

  it("rejects a malformed authorization header", async () => {
    const res = await request(app).get("/api/v1/auth/me").set("Authorization", "Token abc");
    expect(res.status).toBe(401);
  });

  it("returns the current user", async () => {
    const reg = await request(app).post("/api/v1/auth/register").send(creds);
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${reg.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(creds.email);
  });
});

describe("POST /auth/logout", () => {
  it("revokes the presented refresh token", async () => {
    const reg = await request(app).post("/api/v1/auth/register").send(creds);
    await request(app).post("/api/v1/auth/logout").send({ refreshToken: reg.body.refreshToken });
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: reg.body.refreshToken });
    expect(res.status).toBe(401);
  });
});
