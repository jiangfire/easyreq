<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# easyreq — agent notes

## Stack at a glance
- Next.js 16 App Router (Turbopack), TypeScript strict, Tailwind v4, hand-written UI components (no shadcn).
- Prisma 7 with custom output `src/generated/prisma`. PostgreSQL only.
- NextAuth v5 (Credentials, JWT) + custom `proxy.ts` for route guards (Next.js 16 renamed `middleware.ts` → `proxy.ts`).
- Server Components fetch via Service layer; mutations go through Server Actions or Route Handlers.
- Optional Redis pub/sub SSE (`REDIS_URL`); defaults to in-memory `EventEmitterChannel`.
- Sentry wired via `src/instrumentation.ts` + `src/instrumentation-client.ts`; only active when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are set. Source maps upload on CI via `SENTRY_*`.

## Day-to-day commands
- `npm run dev` — Turbopack dev server, reads `PORT` from env.
- `npm run lint` / `npm run typecheck` / `npm run build` — standard quality gates.
- `npm test` — unit + integration against an auto-derived `*_test` database (`vitest.config.ts` injects `_test` into the DB name unless `DATABASE_TEST_URL` is set).
- `npm run test:unit` / `npm run test:integration` / `npm run test:s3` / `npm run test:e2e` — scoped suites.
- `npm run db:migrate` / `npm run db:seed` / `npm run db:studio` / `npm run db:generate` — Prisma workflow. `prisma.config.ts` loads `dotenv` automatically.

## Hard-won traps
- **Local uploads MUST NOT live under `public/`.** The default in `src/lib/storage/index.ts` is `public/uploads`, which causes Next.js to serve files directly and bypasses `/api/attachments/[id]` permission checks. Set `STORAGE_LOCAL_DIR=./uploads` (outside `public/`) in `.env`. See `src/lib/storage/local.ts` for how the path is used.
- **Numbers are double.** `Requirement` has both `globalNumber` (every requirement, via `GlobalCounter`) and `number` (project-local, only after assignment). Display logic is `number ?? globalNumber` per context (see ADR-002).
- **Unassigned requirements are first-class.** `projectId`/`number` are nullable; they can be created via `POST /api/requirements` and live in `/requirements/inbox`. Status transitions for them are restricted to `SUBMITTED ↔ REJECTED`.
- **Access checks are centralised.** `requireRequirementAccess()` in `src/services/requirement-access.ts` is the single gate for vote/comment/attachment — don't reimplement membership checks.
- **Tests refuse to run without a DB.** `vitest.config.ts` throws if `DATABASE_URL` is unset. In CI, set `DATABASE_URL` plus `DATABASE_TEST_URL`; the `test` and `e2e` jobs provision `easyreqdb_test` themselves.
- **Test order matters.** Integration tests share a DB; `fileParallelism: false` is intentional.
- **DB-bound S3 testing is opt-in.** `npm test` excludes `tests/integration/storage-s3.test.ts`; run it explicitly with `npm run test:s3` against MinIO.
- **Public registration is disabled by design.** Admin creates users (see `prisma/seed.ts` for the initial admin); no `/register` route.
- **ESLint ignores E2E artefacts.** `test-results/` and `playwright-report/` are in `globalIgnores` — don't add them to `.gitignore` for linting.

## CI gates (`.github/workflows/ci.yml`)
`lint` → `typecheck` → `test` → `test-s3` → `e2e` → `docker` → (push to `main`) `publish`. The `docker` job builds the image and runs a smoke check (HTTP 200 vs. `000` from `/`, DB unreachable is fine). The `publish` job pushes multi-tag (`latest`, branch, sha) images to `ghcr.io`. `lint` runs `npm audit --omit=dev --audit-level=high`.

## Style baseline
- ESLint flat config (`eslint.config.mjs`) extends `eslint-config-next/core-web-vitals` and `typescript`.
- Service layer convention: throw `AppError` from `src/lib/errors.ts`; route handlers use `apiHandler()` from `src/lib/api-helpers.ts` to convert to JSON envelopes.
- All input validation goes through Zod at route/action boundaries; never call Prisma from components.
- No comments unless asked.

## Where the design lives
- `docs/spec.md` — product/technical spec (deferred decisions, data model, state machine, API contract).
- `docs/plan.md` — phase-by-phase task breakdown with checkpoints.
- `docs/TODO.md` — remaining work, prioritised.
- `docs/decisions/ADR-001-unassigned-requirements.md`, `ADR-002-dual-numbering.md` — read these before touching requirement/assignment code.
