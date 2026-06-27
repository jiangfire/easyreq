# easyreq

[English](README.md) · [简体中文](README.zh-CN.md)

A GitHub Issues-style request board for internal IT teams. Submit a ticket with a title, route it through IPD state transitions, and let the conversation happen in the open.

![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2.4-149eca?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-required-336791?logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?logo=prisma)
![License](https://img.shields.io/badge/license-MIT-green)

## Why easyreq

Most "request tracking" tools make submitting a ticket feel like filing taxes. easyreq starts from a single input: a title. Everything else is optional, everything else can be filled in by the team later.

We built it for the way IT departments actually work. A frontline engineer flags a problem, a manager picks it up, a developer estimates and builds. easyreq keeps that loop visible to everyone with skin in the game.

## What you get

**Submit a request in five seconds.** One title field, submit. Add acceptance criteria, priority, or an expected delivery date later. The friction lives at the door, not in the form.

**Two state paths, one board.** Standard IPD flow moves a request from Submitted to Accepted to In Progress to Delivered to Closed. Managers can fast-track urgent work and skip the middle.

**Forum-style discussion on every request.** Threaded comments, upvotes to surface what matters, `@mention` to pull the right person in, full Markdown with live preview. The conversation stays next to the work.

**Real-time notifications over SSE.** Status changes, new comments, vote milestones, mentions: the bell icon updates without a refresh.

**Storage you control.** Local filesystem for solo deployments. S3-compatible object storage (MinIO, Aliyun OSS, AWS S3) for anything else. Switch with one environment variable.

**Permission tiers built in.** Members submit and comment. Managers edit and transition. Admins govern projects, labels, and membership. Role checks live in the service layer, not scattered through route handlers.

**Pluggable AI.** A reserved service interface accepts categorization, deduplication, and priority suggestions. Wire your own model when you're ready.

## Quick start

```bash
git clone https://github.com/your-org/easyreq.git
cd easyreq
npm install
cp .env.example .env
# fill in DATABASE_URL, NEXTAUTH_SECRET, and at least one storage config
npx prisma migrate dev
npm run db:seed   # optional demo data
npm run dev
```

The dev server boots on http://localhost:3000. Sign in with the seeded admin or register a new account.

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router | Server components for the public list, route handlers for the API surface, RSC streaming for the detail view |
| Database | PostgreSQL with Prisma 7 | Strong relational model, generated types, raw SQL escape hatch |
| Auth | NextAuth.js 5 (beta) | Credentials provider with bcrypt, JWT sessions, role claims on the token |
| Storage | Pluggable `StorageProvider` | `LocalStorageProvider` for dev, `S3StorageProvider` with presigned URLs for prod |
| Realtime | Server-Sent Events | One-way push, native browser support, no WebSocket plumbing |
| UI | Tailwind 4 + shadcn-style components | Own the markup, skip the runtime |

Every business rule lives in `src/services/`. Route handlers translate HTTP into service calls and surface `AppError` instances as structured JSON. The same services back the tests, the API, and any future SDK.

## Project layout

```
src/
  app/                    Next.js App Router (pages + API routes)
  services/               Business logic — the only place that touches Prisma
  lib/                    Cross-cutting helpers (auth, errors, storage, sse)
  components/             UI components grouped by feature
  hooks/                  Client-side React hooks
prisma/
  schema.prisma           Single source of truth for the data model
tests/
  unit/                   Pure logic and provider tests
  integration/            Database-backed service tests against a separate test DB
docs/
  spec.md                 Product specification (the contract)
  plan.md                 Architecture and implementation decisions
```

## Contributing

PRs welcome. Start with `docs/plan.md` to see what's in flight. Run the test suite before you push:

```bash
npm run lint
npm run typecheck
npm test
```

Integration tests use a separate database derived from your `DATABASE_URL` (`<db>_test`). The test runner refuses to start if the URL doesn't end in `_test`, so your dev data stays safe.

## License

MIT. Use it, modify it, ship it. See [LICENSE](LICENSE).

## Documentation

- [Product specification](docs/spec.md)
- [Architecture and plan](docs/plan.md)
