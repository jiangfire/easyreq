# Changelog

## [Unreleased] — 2026-06-27

### Security
- **Attachments no longer served from `public/`** (Critical): default local storage moved from `public/uploads` to `./uploads`. All attachment access now flows through the permission-gated `GET /api/attachments/:id` endpoint, closing an auth bypass.
- **Attachment MIME whitelist hardened** (Critical): exact-set match replaces the `image/` prefix check (which allowed `image/svg+xml` stored XSS). Non-image downloads are forced as `Content-Disposition: attachment` with `X-Content-Type-Options: nosniff`.
- **Project member management restricted to OWNER/ADMIN** (Critical): global MANAGERs can no longer add/remove members, matching the spec.
- **`labelIds` cross-project attach blocked** (Critical): PATCH now validates every label belongs to the requirement's project.

### Concurrency / Data Integrity
- **Vote toggle is atomic** (Critical): wrapped in a transaction; concurrent toggles resolve to `409 CONFLICT` instead of crashing with P2002.
- **State transitions use optimistic locking** (Critical): concurrent transitions can no longer produce conflicting `StatusLog` entries.
- **Attachment delete order fixed**: DB record removed first, then storage file, so failures never leave dangling rows.

### Auth
- **JWT session expires in 24h** per spec (was NextAuth's 30-day default).
- **Login email normalized**: rate limiting and DB lookup now use the same lowercased email, closing a rate-limit-bypass and a class of login failures.
- **Rate-limit feedback**: rate-limited logins surface a user-facing message with retry time.
- `requireUser`/`requireRole` now throw `AppError` (proper error envelope).

### API Contract
- **Notifications are paginated** (`{ data, pagination, unreadCount }`); the spec-foreign `PATCH /api/notifications` body-id variant removed in favor of `PATCH /api/notifications/:id/read` and `POST /api/notifications/read-all`.
- **Pagination is NaN-safe**: shared `parsePagination` clamps and caps `pageSize` (≤100) to prevent DoS; unit-tested.
- **Prisma errors translated**: P2002→`409 CONFLICT`, P2025→`404 NOT_FOUND`; `apiHandler` wrapper + `toAppError` helper standardize the error envelope.
- **Search moved into a service** (`SearchService`) and no longer mixes the broken `search` tsvector operator.
- **SSE legacy redirect** uses an absolute URL.
- **`label.service` create/update/delete** now enforce membership + MANAGER/OWNER/ADMIN.

### Realtime (SSE)
- **New `useSSENotifications` hook** (`src/hooks/use-notifications.ts`) with proper exponential backoff, `EventSource` cleanup on unmount, reconnect cap, and no reconnect storm on auth failure.

### UI
- **Manager inline editing**: priority, expected date, and acceptance criteria are now editable in the requirement detail page.
- **Priority filter** added to the requirement list.
- **`@mention`** inserts a visible `**@name**` instead of a dead `/users/:id` link.
- **Login errors are visible** (invalid credentials / rate limited).
- **Admin link** in the header is gated to MANAGER/ADMIN.

### Quality
- Removed dead code (`serializeSSEComment`, `nextVoteMilestone`); replaced `as ReqStatus[]`/`as Priority[]` casts with typed, boundary-validated enums.
- **`db:seed` is idempotent** (Labels use `upsert`); safe to re-run.
- **`removeMember` clears stale `assigneeId`** on the member's requirements.
- **Soft-deleted comments can no longer be edited.**

### Tests
- **Test database isolation** (Critical): `npm test` now runs against an isolated `<dbname>_test` database; integration tests refuse to run against a non-test DSN. 113 tests pass (up from 103), including new regressions for vote races, transition optimistic locking, member-management authorization, and cross-project label guards.

### Notes for operators
- Create the test DB before the first test run: `createdb easyreqdb_test` then `DATABASE_URL=…easyreqdb_test… npx prisma migrate deploy`.
- Old files in `public/uploads/` are no longer used; migrate or remove the directory.
