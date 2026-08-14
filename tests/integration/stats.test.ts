/**
 * Stats endpoint and its cache, end to end against real Mongo and Redis.
 */
import request from "supertest";
import { createApp } from "../../src/app";
import { setupDb, teardownDb, clearDb } from "./setup";

const app = createApp();
let token: string;

const auth = () => ({ Authorization: `Bearer ${token}` });
const post = (body: Record<string, unknown>) =>
  request(app).post("/api/v1/applications").set(auth()).send(body);
const stats = () => request(app).get("/api/v1/applications/stats").set(auth());

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(async () => {
  await clearDb();
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email: "s@example.com", name: "S", password: "correct-horse" });
  token = res.body.accessToken;
});

describe("aggregation", () => {
  it("returns zeroed counts for a new account without dividing by zero", async () => {
    const res = await stats();
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.funnel.offerRate).toBe(0);
  });

  it("counts by status", async () => {
    await post({ company: "A", role: "R", status: "applied" });
    await post({ company: "B", role: "R", status: "applied" });
    await post({ company: "C", role: "R", status: "offer" });
    const res = await stats();
    expect(res.body.total).toBe(3);
    expect(res.body.byStatus.applied).toBe(2);
  });

  it("excludes wishlist entries from funnel denominators", async () => {
    await post({ company: "A", role: "R", status: "wishlist" });
    await post({ company: "B", role: "R", status: "applied" });
    await post({ company: "C", role: "R", status: "offer" });
    // submitted = 2, offers = 1
    const res = await stats();
    expect(res.body.funnel.offerRate).toBe(50);
  });
});

describe("caching", () => {
  it("misses on the first call and hits on the second", async () => {
    await post({ company: "A", role: "R", status: "applied" });
    expect((await stats()).body.cached).toBe(false);
    expect((await stats()).body.cached).toBe(true);
  });

  it("invalidates on create, so a new application is reflected immediately", async () => {
    await post({ company: "A", role: "R", status: "applied" });
    await stats(); // warm
    await post({ company: "B", role: "R", status: "applied" });

    const res = await stats();
    expect(res.body.cached).toBe(false);
    expect(res.body.total).toBe(2);
  });

  it("invalidates on update", async () => {
    const created = await post({ company: "A", role: "R", status: "applied" });
    await stats();
    await request(app)
      .patch(`/api/v1/applications/${created.body._id}`)
      .set(auth())
      .send({ status: "offer" });

    const res = await stats();
    expect(res.body.cached).toBe(false);
    expect(res.body.byStatus.offer).toBe(1);
  });

  it("invalidates on delete", async () => {
    const created = await post({ company: "A", role: "R" });
    await stats();
    await request(app).delete(`/api/v1/applications/${created.body._id}`).set(auth());

    const res = await stats();
    expect(res.body.cached).toBe(false);
    expect(res.body.total).toBe(0);
  });

  it("does not serve one user's cached stats to another", async () => {
    await post({ company: "A", role: "R", status: "applied" });
    await stats();

    const other = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "other@example.com", name: "O", password: "correct-horse" });

    const res = await request(app)
      .get("/api/v1/applications/stats")
      .set("Authorization", `Bearer ${other.body.accessToken}`);
    expect(res.body.total).toBe(0);
  });
});

describe("GET /healthz", () => {
  it("reports both dependencies", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mongo: true, redis: true });
  });
});
