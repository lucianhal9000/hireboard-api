import request from "supertest";
import { createApp } from "../../src/app";
import { setupDb, teardownDb, clearDb } from "./setup";

const app = createApp();
let token: string;

async function auth(email = "user@example.com"): Promise<string> {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, name: "User", password: "correct-horse" });
  return res.body.accessToken;
}

const post = (body: Record<string, unknown>, t = token) =>
  request(app).post("/api/v1/applications").set("Authorization", `Bearer ${t}`).send(body);

const get = (path: string, t = token) =>
  request(app).get(`/api/v1/applications${path}`).set("Authorization", `Bearer ${t}`);

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(async () => {
  await clearDb();
  token = await auth();
});

describe("authorization", () => {
  it("rejects unauthenticated access", async () => {
    expect((await request(app).get("/api/v1/applications")).status).toBe(401);
  });
});

describe("create", () => {
  it("creates with defaults", async () => {
    const res = await post({ company: "Deloitte", role: "Backend Engineer" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("wishlist");
  });

  it("seeds the history with the initial status", async () => {
    const res = await post({ company: "X", role: "Y", status: "applied" });
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].to).toBe("applied");
  });

  it("rejects a missing company", async () => {
    expect((await post({ role: "Y" })).status).toBe(400);
  });

  it("rejects an unknown status", async () => {
    expect((await post({ company: "X", role: "Y", status: "ghosted" })).status).toBe(400);
  });

  it("rejects a malformed url", async () => {
    expect((await post({ company: "X", role: "Y", url: "not-a-url" })).status).toBe(400);
  });
});

describe("ownership", () => {
  it("hides another user's record behind a 404, not a 403", async () => {
    const mine = await post({ company: "X", role: "Y" });
    const other = await auth("other@example.com");
    const res = await get(`/${mine.body._id}`, other);
    expect(res.status).toBe(404);
  });

  it("excludes other users' records from the list", async () => {
    await post({ company: "Mine", role: "Y" });
    const other = await auth("other@example.com");
    await post({ company: "Theirs", role: "Y" }, other);
    const res = await get("", other);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].company).toBe("Theirs");
  });

  it("returns 404 for a malformed id rather than a 500", async () => {
    expect((await get("/not-an-objectid")).status).toBe(404);
  });
});

describe("update", () => {
  it("appends a history entry recording the transition", async () => {
    const created = await post({ company: "X", role: "Y", status: "applied" });
    const res = await request(app)
      .patch(`/api/v1/applications/${created.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "interview" });

    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(2);
    expect(res.body.history[1]).toMatchObject({ from: "applied", to: "interview" });
  });

  it("does not add history when status is unchanged", async () => {
    const created = await post({ company: "X", role: "Y" });
    const res = await request(app)
      .patch(`/api/v1/applications/${created.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "phone screen booked" });
    expect(res.body.history).toHaveLength(1);
  });

  it("rejects an empty patch", async () => {
    const created = await post({ company: "X", role: "Y" });
    const res = await request(app)
      .patch(`/api/v1/applications/${created.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("list", () => {
  beforeEach(async () => {
    await post({ company: "Deloitte", role: "Backend", status: "applied", tags: ["remote"] });
    await post({ company: "Infosys", role: "Frontend", status: "interview" });
    await post({ company: "Zoho", role: "Backend", status: "rejected" });
  });

  it("filters by a single status", async () => {
    const res = await get("?status=applied");
    expect(res.body.data).toHaveLength(1);
  });

  it("filters by several statuses", async () => {
    const res = await get("?status=applied,interview");
    expect(res.body.data).toHaveLength(2);
  });

  it("matches company case-insensitively and partially", async () => {
    const res = await get("?company=deloi");
    expect(res.body.data).toHaveLength(1);
  });

  it("filters by tag", async () => {
    expect((await get("?tag=remote")).body.data).toHaveLength(1);
  });

  it("paginates and reports totals", async () => {
    const res = await get("?limit=2&page=1");
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ total: 3, pages: 2 });
  });

  it("rejects a limit above the maximum", async () => {
    expect((await get("?limit=500")).status).toBe(400);
  });
});

describe("delete", () => {
  it("removes the record", async () => {
    const created = await post({ company: "X", role: "Y" });
    const del = await request(app)
      .delete(`/api/v1/applications/${created.body._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);
    expect((await get(`/${created.body._id}`)).status).toBe(404);
  });
});
