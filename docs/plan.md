# Implementation Plan: easyreq

## Overview

类 GitHub Issues 的企业内部需求收集与跟踪工具。核心 UX 原则：**提需求阻力最小化** — 用户只需一个标题即可提交需求，所有 IPD 字段（优先级、分类、验收标准等）均为可选，可在后续评审阶段由管理者补充。支持 Markdown 实时预览、附件上传（本地/S3）、IPD 状态流转（含快速通道）、SSE 实时通知。

## Architecture Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据获取 | Server Components | 页面渲染数据直接在服务端获取，零客户端请求 |
| 数据变更 | Server Actions | 表单提交、CRUD 操作，与 React 渲染深度集成 |
| 实时通知 | Route Handler (SSE) | SSE 需要独立 HTTP 端点，不适合 Server Actions |
| 文件上传 | Route Handler (multipart) | multipart/form-data 处理需要独立 HTTP 端点 |
| 业务逻辑 | Service 层 | Server Actions 和 Route Handlers 共享同一 Service 层 |
| 提交摩擦 | 渐进式字段 | 创建时只需标题，其他字段可后续补充 |
| 状态流转 | 标准路径 + 快速通道 | 严格 IPD + Manager 可跳过中间状态 |
| Markdown | react-markdown + remark-gfm | 实时预览，支持 GFM |
| 文件存储 | StorageProvider 抽象 | 本地 / S3 通过环境变量切换 |

## 低摩擦提交设计

```
最小提交：只需标题（1个字段）
可选字段：描述(Markdown)、优先级、分类、期望日期、验收标准、附件
提交方式：
  1. 列表页顶部内联输入框（最快，类似 GitHub "New issue" 内联）
  2. 完整表单页（需要详细描述时，可选字段折叠在"更多选项"中）
  3. 全局快捷键 "N" 打开快速提交弹窗（Command Palette 风格）
提交后：
  - 自动跳转到新需求详情页
  - 草稿自动保存到 localStorage（防丢失）
  - Ctrl+Enter 快捷提交
```

## Task List

---

### Phase 1: Foundation（基础设施）

#### Task 1: 项目脚手架 + 基础配置

**Description:** 初始化 Next.js 16 项目，配置 TypeScript、Tailwind CSS v4、ESLint、Prisma 7。**未使用 shadcn/ui**（手写 Tailwind 组件）。创建 `src/lib/errors.ts`（AppError 统一错误类）。

**Acceptance criteria:**
- [ ] `npm run dev` 启动成功
- [ ] `npm run lint` 和 `npm run typecheck` 通过
- [ ] 目录结构与 Spec 一致（含 `src/lib/errors.ts`）
- [ ] Prisma 可连接 PostgreSQL
- [ ] `.env.example` 包含所有环境变量模板（含 `PORT`、`STORAGE_LOCAL_*`）

**Verification:**
- `npm run dev` 启动无报错
- `npm run lint && npm run typecheck` 通过

**Dependencies:** None

**Files likely touched:**
- `package.json`（注意：项目实际使用 Next.js 16 + Prisma 7 + Tailwind v4，不是 plan 里写的 Next.js 15）
- `tsconfig.json`
- `next.config.ts`
- `eslint.config.mjs`（ESLint 9 flat config）
- `postcss.config.mjs`
- `.env.example`
- `prisma/schema.prisma`
- `src/lib/db.ts` + `src/lib/errors.ts`

**Estimated scope:** L（实际是 M，多花在 Prisma 7 + Tailwind v4 的新配置语法上）

---

#### Task 2: 数据库 Schema + 迁移

**Description:** 编写完整 Prisma Schema（含 User, Project, ProjectMember, Requirement, Comment, Vote, StatusLog, Notification, Label, RequirementLabel, Attachment），创建初始迁移，编写 seed 脚本。

**Acceptance criteria:**
- [ ] `npx prisma migrate dev` 成功
- [ ] `npm run db:seed` 生成测试数据（2 项目、5 用户、20 需求、评论、投票）
- [ ] Prisma Studio 可查看数据
- [ ] 所有关系和级联删除正确

**Verification:**
- `npm run db:migrate && npm run db:seed`
- `npx prisma studio` 查看数据

**Dependencies:** Task 1

**Files likely touched:**
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/`

**Estimated scope:** M (3 files)

---

#### Task 3: 认证系统

**Description:** 配置 NextAuth.js v5（Credentials Provider），**只实现登录/登出**（不开放公开注册，与 Spec 已决议事项 #13 一致；用户由 Admin 在后台创建）。auth proxy 保护路由，`getCurrentUser()` 工具函数，角色定义。

**Acceptance criteria:**
- [ ] 用户可以登录、登出
- [ ] 未登录访问受保护页面自动跳转登录
- [ ] `getCurrentUser()` 返回当前用户信息和角色
- [ ] 密码使用 bcrypt 哈希存储
- [ ] **没有 register 页**（避免违反不开放注册原则）

**Verification:**
- 手动测试登录→访问受保护页面→登出
- `npm run typecheck` 通过

**Dependencies:** Task 2

**Files likely touched:**
- `src/lib/auth.ts` + `src/lib/auth.config.ts`
- `src/app/(auth)/login/page.tsx`
- `src/proxy.ts`（Next.js 16 把 `middleware.ts` 改名为 `proxy.ts`）
- `src/services/auth.service.ts`
- `src/types/next-auth.d.ts`

**Estimated scope:** M (5 files)

---

#### Task 4: 基础布局 + 导航

**Description:** 实现全局 Layout（侧边栏 + 顶栏 + 内容区），侧边栏含项目列表、Dashboard、通知入口，顶栏含用户头像、登出、全局搜索占位，响应式适配。

**Acceptance criteria:**
- [ ] 登录后显示主布局
- [ ] 侧边栏可导航到各页面
- [ ] 页面切换不刷新（客户端导航）
- [ ] 移动端基本可用

**Verification:**
- 手动测试导航和响应式

**Dependencies:** Task 3

**Files likely touched:**
- `src/app/(main)/layout.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/header.tsx`
- `src/components/layout/search-bar.tsx`

**Estimated scope:** M (4 files)

---

### Checkpoint: Foundation

- [ ] `npm run lint` 和 `npm run typecheck` 通过
- [ ] `npm run build` 成功
- [ ] `npm run db:migrate && npm run db:seed` 成功
- [ ] 用户可以注册（由 Admin 创建）、登录、看到主布局
- [ ] **Review with human before proceeding**

---

### Phase 2: 核心功能 — 项目与需求提交

#### Task 5: 项目空间 CRUD

**Description:** Service 层 `project.service.ts`，项目列表页（卡片式，显示需求数量），创建项目表单（名称、slug、描述），项目详情页骨架，项目成员管理。

**Acceptance criteria:**
- [ ] 可以创建项目
- [ ] 项目列表显示所有项目和需求计数
- [ ] 项目 slug 唯一性校验
- [ ] 项目创建者自动成为 OWNER

**Verification:**
- `npm run build` 通过
- 手动测试创建项目

**Dependencies:** Task 4

**Files likely touched:**
- `src/services/project.service.ts`
- `src/app/(main)/projects/page.tsx`
- `src/app/(main)/projects/[slug]/page.tsx`

**Estimated scope:** M (5 files)

---

#### Task 6a: MarkdownEditor 组件（拆分自 Task 6）

**Description:** 独立实现 `MarkdownEditor` 组件：**写/预览/分屏 三档 Tab**、分屏模式下中间 4px 可拖动栏实时调整左右比例、@ 提及成员自动补全、文件拖拽上传、toolbar（加粗/斜体/代码/链接/图片/列表/引用/标题）、输入防抖（300ms）避免大文档渲染卡顿。该组件在 Task 6（需求提交）和 Task 9（评论）中复用。

**Acceptance criteria:**
- [ ] Markdown 编辑器支持实时预览（300ms 防抖）
- [ ] 工具栏按钮可插入格式标记
- [ ] Tab 切换编辑/预览/分屏三种模式
- [ ] 分屏模式下可左右拖动调整左右宽度
- [ ] 渲染经过 rehype-sanitize（无 XSS）
- [ ] Ctrl+Enter 触发提交回调
- [ ] @ 提及成员列表 + 拖拽上传图片（可选）

**Verification:**
- 单元测试 sanitize 行为（输入 `<script>` 不执行）
- 手动测试实时预览、工具栏、拖动分屏栏

**Dependencies:** Task 1

**Files likely touched:**
- `src/components/ui/markdown-editor.tsx`
- `tests/unit/markdown.test.tsx`

**Estimated scope:** M（原估算 S 严重偏低；实际包含 toolbar + 拖动栏 + @mention + 拖拽 + 防抖，~400 行）

---

#### Task 6: 需求提交（低摩擦核心体验）

**Description:** 这是整个产品最关键的 Task。Service 层 `requirement.service.ts`，实现三种提交方式：快速提交（列表页内联输入框，标题+Enter）、完整提交（独立页面，标题必填+其他可选折叠）、全局快捷键 `N` 打开弹窗。草稿自动保存 localStorage，Ctrl+Enter 快捷提交，提交后跳转详情页。需求编号通过 `Project.lastRequirementNumber` + 事务行锁自增。复用 Task 6a 的 `MarkdownEditor`。

**Acceptance criteria:**
- [ ] 只需输入标题即可提交需求（< 5秒完成）
- [ ] 完整表单所有非标题字段均可选，折叠在"更多选项"中
- [ ] Markdown 编辑器支持实时预览（复用 Task 6a 组件）
- [ ] 草稿自动保存到 localStorage，刷新不丢失
- [ ] Ctrl+Enter 快捷提交
- [ ] 全局快捷键 `N` 打开快速提交弹窗
- [ ] 提交后跳转到详情页
- [ ] 需求编号自动递增（#1, #2, #3...），并发安全

**Verification:**
- 手动测试三种提交方式
- 单元测试 getNextNumber 并发安全
- 验证草稿保存和恢复

**Dependencies:** Task 5, Task 6a

**Files likely touched:**
- `src/services/requirement.service.ts`
- `src/app/(main)/projects/[slug]/requirements/new/page.tsx`
- `src/components/requirement/quick-submit.tsx`（项目内嵌标题快提）
- `src/components/requirement/requirement-form.tsx`（完整页表单）
- `src/components/requirement/global-quick-submit.tsx`（全局 FAB + N 键弹窗）
- `src/components/requirement/requirement-form-fields.tsx`（共享字段）
- `src/lib/validation/requirement.ts`
- `src/hooks/use-requirement-draft.ts`（localStorage 草稿）

**Estimated scope:** L（实际比 M 大，因为多了全局弹窗 + 共享表单字段组件 + 草稿 hook）

---

#### Task 6.5a: 存储抽象层（拆分自 Task 6.5）

**Description:** 实现 `StorageProvider` 接口抽象层，支持本地存储和 S3 兼容存储（MinIO/阿里OSS）两种实现，通过环境变量配置切换。

**Acceptance criteria:**
- [ ] `STORAGE_PROVIDER=local` 时文件存储到本地 `uploads/` 目录
- [ ] `STORAGE_PROVIDER=s3` 时文件上传到 S3 兼容存储
- [ ] `getUrl()` local 返回相对路径，S3 返回预签名 URL
- [ ] 工厂函数根据环境变量返回正确实现

**Verification:**
- 单元测试 StorageProvider 接口（local + s3 mock）

**Dependencies:** Task 1

**Files likely touched:**
- `src/services/storage/types.ts`
- `src/services/storage/local-provider.ts`
- `src/services/storage/s3-provider.ts`
- `src/services/storage/index.ts`

**Estimated scope:** M (4 files)

---

#### Task 6.5b: 附件 API + UI（拆分自 Task 6.5）

**Description:** 附件 API（上传 multipart 含 requirementId、下载 local 流式/s3 302 预签名、删除），Markdown 编辑器图片按钮触发上传，需求详情页附件列表，拖拽上传区域。文件大小（10MB）和 mimeType 白名单校验。复用 Task 6.5a 的 StorageProvider。

**Acceptance criteria:**
- [ ] 文件大小和 mimeType 校验（白名单：image/jpeg, image/png, image/webp, image/gif, application/pdf, text/plain, application/zip）
- [ ] Markdown 编辑器可通过工具栏按钮上传图片并插入 Markdown
- [ ] 需求详情页显示附件列表（文件名、大小、上传者、时间）
- [ ] 支持拖拽上传
- [ ] 附件下载校验权限（项目成员）
- [ ] local 模式流式响应，S3 模式 302 跳转预签名 URL

**Verification:**
- 手动测试上传/下载/删除（local 模式）
- 单元测试 mimeType 白名单校验

**Dependencies:** Task 6.5a, Task 6a (MarkdownEditor 图片按钮)

**Files likely touched:**
- `src/app/api/attachments/upload/route.ts`
- `src/app/api/attachments/[id]/route.ts`
- `src/components/attachment/attachment-list.tsx`
- `src/components/attachment/drop-zone.tsx`

**Estimated scope:** M (4 files)

---

#### Task 7: 需求列表页

**Description:** 类 GitHub Issues 列表，每行显示编号、标题、状态标签、优先级、投票数、评论数、附件标识、创建时间。筛选（状态/优先级/标签/指派人），排序（最新/最多投票/最近更新），分页（每页 25 条）。状态标签颜色编码。

**Acceptance criteria:**
- [ ] 列表正确显示所有需求及元信息
- [ ] 筛选和排序功能正常
- [ ] 分页工作正常
- [ ] 列表页加载 < 500ms（1000 条以内）
- [ ] 有附件的需求显示附件标识

**Verification:**
- `npm run build` 通过
- 手动测试筛选、排序、分页

**Dependencies:** Task 6

**Files likely touched:**
- `src/app/(main)/projects/[slug]/page.tsx`
- `src/components/requirement/requirement-list.tsx`
- `src/components/requirement/requirement-filters.tsx`
- `src/components/requirement/status-badge.tsx`

**Estimated scope:** M (5 files)

---

#### Task 8: 需求详情页

**Description:** 顶部编号+标题+状态标签+操作按钮，正文区 Markdown 渲染需求描述（rehype-sanitize），右侧栏元信息（优先级/指派人/期望日期/标签/投票数），状态时间线（含快速通道标记），内联编辑所有字段（权限控制），附件列表展示。**不采用组件插槽模式**（实际开发是单人串行，不存在并行冲突；详情页直接组装 `editable-fields`、`status-actions`、`vote-button`、`comment-section` 等子组件）。

**Acceptance criteria:**
- [ ] 详情页正确渲染所有信息
- [ ] Markdown 描述正确渲染（支持 GFM，经过 rehype-sanitize）
- [ ] 状态时间线完整显示，快速通道跳转有视觉标记
- [ ] 有权限的用户可内联编辑字段（author 改 title/body，Manager 改 priority/assignee）
- [ ] 附件列表正确显示，可下载

**Verification:**
- 手动测试详情页所有功能

**Dependencies:** Task 7, Task 6.5b

**Files likely touched:**
- `src/app/(main)/projects/[slug]/requirements/[id]/page.tsx`
- `src/components/requirement/editable-fields.tsx`（内联编辑）
- `src/components/requirement/status-actions.tsx`（状态操作按钮）
- `src/components/requirement/status-timeline.tsx`
- `src/components/requirement/vote-button.tsx`
- `src/components/requirement/label-selector.tsx`
- `src/components/requirement/assignee-selector.tsx`

**Estimated scope:** L (7 files)

---

### Checkpoint: Core Features

- [ ] 完整流程：创建项目 → 提交需求（快速+完整） → 列表查看 → 详情查看
- [ ] 低摩擦提交体验验证：标题+Enter < 5秒
- [ ] Markdown 实时预览正常（rehype-sanitize 生效）
- [ ] 附件上传/下载正常（local 模式）
- [ ] 需求编号并发安全（单元测试通过）
- [ ] **Review with human before proceeding**

---

### Phase 3: 互动与状态流转

#### Task 9: 评论系统

**Description:** Service 层 `comment.service.ts`，需求详情页底部评论区，复用 `MarkdownEditor` 组件（含实时预览），@mention 用户（自动补全项目成员），编辑/删除自己的评论。

**Acceptance criteria:**
- [ ] 可以添加 Markdown 评论，实时预览
- [ ] 可以编辑/删除自己的评论
- [ ] @mention 显示项目成员列表自动补全
- [ ] 评论按时间正序显示

**Verification:**
- 手动测试评论 CRUD + Markdown 预览 + @mention

**Dependencies:** Task 8

**Files likely touched:**
- `src/services/comment.service.ts`
- `src/components/comment/comment-list.tsx`
- `src/components/comment/comment-form.tsx`
- `src/components/comment/mention-input.tsx`
- `src/lib/validation/comment.ts`

**Estimated scope:** M (5 files)

---

#### Task 10: 投票系统

**Description:** Service 层 `vote.service.ts`，需求详情页投票按钮（toggle），列表页显示投票数，投票里程碑通知（达到 5/10/20 票时通知管理者）。

**Acceptance criteria:**
- [ ] 点击投票按钮 toggle 投票状态
- [ ] 投票数实时更新
- [ ] 每人每个需求只能投一票
- [ ] 达到里程碑时通知管理者

**Verification:**
- 手动测试投票 toggle
- 单元测试里程碑通知逻辑

**Dependencies:** Task 8

**Files likely touched:**
- `src/services/vote.service.ts`
- `src/components/requirement/vote-button.tsx`

**Estimated scope:** S (2 files)

---

#### Task 11: IPD 状态流转

**Description:** Service 层 `requirement.service.ts` 扩展 `transition()` 方法，状态流转规则引擎（标准路径 + 快速通道 + 角色权限校验），详情页状态操作按钮（根据当前状态和用户角色动态显示可用操作），流转时可选填备注，自动写 StatusLog（含 isQuickPath 标记），驳回时通知提交者。

**Acceptance criteria:**
- [ ] 所有合法标准状态转换可执行
- [ ] Manager 可执行快速通道跳转（SUBMITTED→IN_DEVELOPMENT 等）
- [ ] 快速通道跳转的 StatusLog 标记 isQuickPath=true
- [ ] 非法转换被拒绝（含错误提示）
- [ ] 角色权限正确校验（Manager 评审、Developer 开发、Submitter 验收）
- [ ] 每次流转写入 StatusLog
- [ ] 驳回自动通知提交者
- [ ] 详情页状态操作按钮根据角色动态显示

**Verification:**
- 单元测试覆盖完整流转矩阵（8×8=64 种转换 + 快速通道）
- 手动测试标准路径和快速通道

**Dependencies:** Task 8

**Files likely touched:**
- `src/services/requirement.service.ts`
- `src/lib/constants.ts` (流转矩阵 + 权限矩阵)
- `src/components/requirement/status-actions.tsx`
- `tests/unit/requirement-transition.test.ts`

**Estimated scope:** M (5 files)

---

#### Task 11.5: 通知集成钩子

**Description:** 在 `comment.service.ts`、`vote.service.ts`、`requirement.service.ts.transition()` 中添加通知触发钩子，调用 `notification.service.ts` 的创建方法。定义通知触发规则（见 Spec 通知触发规则表）。投票里程碑阈值：5/10/20/50 票。此 Task 填充 Task 8 预留的组件插槽（comments/vote/actions）。

**Acceptance criteria:**
- [ ] 状态变更触发 STATUS_CHANGE 通知到 author + assignee
- [ ] 驳回触发 REJECTED 通知到 author
- [ ] 新评论触发 COMMENT 通知到 author + assignee + 之前评论者（去重）
- [ ] 投票达到 5/10/20/50 票触发 VOTE_MILESTONE 通知到项目所有 Manager
- [ ] 被指派触发 ASSIGNMENT 通知到被指派用户
- [ ] 评论/投票/状态操作 UI 填入 Task 8 预留的插槽

**Verification:**
- 单元测试通知触发逻辑（各触发点 + 接收人计算）

**Dependencies:** Task 9, Task 10, Task 11

**Files likely touched:**
- `src/services/notification.service.ts`
- `src/services/comment.service.ts` (添加通知钩子)
- `src/services/vote.service.ts` (添加通知钩子)
- `src/services/requirement.service.ts` (添加通知钩子)
- `src/lib/constants.ts` (里程碑阈值)

**Estimated scope:** M (5 files)

---

#### Task 12: SSE 传输 + 通知 UI

**Description:** SSE Route Handler `/api/sse` 端点（基于 NextAuth session cookie 认证，事件过滤只推送当前用户相关事件），心跳 30s，SSE 客户端 hook `useNotifications()` 自动连接接收推送，断线指数退避重连（1s/2s/4s/8s/最大 30s），通知列表页 + 顶栏未读计数 badge + 全部标记已读。SSE 事件格式见 Spec。

**Acceptance criteria:**
- [ ] SSE 通过 session cookie 认证（EventSource 自动携带）
- [ ] 只推送当前用户相关的事件
- [ ] 状态变更后 3 秒内通知到相关用户
- [ ] 顶栏显示未读通知数
- [ ] 点击通知跳转到对应需求
- [ ] SSE 断线自动重连（指数退避）
- [ ] 30s 心跳检测连接健康
- [ ] 全部标记已读功能

**Verification:**
- 手动测试：两个浏览器窗口，一个操作，另一个收到通知
- 验证 SSE 事件格式和过滤

**Dependencies:** Task 11.5

**Files likely touched:**
- `src/app/api/sse/route.ts`
- `src/lib/sse.ts`
- `src/components/layout/notification-badge.tsx`
- `src/hooks/use-notifications.ts`
- `src/app/(main)/notifications/page.tsx`

**Estimated scope:** M (5 files)

---

### Checkpoint: Interaction & Workflow

- [ ] 完整流程：提交 → 评审 → 规划 → 开发 → 测试 → 交付 → 验收
- [ ] 快速通道：提交 → 直接开发 → 交付 → 验收
- [ ] 回退路径：测试→开发退回、交付→开发退回、验收后 reopen
- [ ] 评论、投票、状态变更通知实时推送（SSE < 3 秒）
- [ ] 投票里程碑通知（5/10/20/50 票）
- [ ] 状态流转权限校验正确（单元测试 100% 覆盖）
- [ ] **Review with human before proceeding**

---

### Phase 3.5：未归集需求扩展（项目后建）

> 这一阶段是产品模型的核心调整：从"所有需求必须挂项目"改为"需求可以先于项目存在"。在所有基础功能上线后由用户需求驱动加入。

#### Task 18: Schema 改造 + 全局编号

**Description:** `Requirement.projectId` 和 `number` 改为可空，新增 `globalNumber` 字段（全局唯一）和 `GlobalCounter` 表（原子自增）。迁移：把现有需求的 projectId/number 保持不动，用 `ROW_NUMBER() OVER (createdAt)` 给所有已有需求补 globalNumber，并初始化 GlobalCounter 为 MAX(globalNumber)。

**Acceptance criteria:**
- [ ] `prisma migrate deploy` 成功
- [ ] 所有已有需求有合法 globalNumber（1..N）
- [ ] 新建未归集需求自动分配下一个 globalNumber
- [ ] 迁移是幂等的（重复执行不破坏数据）

**Verification:**
- `prisma migrate deploy` 应用迁移
- 手动 SELECT globalNumber 验证连续性

**Dependencies:** Task 13（管理后台的 review 流程需要先稳定）

**Files likely touched:**
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_support_unassigned_requirements/`

**Estimated scope:** S (2 files)

---

#### Task 19: 未归集需求的创建与访问

**Description:**
- 新增 `POST /api/requirements`（无 projectId，任何登录用户）
- 新增 `requirementService.createUnassigned()` 走 GlobalCounter 生成 globalNumber
- 新增 `/requirements/[id]` 页面（不带项目上下文，简化版详情页）
- 改造 `dashboard` 改为 flat list（显示用户提交 + 指派给自己的需求）
- 改造 `getById` 权限：未归集需求仅作者本人 / MANAGER / ADMIN 可读

**Acceptance criteria:**
- [ ] 任何登录用户可调用 `POST /api/requirements` 创建未归集需求
- [ ] 客户仪表盘显示自己的需求列表（含未归集 + 已归集）
- [ ] 未归集需求详情页可访问，URL `/requirements/[id]`
- [ ] 已归集需求详情页 `/projects/[slug]/requirements/[id]` 正常工作
- [ ] 集成测试覆盖未归集需求的 CRUD

**Verification:**
- `npm run test` 通过
- 手动测试客户提交 → 仪表盘 → 详情页

**Dependencies:** Task 18

**Files likely touched:**
- `src/services/requirement.service.ts`
- `src/services/requirement-access.ts`（新的共享权限校验）
- `src/app/api/requirements/route.ts`（新建）
- `src/app/api/requirements/[id]/route.ts`
- `src/app/(main)/requirements/[id]/page.tsx`（新建）
- `src/app/(main)/dashboard/page.tsx`
- `tests/integration/requirements.test.ts`

**Estimated scope:** L

---

#### Task 20: 需求池 + 归集到项目

**Description:**
- 新增 `/requirements/inbox` 页面（MANAGER/ADMIN 可见，列出所有未归集需求）
- 新增 `/admin/inbox` 复用同一组件（管理员入口）
- 新增 `GET /api/requirements/inbox`
- 新增 `PATCH /api/requirements/[id]/project` 把未归集需求归集到指定项目（生成项目内 number）
- 改造 `createProject` 弹窗：新建项目时可勾选若干未归集需求一并归集
- 调整侧边栏：SUBMITTER 看不到项目和需求池入口；MANAGER/ADMIN 多一个"需求池"

**Acceptance criteria:**
- [ ] MANAGER/ADMIN 在需求池看到所有未归集需求
- [ ] 需求详情页提供"归集到项目"按钮（仅 MANAGER/ADMIN）
- [ ] 新建项目弹窗支持批量勾选归集
- [ ] 归集后需求自动获得项目内 number
- [ ] 归集成功后作者收到 STATUS_CHANGE 通知

**Verification:**
- 手动测试：客户提需求 → MANAGER 需求池 → 归集到新建项目
- `npm run test` 通过

**Dependencies:** Task 19

**Files likely touched:**
- `src/services/project.service.ts`（create 增加 requirementIds 参数）
- `src/services/requirement.service.ts`（assignToProject 方法）
- `src/app/api/requirements/inbox/route.ts`（新建）
- `src/app/api/requirements/[id]/project/route.ts`（新建）
- `src/app/(main)/requirements/inbox/page.tsx`（新建）
- `src/app/admin/inbox/page.tsx`（新建）
- `src/components/requirement/requirement-inbox.tsx`（新建）
- `src/components/requirement/assign-to-project.tsx`（新建）
- `src/components/requirement/create-project-dialog.tsx`（改造）
- `src/components/layout/sidebar.tsx`（角色感知）

**Estimated scope:** L

---

#### Task 21: 未归集需求的服务层适配

**Description:** 让 comment / vote / attachment / label / search / notification 在未归集需求上也能工作：
- vote: 任何登录用户可对未归集需求投票（"低阻力反馈"）
- comment: 任何登录用户可对未归集需求评论
- attachment: 作者 / MANAGER / ADMIN 可上传/删除附件
- label: 未归集需求不能贴 Label（Label 是项目维度）
- search: 未归集需求检索范围 = 作者本人提交的
- notification: 未归集需求的事件只广播给作者；归集后恢复项目成员广播
- transition: 未归集需求仅允许 SUBMITTED ↔ REJECTED（绕过标准 IPD 矩阵）

**Acceptance criteria:**
- [ ] 未归集需求可投票、可评论、可上传附件
- [ ] 未归集需求不能贴 Label
- [ ] 未归集需求的状态流转被严格限制
- [ ] SSE 广播规则正确
- [ ] 通知触发规则正确

**Verification:**
- 集成测试覆盖各服务的未归集分支

**Dependencies:** Task 20

**Files likely touched:**
- `src/services/vote.service.ts`
- `src/services/comment.service.ts`
- `src/services/attachment.service.ts`
- `src/services/label.service.ts`
- `src/services/search.service.ts`
- `src/services/notification.service.ts`
- `src/services/requirement.service.ts`（transition 改造）

**Estimated scope:** L

---

### Checkpoint: Unassigned Requirements

- [ ] 客户提需求阻力最小化（5 秒）
- [ ] MANAGER 在需求池看到所有未归集需求
- [ ] 归集（单个 + 批量）正常生成项目编号
- [ ] 角色视图隔离（SUBMITTER 看不到项目和需求池）
- [ ] **Review with human before proceeding**

---

#### Task 13: 管理后台 — 需求评审与统计

**Description:** 评审队列（UNDER_REVIEW 状态需求列表，快速操作按钮），统计看板（需求状态分布饼图、处理时长统计、投票 Top 10、按分类/优先级分布），用户管理（列表、角色修改，Admin only）。

**Acceptance criteria:**
- [ ] 管理者可在评审队列快速处理需求（通过/驳回/要求补充）
- [ ] 统计图表正确显示
- [ ] Admin 可修改用户角色

**Verification:**
- 手动测试管理后台各项功能

**Dependencies:** Task 11

**Files likely touched:**
- `src/app/admin/page.tsx`
- `src/app/admin/review/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/components/admin/stats-dashboard.tsx`

**Estimated scope:** L (6 files)

---

#### Task 14: 个人看板 + 搜索

**Description:** Dashboard 页面（我的需求 = 我提交的 + 指派给我的，按状态分组），全局搜索（标题 + 正文全文搜索，PostgreSQL full-text search），搜索结果分页。

**Acceptance criteria:**
- [ ] Dashboard 正确显示我的需求，按状态分组
- [ ] 搜索可按标题和正文查找需求
- [ ] 搜索结果分页

**Verification:**
- 手动测试 Dashboard 和搜索

**Dependencies:** Task 7

**Files likely touched:**
- `src/app/(main)/dashboard/page.tsx`
- `src/components/layout/search-bar.tsx`
- `src/services/search.service.ts`

**Estimated scope:** M (4 files)

---

#### Task 15: 标签系统 + 指派人

**Description:** 项目级标签管理（创建/编辑/删除标签，自定义颜色），需求详情页标签选择器，指派功能（将需求指派给项目成员），列表页按标签/指派人筛选。

**Acceptance criteria:**
- [ ] 可创建和管理项目标签
- [ ] 需求可添加/移除标签
- [ ] 需求可指派给项目成员
- [ ] 列表可按标签和指派人筛选
- [ ] 被指派时触发通知

**Verification:**
- 手动测试标签和指派功能

**Dependencies:** Task 8

**Files likely touched:**
- `src/services/label.service.ts`
- `src/components/requirement/label-selector.tsx`
- `src/components/requirement/assignee-selector.tsx`

**Estimated scope:** M (4 files)

---

#### Task 16: AI 插件接口预留

**Description:** 定义 `AIProvider` 接口（classify/deduplicate/suggestPriority/extractRequirements），实现 `NullAIProvider`（空实现），Service 层通过依赖注入使用 AIProvider，`AI_ENABLED` 环境变量控制。

**Acceptance criteria:**
- [ ] AIProvider 接口定义完整（见 Spec Provider 接口定义）
- [ ] NullAIProvider 作为默认实现
- [ ] AI_ENABLED=false 时系统正常运行
- [ ] 后续可替换为真实 AI 实现而不改动 Service 层

**Verification:**
- `npm run typecheck` 通过
- 单元测试 NullAIProvider

**Dependencies:** Task 6

**Files likely touched:**
- `src/services/ai/types.ts`
- `src/services/ai/null-provider.ts`
- `src/services/ai/provider.ts`

**Estimated scope:** S (3 files)

---

#### Task 17: E2E 测试 + API 集成测试

**Description:** 编写 Spec 要求的测试：至少 1 条标准路径 E2E + 1 条快速通道 E2E；API 端点集成测试覆盖 CRUD + 权限检查；状态流转矩阵完整覆盖（8×8 + 快速通道 + 回退路径）。使用独立测试数据库，seed 隔离。

**当前实际状态（实现后记录）：**
- [x] 单元测试：`tests/unit/transitions.test.ts`（48 个用例，覆盖完整 8×8 流转矩阵 + 角色权限）
- [x] 单元测试：`tests/unit/errors.test.ts`、`rate-limit.test.ts`、`storage.test.ts`、`api-helpers.test.ts`、`ai.test.ts`、`counter.test.ts`、`markdown.test.tsx`
- [x] 集成测试：`tests/integration/requirements.test.ts`（28 个用例，覆盖需求/评论/投票/通知/成员/标签/未归集需求/归集到项目/批量归集）
- [ ] **未完成**：Playwright E2E —— `tests/e2e/workflow.spec.ts` 和 `tests/e2e/permissions.spec.ts` 是初始代码就存在的预制件，未针对当前 UI（含未归集需求弹窗、需求池、归集操作）做更新和验证。**见 docs/TODO.md 的 E2E 重写任务**。
- [ ] **未完成**：`tests/integration/storage-s3.test.ts` 默认被排除（需要本地 MinIO）；未验证是否能跑通

**Acceptance criteria（待补全）：**
- [ ] E2E：完整标准路径（提交→评审→规划→开发→测试→交付→验收）
- [ ] E2E：完整快速通道（提交→直接开发→交付→验收）
- [ ] E2E：未归集需求流程（提交 → 需求池 → 归集 → 进入项目）
- [ ] 测试使用独立数据库，不污染 dev/prod

**Verification:**
- `npm run test` 全部通过（✅ 120 个用例已通过）
- `npm run test:e2e` 全部通过（❌ 未完成）

**Dependencies:** Task 13, Task 14, Task 15, Task 16, Task 18（未归集扩展）

**Files likely touched:**
- `tests/e2e/workflow.spec.ts`（重写）
- `tests/e2e/permissions.spec.ts`（重写）
- `tests/integration/storage-s3.test.ts`（验证）

**Estimated scope:** L

---

### Checkpoint: Complete

- [ ] 所有功能可用
- [ ] `npm run build` 成功
- [ ] `npm run lint` 通过
- [ ] `npm run typecheck` 通过
- [ ] `npm run test` 通过（单元 + 集成）
- [ ] `npm run test:e2e` 通过（标准路径 + 快速通道）
- [ ] 状态流转矩阵 100% 覆盖（含回退路径）
- [ ] `AI_ENABLED=false` 时系统正常运行
- [ ] `.env.example` 包含所有环境变量
- [ ] **Ready for review**

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| IPD 7步流程对内部小需求太重 | High | 快速通道：Manager/Admin 可跳过中间状态，StatusLog 完整记录 |
| SSE 单实例限制 | Medium | MVP 单实例部署；后续加 Redis pub/sub 跨实例广播（非目标中已声明） |
| PostgreSQL 全文搜索性能 | Low (MVP) | MVP 阶段数据量小，后续可迁移到 pg_trgm 或 Meilisearch |
| 需求编号并发冲突 | ~~Medium~~ | 已解决：Prisma `update { increment: 1 }` 原子操作；新增 `GlobalCounter` 表支撑 globalNumber |
| 附件上传安全风险 | Medium | mimeType 白名单 + 文件大小限制 + 文件名消毒 + 权限校验 |
| S3 配置复杂性 | Low | 本地存储作为默认值，S3 为可选；环境变量驱动 |
| Markdown XSS 风险 | Medium | rehype-sanitize + 禁用 raw HTML + 过滤 javascript: URL |
| 详情页并行开发冲突 | Low (单人开发) | **实际未采用插槽模式** — 单人串行开发不冲突；详情页直接组装子组件 |
| 通知触发与 Service 层耦合 | Low | 已在实际开发中通过 notificationService.createMany 直接调用解决 |
| 未归集需求通知范围 | Low | 未归集时只推给作者；归集后恢复项目成员广播 |

## Parallelization Opportunities

以下 Task 可并行执行（在依赖满足后）：

- **Task 6a (MarkdownEditor) + Task 6.5a (存储抽象) + Task 16 (AI 接口)** — 均只依赖 Task 6 的 Service 层，互不共享文件
- **Task 14 (看板+搜索)** — 依赖 Task 7，可在 Phase 3 期间并行启动（注意：assignee 筛选需等 Task 15）
- **Task 13 (管理后台)** — 依赖 Task 12，但不依赖 Task 14/15/16
- **Phase 3.5 的 Task 18-21** — 由用户新需求触发，本质上是独立功能，可与 Phase 4 部分并行

> ⚠️ Task 9 (评论) + Task 10 (投票) + Task 11 (状态流转) 在多人并行时不完全独立 — 三者都需修改需求详情页 UI。**实际开发由单人串行完成**，避免了文件冲突；插件插槽方案未采用。

## Task 依赖图

```
Task 1 (脚手架 + errors.ts)
  └→ Task 2 (DB Schema + 全量索引)
       └→ Task 3 (Auth + 注册策略)
            └→ Task 4 (Layout)
                 └→ Task 5 (项目 CRUD + 成员管理)
                      └→ Task 6 (需求提交 + MarkdownEditor) ← Task 6a (MarkdownEditor 拆分)
                           ├→ Task 6.5a (存储抽象层)
                           │    └→ Task 6.5b (附件 API + UI)
                           │         └→ Task 8 (详情页) ← Task 7
                           │              ├→ Task 9 (评论)
                           │              ├→ Task 10 (投票)
                           │              └→ Task 11 (状态流转)
                           │                   └→ Task 11.5 (通知集成钩子)
                           │                        └→ Task 12 (SSE 传输 + UI)
                           │                             └→ Task 13 (管理后台)
                           ├→ Task 14 (看板+搜索)
                           ├→ Task 15 (标签+指派) → Task 11.5 (指派通知)
                           └→ Task 16 (AI 接口)
                                └→ Task 17 (E2E + 集成测试)

# Phase 3.5：未归集需求扩展（项目后建）
Task 13 ─┐
         ├→ Task 18 (Schema: projectId/number 可空 + GlobalCounter + globalNumber)
         │      └→ Task 19 (创建无项目需求 + /requirements/[id] 详情页)
         │              └→ Task 20 (需求池 + 归集到项目 + 批量归集)
         │                     └→ Task 21 (comment/vote/attachment/label/notification 服务适配)
         │                            └→ Task 17 (E2E 需要补充未归集流程)
```

> 注意：Task 9/10/11 在多人并行时共享详情页 UI 文件。实际开发由单人串行完成，避免了冲突；插件插槽方案（detail-slots.tsx）未采用。
