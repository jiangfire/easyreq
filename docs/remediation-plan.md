# Remediation Plan: easyreq

**Date:** 2026-06-26
**Status:** Draft — awaiting approval to begin implementation
**Basis:** `docs/review-report-2026-06-26.md`, `docs/spec.md`, `docs/plan.md`

---

## Decisions

1. **Spec is the source of truth.** All API paths, HTTP methods, SSE semantics, notification rules, and permission models will be brought into compliance with `docs/spec.md`.
2. **No public registration.** Because the spec defines easyreq as internal-only and users are created by Admin, the `/register` page referenced in the plan will be replaced by an Admin-only user creation flow.
3. **Standalone attachment endpoints.** The spec defines `/api/attachments/upload`, `/api/attachments/:id`, and `DELETE /api/attachments/:id`. The current requirement-scoped upload endpoint will be deprecated in favor of the spec design.
4. **SSE endpoint is `/api/sse`.** The current `/api/notifications/stream` endpoint will be replaced or aliased to `/api/sse`, and event formats will match the spec.

---

## Remediation Phases

### Phase A: API Contract Compliance (P0)

**Goal:** Make every endpoint match `docs/spec.md` exactly.

| # | Task | Files Likely Touched | Acceptance Criteria |
|---|------|----------------------|---------------------|
| A.1 | Create `GET /api/projects/:slug` | `src/app/api/projects/[slug]/route.ts` | Returns project details + current user's role in project; rejects non-members. |
| A.2 | Create `GET /api/projects/:slug/requirements` | `src/app/api/projects/[slug]/requirements/route.ts` | Supports status/priority/label/assignee filters, sort, pagination; rejects non-members. |
| A.3 | Create `GET /api/requirements/:id` | `src/app/api/requirements/[id]/route.ts` | Returns full requirement detail; rejects non-members. |
| A.4 | Create project member endpoints | `src/app/api/projects/[slug]/members/route.ts`, `src/app/api/projects/[slug]/members/[userId]/route.ts` | `POST` add member with role; `DELETE` remove member; only OWNER/MANAGER/ADMIN; validate target user exists and is not already a member. |
| A.5 | Create `PATCH /api/comments/:id` | `src/app/api/comments/[id]/route.ts` | Author can edit within time window; MANAGER/ADMIN can edit any; rejects non-members. |
| A.6 | Create standalone attachment endpoints | `src/app/api/attachments/upload/route.ts`, `src/app/api/attachments/[id]/route.ts` | `POST /upload` accepts `requirementId` + file; `GET /:id` streams local or 302 presigned S3; `DELETE /:id` validates ownership/manager role; all operations check project membership. |
| A.7 | Align notification endpoints | `src/app/api/notifications/[id]/read/route.ts`, `src/app/api/notifications/read-all/route.ts` | `PATCH /:id/read` and `POST /read-all` match spec; keep existing batch endpoint only if backward compatibility required. |
| A.8 | Align admin role endpoint | `src/app/api/admin/users/[id]/role/route.ts` | `PATCH /:id/role` uses path parameter. |
| A.9 | Fix `PATCH /api/requirements/:id` schema | `src/app/api/requirements/[id]/route.ts`, `src/lib/validation/requirement.ts` | Accept `assigneeId`, `labelIds`, and other editable fields with proper Zod schema. |

---

### Phase B: SSE Compliance (P0)

**Goal:** Replace SSE implementation with spec-compliant `/api/sse`.

| # | Task | Files Likely Touched | Acceptance Criteria |
|---|------|----------------------|---------------------|
| B.1 | Create `/api/sse` route | `src/app/api/sse/route.ts` | Authenticates via session cookie; emits only events relevant to current user. |
| B.2 | Implement spec event format | `src/lib/sse.ts` (new or update) | Events use `event: notification`, `event: requirement_updated`, `event: ping`; heartbeat every 30 s as `event: ping`. |
| B.3 | Publish `requirement_updated` events | `src/services/notification.service.ts`, `src/lib/notifications/channel.ts` | Channel publishes requirement update events in addition to notification events. |
| B.4 | Update client SSE hook | `src/hooks/use-notifications.ts` (new or update), `src/components/layout/notification-bell.tsx` | Connects to `/api/sse`; implements exponential backoff reconnection (1 s / 2 s / 4 s / 8 s / max 30 s). |
| B.5 | Remove or redirect legacy stream | `src/app/api/notifications/stream/route.ts` | Either delete or 308 redirect to `/api/sse`. |

---

### Phase C: Permissions & Service Layer Hardening (P0 / P1)

**Goal:** Close permission gaps and enforce field-level edit rules.

| # | Task | Files Likely Touched | Acceptance Criteria |
|---|------|----------------------|---------------------|
| C.1 | Enforce field-level update permissions | `src/services/requirement.service.ts`, `src/lib/validation/requirement.ts` | Author: title + body only. Manager/Admin: priority, assignee, expectedDate, acceptanceCriteria, labels. Others: read-only. |
| C.2 | Validate assignee is project member | `src/services/requirement.service.ts` | `assigneeId` must be a member of the requirement's project; null allowed to unassign. |
| C.3 | Re-check membership in service methods | `src/services/requirement.service.ts`, `src/services/comment.service.ts`, `src/services/attachment.service.ts` | `transition`, `update`, `softDelete`, `delete` all verify project membership before acting. |
| C.4 | Harden member management | `src/services/project.service.ts` | `addMember` validates user existence and duplicate membership; only OWNER/MANAGER/ADMIN can add/remove. |
| C.5 | Add comment pagination | `src/app/api/requirements/[id]/comments/route.ts` | Accept `page` / `limit`; default 25 per page. |

---

### Phase D: Notification Rules (P1)

**Goal:** Match spec notification triggers and recipients exactly.

| # | Task | Files Likely Touched | Acceptance Criteria |
|---|------|----------------------|---------------------|
| D.1 | Fix `STATUS_CHANGE` recipients | `src/services/notification.service.ts` | Notify author + assignee only. |
| D.2 | Implement `REJECTED` notification | `src/services/requirement.service.ts`, `src/services/notification.service.ts` | On transition to `REJECTED`, create `REJECTED` notification to author. |
| D.3 | Fix `VOTE_MILESTONE` recipients | `src/services/vote.service.ts` | Notify project managers only (remove author). |
| D.4 | Verify `COMMENT` recipients | `src/services/comment.service.ts` | Author + assignee + prior commenters, deduplicated. |
| D.5 | Verify `ASSIGNMENT` recipients | `src/services/requirement.service.ts` | Notify assignee when `assigneeId` changes. |

---

### Phase E: Environment & Storage (P0 / P1)

**Goal:** Align environment variables with code and implement secure attachment downloads.

| # | Task | Files Likely Touched | Acceptance Criteria |
|---|------|----------------------|---------------------|
| E.1 | Align `.env.example` with code | `.env.example` | Either rename variables in code to match `STORAGE_S3_BUCKET` etc., or update `.env.example` to match `S3_BUCKET` etc. Decision: align `.env.example` to code to minimize churn, unless spec names are mandated. |
| E.2 | Make max file size configurable | `src/lib/storage/index.ts`, `.env.example` | Read `STORAGE_MAX_FILE_SIZE` with 10 MB default. |
| E.3 | Implement S3 presigned downloads | `src/lib/storage/s3-provider.ts`, `src/app/api/attachments/[id]/route.ts` | `getPublicUrl` returns presigned URL; `GET /api/attachments/:id` returns 302 for S3. |
| E.4 | Gate downloads by membership | `src/app/api/attachments/[id]/route.ts` | Reject non-members. |

---

### Phase F: Auth Hardening (P1)

**Goal:** Add rate limiting to authentication endpoints.

| # | Task | Files Likely Touched | Acceptance Criteria |
|---|------|----------------------|---------------------|
| F.1 | Add login rate limiting | `src/lib/rate-limit.ts` (new), `src/app/api/auth/[...nextauth]/route.ts` or `src/proxy.ts` | Limit failed login attempts per IP/username; return 429 with `Retry-After`. |
| F.2 | Add API rate limiting (optional) | `src/proxy.ts` or route handlers | Generic per-IP rate limit on API routes. |

---

### Phase G: UI/UX Enhancements (P2)

**Goal:** Close gaps from plan Task 6, 6.5b, 8, 9, 15.

| # | Task | Files Likely Touched | Acceptance Criteria |
|---|------|----------------------|---------------------|
| G.1 | Global shortcut `N` quick submit | `src/components/requirement/global-quick-submit.tsx`, `src/app/(main)/layout.tsx` | Pressing `N` opens a command-palette-style modal; `Esc` closes. |
| G.2 | Drag-and-drop upload | `src/components/attachment/drop-zone.tsx`, `src/components/ui/markdown-editor.tsx` | Drop files onto editor or a designated zone to upload. |
| G.3 | Comment `@mention` autocomplete | `src/components/comment/mention-input.tsx` | Type `@` to show project members; insert Markdown link. |
| G.4 | Comment edit UI | `src/components/comment/comment-list.tsx`, `src/components/comment/comment-form.tsx` | Edit button for author/manager; inline switch to editor. |
| G.5 | Inline edit title/body/expectedDate/acceptanceCriteria | `src/components/requirement/inline-edit.tsx`, requirement detail page | Author edits title/body; Manager edits expectedDate/acceptanceCriteria. |
| G.6 | Filter list by label/assignee | `src/components/requirement/requirement-filters.tsx` | Dropdown/checkbox filters applied to list and URL query params. |
| G.7 | Admin user creation | `src/app/admin/users/page.tsx`, `src/app/api/admin/users/route.ts` | Admin can create user with name/email/password/role; password hashed. |

---

### Phase H: Search & Quality (P2 / P3)

**Goal:** Improve search and code hygiene.

| # | Task | Files Likely Touched | Acceptance Criteria |
|---|------|----------------------|---------------------|
| H.1 | PostgreSQL full-text search | `prisma/schema.prisma`, `src/services/search.service.ts` | Add search vector/index; `to_tsvector` query over title + body. |
| H.2 | Remove `as any` / `as never` | `src/services/requirement.service.ts`, etc. | Use narrowed Prisma types or helper functions. |
| H.3 | Migrate Server Components to Service layer | Dashboard, admin, detail pages | No direct `db` imports in pages; use services. |
| H.4 | Fix E2E hard-coded IDs | `tests/e2e/*.ts` | Create requirements during test setup and use generated IDs. |
| H.5 | Re-enable E2E execution | `playwright.config.ts` | Verify Chromium download in target environment. |

---

## Task Dependency Graph

```
Phase A (API Contract)
  ├─→ Phase B (SSE)              [uses notification channel]
  ├─→ Phase C (Permissions)      [touches requirement/comment/attachment services]
  ├─→ Phase D (Notifications)    [depends on C membership checks]
  └─→ Phase E (Env/Storage)      [can run in parallel with D]

Phase F (Auth Hardening)         [independent, can run after A]
Phase G (UI Enhancements)        [depends on A/C/D/E endpoints]
Phase H (Search & Quality)       [low priority, independent]
```

---

## Suggested Execution Order

1. **Start with Phase A + Phase C together.** These fix the most severe contract and permission issues and unblock downstream UI work.
2. **Then Phase B + Phase D.** SSE and notifications are tightly coupled; changing one without the other risks broken real-time behavior.
3. **Then Phase E + Phase F.** Configuration and security hardening.
4. **Phase G and Phase H** can be done in parallel after the core contract is stable.

---

## Exit Criteria

- Every endpoint in `docs/spec.md` exists with the correct path and method.
- `/api/sse` emits `notification`, `requirement_updated`, and `ping` events with correct format.
- `REJECTED` notifications are sent; `STATUS_CHANGE` and `VOTE_MILESTONE` recipients match spec.
- Requirement update enforces field-level permissions and validates assignee.
- `.env.example` matches the variables actually read by the application.
- `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all pass.
- E2E tests run successfully in an environment with working Playwright downloads.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSE endpoint rename breaks existing clients | Low | Update the single `useNotifications` hook in the same change. |
| Permission tightening breaks existing tests | Medium | Update unit/integration tests alongside service changes. |
| S3 env rename breaks deployed config | Medium | Document rename in changelog and provide migration note. |
| Large change set | Medium | Land phases as separate, self-contained PRs as shown above. |

---

## Changelog Note (Pending)

Once remediation begins, append to `CHANGELOG.md`:

```markdown
## [Unreleased]
### Fixed
- Aligned all API endpoints with spec paths and methods.
- Replaced `/api/notifications/stream` with spec-compliant `/api/sse`.
- Enforced field-level permissions on requirement updates.
- Fixed notification recipient rules and added `REJECTED` notification type.
- Aligned S3 / local storage environment variables with implementation.
```
