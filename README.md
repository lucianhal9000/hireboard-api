# HireBoard API

REST API for tracking job applications through a hiring pipeline, built with
**Node.js, Express 5, TypeScript, MongoDB and Redis**. Integration tests run
against real MongoDB and real Redis in CI — not mocks.

[![CI](https://github.com/lucianhal9000/hireboard-api/actions/workflows/ci.yml/badge.svg)](https://github.com/lucianhal9000/hireboard-api/actions/workflows/ci.yml)

## What it does

Tracks applications through `wishlist → applied → screening → interview → offer /
rejected / withdrawn`, keeps an append-only history of every status change, and
exposes an aggregation endpoint turning that history into funnel metrics.

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 22, Express 5, TypeScript (strict, `noUncheckedIndexedAccess`) |
| Database | MongoDB via Mongoose 8 |
| Cache | Redis via ioredis — stats caching and distributed rate limiting |
| Auth | JWT access tokens, rotating hashed refresh tokens, bcrypt |
| Validation | Zod at the request boundary |
| Tests | Jest + Supertest against real MongoDB and Redis |
| CI | GitHub Actions: typecheck → lint → unit → integration → coverage → image build |
| Packaging | Multi-stage Dockerfile, `docker compose` for local development |

## Running it

```bash
cp .env.example .env
docker compose up --build        # api + mongo + redis
```

Without Docker, point `MONGO_URI` and `REDIS_URL` at any instances (MongoDB
Atlas and Redis Cloud both have free tiers), then `npm install && npm run dev`.

## API

Base path `/api/v1`. Application routes require `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/healthz` | Liveness plus Mongo and Redis connectivity |
| `POST` | `/auth/register` · `/auth/login` | Returns a token pair |
| `POST` | `/auth/refresh` · `/auth/logout` | Rotate or revoke a refresh token |
| `GET` | `/auth/me` | Current user |
| `GET` `POST` | `/applications` | List (filter, search, paginate) and create |
| `GET` `PATCH` `DELETE` | `/applications/:id` | Read, partial update, delete |
| `GET` | `/applications/stats` | Pipeline counts and funnel rates (cached) |

Query parameters: `?status=applied,interview` · `?company=deloi` · `?tag=remote` ·
`?q=backend` (text search) · `?sort=-appliedAt` · `?page=2&limit=20`

## Design decisions

**Redis caches the stats aggregation, with explicit invalidation.** `/stats` runs
a multi-stage Mongo aggregation on every dashboard load. It is cached with a TTL,
*and* invalidated on every write to that user's applications. TTL alone would be
wrong: after creating an application the user is looking straight at the funnel
chart, so that is precisely when a stale value is least acceptable. The TTL
bounds staleness from changes this process did not see; invalidation handles the
changes it did.

**Cache reads and writes are fail-open.** If Redis is unreachable, requests fall
through to Mongo and still succeed. A cache that can take the API down is a
liability rather than an optimisation, and there are tests asserting this against
a deliberately dead client.

**Rate limiting is Redis-backed, not in-memory.** The default memory store counts
per process, so three replicas silently triple every limit — the protection
disappears at exactly the point you scale out to cope with load.

**Refresh tokens are stored as SHA-256 hashes and rotated on use.** A database
leak yields no usable sessions. Presenting an already-revoked token means it
leaked and is being replayed, so every session for that user is revoked rather
than just rejecting the one call.

**Ownership misses return 404, not 403.** A 403 confirms the id exists and
belongs to someone else, which leaks other users' records to anyone probing ids.

**Updates load-then-save rather than `findOneAndUpdate`.** It is what makes the
pre-save hook and schema validators fire, and the hook needs the prior status to
write an accurate history entry.

**Login is constant in shape.** Wrong password and unknown account return an
identical response; a distinct "no such user" turns login into an account
enumeration oracle.

## Indexes

| Index | Why |
| --- | --- |
| `{ userId, status, createdAt }` | The dominant query: one user's board, filtered by status, newest first |
| `{ email }` unique, collation strength 2 | Case-insensitive uniqueness — lowercasing alone would not stop a direct driver write |
| `{ company, role, notes }` text | Free-text search |
| `{ expiresAt }` TTL on refresh tokens | Mongo expires them itself; no cleanup job to forget |

## Tests

```bash
npm run test:unit          # no databases needed
npm run test:integration   # needs MongoDB and Redis
npm run test:coverage
```

CI starts MongoDB and Redis as service containers, so the integration suite runs
against real databases on every push without anything installed locally.

## Scope and limitations

- Single-node rate limiting assumptions hold only while Redis is shared; a Redis
  outage fails the limiter open, which is deliberate but worth knowing.
- No refresh-token binding to device or IP.
- No pagination cursor — offset pagination degrades on very large collections.
- Deletes are hard deletes; there is no soft-delete or audit trail beyond status
  history.
