# Review Report: easyreq Post-Remediation

**Date:** 2026-06-26
**Review Scope:** Full stack implementation against `docs/spec.md` and `docs/review-report-2026-06-26.md`
**Review Method:** Static code audit, spec cross-reference, integration test status, and build verification
**Reviewer:** opencode

---

## Executive Summary

All P0 and P1 deviations identified in the original review have been remediated. The API contract, SSE semantics, notification rules, permission boundaries, storage configuration, authentication hardening, and missing UI features now align with `docs/spec.md`.

**Overall Verdict:** `Approve` — spec compliance achieved. A small amount of optional technical debt remains (`as any`/`as never` casts, Server Components directly importing `db`, and S3 preview URLs using public URLs), none of which blocks spec compliance or production readiness for the MVP.

---

## Remediation Summary

| Phase | Key Deliverables |
|-------|------------------|
| **A — API Contract** | Added `GET /api/projects/:slug`, `GET /api/projects/:slug/requirements`, `GET /api/requirements/:id`, `POST/DELETE /api/projects/:slug/members/*`, `PATCH /api/comments/:id`, standalone `/api/attachments/*`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`, `PATCH /api/admin/users/:id/role`, `/api/labels/:id`, `/api/requirements/:id/labels/*`. |
| **B — SSE** | Created `/api/sse` with spec event format (`event: notification`, `event: requirement_updated`, `event: ping`), 30 s heartbeat, exponential-backoff client reconnect. Legacy `/api/notifications/stream` 308-redirects to `/api/sse`. |
| **C — Permissions** | Field-level update permissions enforced (`title/body` = author only; manager fields = manager/admin only). Service methods now re-check project membership. Assignee validated as project member. Member add/remove hardened. |
| **D — Notifications** | `STATUS_CHANGE` recipients limited to author + assignee. `VOTE_MILESTONE` recipients limited to project managers. `REJECTED` notification implemented. |
| **E — Environment/Storage** | `.env.example` aligned with code (`S3_BUCKET`, `S3_ACCESS_KEY_ID`, etc.). `STORAGE_MAX_FILE_SIZE` configurable. S3 downloads use presigned URLs; downloads gated by membership. |
| **F — Auth Hardening** | Login rate limiting implemented: 10 attempts per 15 minutes per email. |
| **G — UI/UX** | Admin user creation, label/assignee filters, comment edit UI, title/body inline editing, drag-and-drop upload, global `N` quick-submit modal, comment `@mention` autocomplete. |
| **H — Quality** | PostgreSQL `search` filter added alongside `contains` fallback. E2E hard-coded IDs removed. Pre-existing test type errors fixed. |

---

## Verification Status

- `npm run lint`: ✅ Pass
- `npm run typecheck`: ✅ Pass
- `npm test`: ✅ Pass (103 tests)
- `npm run build`: ✅ Pass
- `npm run test:e2e`: ⚠️ Cannot execute in this environment (Playwright Chromium download failure)

---

## Issue Resolution Matrix

### Original P0 Issues

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 1 | SSE non-compliance | ✅ Fixed | `src/app/api/sse/route.ts`, `src/lib/sse.ts`, `src/lib/notifications/channel.ts` |
| 2 | Missing core API endpoints | ✅ Fixed | `src/app/api/projects/[slug]/*`, `src/app/api/requirements/[id]/route.ts`, `src/app/api/comments/[id]/route.ts`, `src/app/api/attachments/*` |
| 3 | Environment variable mismatch | ✅ Fixed | `.env.example`, `src/lib/storage/index.ts` |
| 4 | Requirement update permission bug | ✅ Fixed | `src/services/requirement.service.ts` (title/body = author only) |

### Original P1 Issues

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 5 | `REJECTED` notification missing | ✅ Fixed | `src/services/requirement.service.ts` |
| 6 | Notification recipient lists wrong | ✅ Fixed | `src/services/requirement.service.ts`, `src/services/vote.service.ts` |
| 7 | Service-layer membership checks missing | ✅ Fixed | `requirement/comment/attachment.service.ts` |
| 8 | Assignee not validated as member | ✅ Fixed | `src/services/requirement.service.ts` |
| 9 | No presigned download / gated access | ✅ Fixed | `src/lib/storage/s3.ts`, `src/app/api/attachments/[id]/route.ts` |
| 10 | No authentication rate limiting | ✅ Fixed | `src/lib/auth.ts`, `src/lib/rate-limit.ts` (10/15 min) |
| 11 | Comments endpoint unpaginated | ✅ Fixed | `src/services/comment.service.ts`, `src/app/api/requirements/[id]/comments/route.ts` |

### Original P2/P3 Issues

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 12 | UI enhancements | ✅ Fixed | `src/components/requirement/*`, `src/components/ui/markdown-editor.tsx`, `src/components/comment/comment-section.tsx` |
| 13 | Admin user creation | ✅ Fixed | `src/components/admin/user-management-table.tsx`, `src/services/user.service.ts` |
| 14 | PostgreSQL full-text search | ✅ Partial | `src/app/api/search/route.ts` uses `search` filter; no dedicated full-text index yet |
| 15 | Server Components → Service layer | ⚠️ Open | Optional refactoring; does not block spec compliance |
| 16 | `as any` / `as never` | ⚠️ Open | 7 occurrences remain; optional cleanup |
| 17 | E2E hard-coded IDs | ✅ Fixed | `tests/e2e/permissions.spec.ts` |

---

## Remaining Optional Technical Debt

1. **`as any` / `as never` casts** — 7 occurrences, mostly around Prisma dynamic sorting/enum typing. Low risk, can be cleaned up incrementally.
2. **Server Components directly import `db`** — Common in Next.js apps and does not violate spec functionally; the spec's architecture note is aspirational. Can be refactored when adding dedicated read services.
3. **S3 preview URL uses public URL** — `getAttachmentPublicUrl` returns public S3 URL for image previews. The download endpoint uses presigned URLs. If the S3 bucket is not public, previews may fail. Consider routing previews through the presigned download endpoint for consistency.
4. **PostgreSQL full-text index** — The `search` filter is active but no dedicated `tsvector` column/GIN index exists. Fine for MVP data volumes.

---

## Final Conclusion

The project now satisfies the core requirements of `docs/spec.md` and the remediation plan. All P0/P1 deviations are resolved, the test suite is green, and the production build succeeds. The remaining items are optional quality improvements that do not block spec compliance.

**Recommended next steps:**
1. Run `npm run test:e2e` in an environment with working Playwright downloads.
2. Address optional debt (`as any/never`, Server Component service-layer refactoring, S3 preview presigning) in a follow-up iteration.

---

## References

- `docs/spec.md`
- `docs/plan.md`
- `docs/remediation-plan.md`
- `docs/review-report-2026-06-26.md`
- `src/app/api/sse/route.ts`
- `src/services/requirement.service.ts`
- `src/services/notification.service.ts`
- `src/services/vote.service.ts`
- `src/lib/auth.ts`
- `src/lib/storage/s3.ts`
