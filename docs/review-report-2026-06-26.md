# Review Report: easyreq Implementation vs Spec

**Date:** 2026-06-26
**Review Scope:** Full stack implementation against `docs/spec.md` and `docs/plan.md`
**Review Method:** Static code audit, spec cross-reference, and integration test status
**Reviewer:** opencode (assisted by code-review-and-quality skill)

---

## Executive Summary

Core capabilities are in place: authentication, project/requirement CRUD, IPD state transitions, voting, comments, Markdown rendering with XSS protection, storage abstraction, and notification storage. However, multiple API contracts, SSE semantics, permission boundaries, and UI features deviate from the spec. Before the project can be considered complete, these deviations must be remediated.

**Overall Verdict:** `Request changes` — P0 items block spec compliance.

---

## Context

- Product: easyreq, an internal IT requirement tracking tool modeled on GitHub Issues.
- Spec: `docs/spec.md`.
- Plan: `docs/plan.md`.
- Current test status: `npm run lint`, `npm run typecheck`, `npm test` passing; `npm run test:e2e` blocked by Playwright Chromium download failures in this environment.

---

## Five-Axis Review

### 1. Correctness

| Area | Finding | Severity |
|------|---------|----------|
| State transitions | `src/lib/transitions.ts` matches the 8×8 matrix and quick paths in spec. 48 unit tests pass. | ✅ Good |
| Notification rules | `STATUS_CHANGE` recipients include all voters (spec: author + assignee only). `VOTE_MILESTONE` includes author (spec: project managers only). `REJECTED` notification type is not emitted. | Critical / Important |
| SSE events | Endpoint is `/api/notifications/stream` instead of `/api/sse`; messages omit `event:` field; no `requirement_updated` event; heartbeat is a comment (`:ping`) rather than `event: ping`. | Critical |
| Update permissions | `requirementService.update` allows authors/ordinary members to modify `body`, `expectedDate`, and `acceptanceCriteria` without role gating. | Critical |
| Assignee validation | `requirementService.update` does not verify that `assigneeId` is a project member or an existing user. | Important |
| Member management | `projectService.addMember` does not validate user existence or duplicate membership. | Important |
| Comment/attachment deletion | Global `MANAGER`/`ADMIN` can soft-delete any comment or attachment regardless of project membership. | Important |
| Environment variables | `.env.example` names (`STORAGE_S3_BUCKET`, `STORAGE_S3_ACCESS_KEY`, etc.) do not match the variables read by `S3StorageProvider` (`S3_BUCKET`, `S3_ACCESS_KEY_ID`, etc.). | Critical |

### 2. Readability & Simplicity

| Finding | Severity |
|---------|----------|
| `orderBy: orderBy as any` in `requirement.service.ts` weakens type safety. | Nit |
| Multiple `as never` casts for Prisma enums reduce compile-time guarantees. | Nit |
| Server Components directly import `db` in several pages, scattering data access patterns. | Optional |

### 3. Architecture

| Finding | Severity |
|---------|----------|
| Service layer exists and is reused, but some Server Components bypass it. | Optional |
| Storage provider abstraction is clean and tested. | ✅ Good |
| AI provider interface is cleanly abstracted. | ✅ Good |
| Notification service and SSE channel are decoupled via `NotificationChannel`. | ✅ Good |

### 4. Security

| Finding | Severity |
|---------|----------|
| Markdown rendering uses `rehype-sanitize`; unit tests confirm XSS filtering. | ✅ Good |
| No `dangerouslySetInnerHTML` found. | ✅ Good |
| No authentication rate limiting on `/api/auth/[...nextauth]`. | Important |
| File upload validates mimeType whitelist and size (10 MB hard-coded). | ✅ Good (but max size should be configurable) |
| Attachment download lacks a permission-gated route; S3 provider returns public URL instead of presigned URL. | Important |

### 5. Performance

| Finding | Severity |
|---------|----------|
| Requirement list supports pagination. | ✅ Good |
| Search uses `contains` with `mode: 'insensitive'` instead of PostgreSQL full-text search. | Optional |
| Comments endpoint does not paginate. | Important |

---

## Spec Compliance Matrix

### API Endpoints (spec § API Endpoints)

| Spec Endpoint | Method | Current Path | Status | Notes |
|---------------|--------|--------------|--------|-------|
| `/api/projects` | GET | `/api/projects` | ✅ | |
| `/api/projects` | POST | `/api/projects` | ✅ | |
| `/api/projects/:slug` | GET | — | ❌ Missing | No standalone project detail API. |
| `/api/projects/:slug/members` | POST | — | ❌ Missing | Service exists, no route/UI. |
| `/api/projects/:slug/members/:userId` | DELETE | — | ❌ Missing | |
| `/api/projects/:slug/requirements` | GET | — | ❌ Missing | List rendered via Server Component. |
| `/api/projects/:slug/requirements` | POST | `/api/projects/[slug]/requirements` | ✅ | |
| `/api/requirements/:id` | GET | — | ❌ Missing | Detail page calls service directly. |
| `/api/requirements/:id` | PATCH | `/api/requirements/[id]` | ⚠️ Partial | Path correct; schema missing `assigneeId`/`labelIds`; field permissions wrong. |
| `/api/requirements/:id/transition` | POST | `/api/requirements/[id]/transition` | ⚠️ Partial | Route checks access; service does not re-check membership internally. |
| `/api/requirements/:id/comments` | GET | `/api/requirements/[id]/comments` | ⚠️ Partial | No pagination. |
| `/api/requirements/:id/comments` | POST | `/api/requirements/[id]/comments` | ✅ | |
| `/api/comments/:id` | PATCH | — | ❌ Missing | Comment edit not implemented. |
| `/api/comments/:id` | DELETE | `/api/comments/[id]` | ✅ | |
| `/api/requirements/:id/vote` | POST | `/api/requirements/[id]/vote` | ✅ | |
| `/api/attachments/upload` | POST | — | ❌ Missing | Replaced by `/api/requirements/[id]/attachments`. |
| `/api/attachments/:id` | GET | — | ❌ Missing | No download/302 presign route. |
| `/api/attachments/:id` | DELETE | — | ❌ Missing | `attachmentService.delete` exists but no route. |
| `/api/notifications` | GET | `/api/notifications` | ⚠️ Partial | No `?unread=true` filter. |
| `/api/notifications/:id/read` | PATCH | — | ❌ Missing | Replaced by `PATCH /api/notifications` with body `{id}`. |
| `/api/notifications/read-all` | POST | — | ❌ Missing | Replaced by `PATCH /api/notifications` with empty body. |
| `/api/sse` | GET | `/api/notifications/stream` | ❌ Wrong | Path and event format both incorrect. |
| `/api/projects/:slug/labels` | GET/POST | `/api/projects/[slug]/labels` | ✅ | Extra PATCH/DELETE implemented. |
| `/api/labels/:id` | DELETE | — | ❌ Missing | Delete located at `/api/projects/[slug]/labels/[labelId]`. |
| `/api/requirements/:id/labels` | POST | — | ❌ Missing | Replaced by `PATCH /api/requirements/[id]` `labelIds`. |
| `/api/requirements/:id/labels/:labelId` | DELETE | — | ❌ Missing | Same as above. |
| `/api/admin/users` | GET | `/api/admin/users` | ✅ | |
| `/api/admin/users/:id/role` | PATCH | `/api/admin/users` | ⚠️ Partial | Uses body `{id, role}` instead of path param. |

### Features (plan / spec)

| Feature | Status | Notes |
|---------|--------|-------|
| Public `/register` page | ❌ Missing | Spec says no public registration; plan still references it. |
| Admin user creation | ❌ Missing | No admin UI or API to create users. |
| Global shortcut `N` quick submit | ❌ Missing | Only inline QuickSubmit exists. |
| Drag-and-drop upload | ❌ Missing | Toolbar button only. |
| Comment `@mention` autocomplete | ❌ Missing | |
| Comment edit | ❌ Missing | No PATCH endpoint, no UI. |
| Inline edit all fields | ⚠️ Partial | Priority/assignee/labels editable; title/body/expectedDate/acceptanceCriteria inline editing missing. |
| Filter by label / assignee | ❌ Missing | Status filter and sort only. |
| Authentication rate limiting | ❌ Missing | No middleware, no login failure throttling. |
| S3 presigned download | ❌ Missing | `getPublicUrl` returns public URL. |
| PostgreSQL full-text search | ❌ Missing | `contains` search only. |

---

## Critical Issues (P0)

1. **SSE non-compliance.** Endpoint path, event naming, event types, and reconnection logic all diverge from spec.
2. **Missing core API endpoints.** Project detail, project requirements list, requirement detail, project members, comment edit, and standalone attachment endpoints are absent.
3. **Environment variable mismatch for S3.** Following `.env.example` will break S3 storage.
4. **Requirement update permission bug.** Authors/ordinary members can modify manager-only fields.

## Important Issues (P1)

5. `REJECTED` notification type not implemented.
6. Notification recipient lists do not match spec.
7. Service-layer membership checks missing in transition, comment deletion, and attachment deletion.
8. Assignee not validated as project member.
9. No presigned download / permission-gated attachment access.
10. No authentication rate limiting.
11. Comments endpoint unpaginated.

## Optional / Enhancements (P2/P3)

12. UI enhancements: global shortcut, drag-and-drop, @mention, inline field editing, label/assignee filters.
13. Admin user creation UI/API.
14. PostgreSQL full-text search.
15. Refactor Server Components to use Service layer consistently.
16. Replace `as any` / `as never` with proper typing.
17. E2E tests use hard-coded requirement IDs.

---

## Verification Status

- `npm run lint`: ✅ Pass
- `npm run typecheck`: ✅ Pass
- `npm test`: ✅ Pass (86 tests)
- `npm run test:e2e`: ⚠️ Cannot run (Playwright Chromium download failure in this environment)
- `npm run build`: ✅ Pass

---

## References

- `docs/spec.md`
- `docs/plan.md`
- `src/lib/transitions.ts`
- `src/services/requirement.service.ts`
- `src/services/comment.service.ts`
- `src/services/attachment.service.ts`
- `src/services/notification.service.ts`
- `src/app/api/notifications/stream/route.ts`
- `src/components/layout/notification-bell.tsx`
- `.env.example`
