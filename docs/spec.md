# Spec: easyreq

## Objective

**easyreq** 是一个面向企业内部 IT 部门的需求收集与状态跟踪工具，核心交互模型类似 **GitHub Issues**，但做了关键改造：

- 业务部门员工像"提 Issue"一样提交需求，**无需先归属项目**（"项目后建"模型 — 客户先提需求，IT 产品经理/项目经理后续建项目并归集）
- IT 团队评审、分配、推进需求，未归集的需求走"需求池"待 PM 处理
- 所有人可以在需求下评论、投票、讨论
- 需求状态按 IPD 风格流转，全程透明可追溯
- AI 作为可选插件，辅助分类、去重、优先级建议

### 用户画像

- **Submitter（提交者）**：业务部门员工，提需求、投票、评论、验收
- **Manager（管理者）**：IT 产品经理/项目经理，评审、规划、分配
- **Developer（开发者）**：IT 开发人员，接收需求、更新进度
- **Admin（管理员）**：系统管理，用户管理、配置

### Success Criteria

- 提交者可以在 5 秒内提交一个需求（仅需标题，**无需选项目**）
- 未归集的需求可以在产品经理的"需求池"中浏览并一键归集到新建/已有项目
- 需求状态变更后 3 秒内通过 SSE 通知到相关用户
- 需求列表页加载 < 500ms（1000 条需求以内）
- 所有需求可从提交到关闭完整追溯（StatusLog 全记录）
- 附件上传支持本地存储和 S3 兼容存储两种模式，可配置切换
- Markdown 渲染无 XSS 风险（rehype-sanitize + 禁用 raw HTML）

### 非目标（Non-Goals）

- 不是 SaaS 多租户系统（企业内部单租户部署）
- 不支持公开注册（用户由 Admin 创建或邀请）
- MVP 阶段不做跨实例 SSE 广播（单实例部署，后续可加 Redis pub/sub）
- MVP 阶段不做字段级编辑审计（仅状态变更有 StatusLog）

## Tech Stack

| 层 | 选型 | 说明 |
|---|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) | 全栈单体 |
| 语言 | TypeScript (strict mode) | 类型安全 |
| UI | Tailwind CSS v4 + @tailwindcss/typography | 手写组件，未使用 shadcn/ui |
| ORM | Prisma 7 + 自定义 client 输出到 `src/generated/prisma` | 类型安全数据库访问 |
| DB | PostgreSQL + `@prisma/adapter-pg` + `pg` | 主数据库 |
| Auth | NextAuth.js v5 (Credentials Provider, JWT session) | 无公开注册 |
| Validation | Zod | 边界验证 |
| 实时通知 | SSE (`EventEmitter` + `/api/notifications/stream`) | 状态变更推送 |
| Markdown | react-markdown + remark-gfm + rehype-sanitize | 渲染与实时预览，XSS 防护 |
| 文件存储 | StorageProvider 抽象层（local + s3） | 通过 `STORAGE_PROVIDER` 切换 |
| S3 SDK | @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner | 兼容 MinIO/阿里OSS |
| 计数器 | 自建 `GlobalCounter` 表（Prisma `update { increment: 1 }`） | 全局需求编号 `globalNumber` |
| AI (插件) | AIProvider 接口 + NullAIProvider + HeuristicAIProvider + OpenAIProvider | `AI_ENABLED=false` 时空实现；`true` 时默认用启发式（关键词匹配、bigrm Jaccard 相似度），可选换 OpenAI 兼容 HTTP |
| 测试 | Vitest (单元/集成) + Playwright (E2E) | 测试 DB 自动隔离为 `*_test` |

## Commands

```bash
npm run dev          # 开发服务器（读 .env 的 PORT，默认 3000）
npm run build        # 生产构建
npm run lint         # ESLint 检查
npm run typecheck    # TypeScript 类型检查
npm run test         # Vitest 单元/集成测试（自动用 * _test 数据库）
npm run test:unit    # 仅单元测试
npm run test:integration  # 仅集成测试
npm run test:e2e     # Playwright E2E 测试
npm run db:migrate   # 数据库迁移
npm run db:seed      # 种子数据
npm run db:studio    # Prisma Studio
npm run db:generate  # 重新生成 Prisma Client
```

## Project Structure

```
easyreq/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # 鉴权页面组（不开放公开注册，仅 login）
│   │   │   └── login/page.tsx
│   │   ├── (main)/                 # 主应用页面组（侧边栏 + 顶栏 + 全局快捷提交）
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx  # 个人看板（我提交/指派给我的）
│   │   │   ├── projects/           # 项目空间
│   │   │   │   ├── page.tsx        # 项目列表
│   │   │   │   └── [slug]/
│   │   │   │       ├── page.tsx    # 项目首页（需求列表）
│   │   │   │       └── requirements/
│   │   │   │           ├── new/page.tsx
│   │   │   │           └── [id]/page.tsx      # 已归集需求详情
│   │   │   ├── requirements/       # 未归集需求（顶层 URL，不带项目上下文）
│   │   │   │   ├── [id]/page.tsx  # 未归集需求详情
│   │   │   │   └── inbox/page.tsx  # 需求池（MANAGER/ADMIN）
│   │   │   ├── notifications/page.tsx
│   │   │   └── search/page.tsx
│   │   ├── admin/                  # 管理后台（layout.tsx 做角色守卫）
│   │   │   ├── page.tsx            # 统计概览
│   │   │   ├── review/page.tsx     # 评审队列
│   │   │   ├── inbox/page.tsx      # 需求池（与 /requirements/inbox 同源）
│   │   │   └── users/page.tsx      # 用户管理（ADMIN only）
│   │   ├── api/                    # API Route Handlers
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── projects/route.ts                       # GET 列表 / POST 创建（支持批量归集）
│   │   │   ├── projects/[slug]/route.ts
│   │   │   ├── projects/[slug]/members/route.ts
│   │   │   ├── projects/[slug]/members/[userId]/route.ts
│   │   │   ├── projects/[slug]/labels/route.ts
│   │   │   ├── projects/[slug]/labels/[labelId]/route.ts
│   │   │   ├── projects/[slug]/requirements/route.ts   # 项目内创建需求
│   │   │   ├── requirements/route.ts                   # 顶层 POST：创建未归集需求
│   │   │   ├── requirements/[id]/route.ts
│   │   │   ├── requirements/[id]/project/route.ts      # PATCH：归集到项目
│   │   │   ├── requirements/[id]/transition/route.ts
│   │   │   ├── requirements/[id]/vote/route.ts
│   │   │   ├── requirements/[id]/comments/route.ts
│   │   │   ├── requirements/[id]/comments-v2（暂未启用）
│   │   │   ├── requirements/[id]/labels/route.ts
│   │   │   ├── requirements/[id]/labels/[labelId]/route.ts
│   │   │   ├── requirements/[id]/attachments/route.ts
│   │   │   ├── requirements/[id]/members/route.ts       # @mention 自动补全
│   │   │   ├── requirements/inbox/route.ts             # 需求池列表
│   │   │   ├── comments/[id]/route.ts                  # 评论编辑/软删除
│   │   │   ├── labels/[id]/route.ts                    # 标签独立删除
│   │   │   ├── attachments/[id]/route.ts               # 下载/删除
│   │   │   ├── attachments/upload/route.ts              # 通用上传端点
│   │   │   ├── notifications/route.ts
│   │   │   ├── notifications/[id]/read/route.ts
│   │   │   ├── notifications/read-all/route.ts
│   │   │   ├── notifications/stream/route.ts           # SSE 流
│   │   │   ├── search/route.ts
│   │   │   ├── sse/route.ts                            # 旧 SSE 端点（被 stream 取代，保留兜底）
│   │   │   ├── admin/users/route.ts
│   │   │   └── admin/users/[id]/role/route.ts
│   │   ├── layout.tsx                # 根 layout（字体 + 全局 CSS）
│   │   └── page.tsx                  # 根：已登录跳 /dashboard，未登录跳 /login
│   ├── components/
│   │   ├── ui/                       # 通用 UI 组件（手写，未用 shadcn）
│   │   │   └── markdown-editor.tsx   # 写/预览/分屏 + 可拖动分屏栏 + @mention + 拖拽上传
│   │   ├── layout/
│   │   │   ├── sidebar.tsx           # 角色感知：SUBMITTER 不显示项目列表/需求池
│   │   │   ├── header.tsx            # 登出按钮（Server Action + redirect）
│   │   │   ├── notification-bell.tsx # 顶栏未读数 badge + SSE hook
│   │   │   └── search-bar.tsx
│   │   ├── requirement/
│   │   │   ├── requirement-form.tsx          # 完整页表单（项目内提交）
│   │   │   ├── requirement-form-fields.tsx    # 共享字段组件
│   │   │   ├── quick-submit.tsx              # 项目内嵌的标题快提
│   │   │   ├── global-quick-submit.tsx        # 全局 FAB + N 键弹窗 + 项目下拉
│   │   │   ├── requirement-list.tsx          # 列表 + 筛选 + 分页
│   │   │   ├── requirement-inbox.tsx         # 需求池视图（客户端拉数据）
│   │   │   ├── assign-to-project.tsx         # 单条归集表单
│   │   │   ├── create-project-dialog.tsx     # 新建项目弹窗（含批量归集勾选）
│   │   │   ├── editable-fields.tsx           # 详情页内联编辑
│   │   │   ├── status-actions.tsx            # 详情页状态操作按钮
│   │   │   ├── status-badge.tsx
│   │   │   ├── status-timeline.tsx
│   │   │   ├── vote-button.tsx
│   │   │   ├── label-selector.tsx
│   │   │   └── assignee-selector.tsx
│   │   ├── comment/comment-section.tsx
│   │   ├── search/search-results.tsx
│   │   └── admin/user-management-table.tsx
│   ├── services/                     # Service 层（业务逻辑）
│   │   ├── requirement.service.ts           # 核心：create/createUnassigned/transition/assignToProject/...
│   │   ├── requirement-access.ts            # 共享的需求访问权限校验（vote/comment/attachment 复用）
│   │   ├── comment.service.ts
│   │   ├── vote.service.ts
│   │   ├── notification.service.ts
│   │   ├── project.service.ts                # 创建项目时支持 requirementIds 批量归集
│   │   ├── label.service.ts
│   │   ├── search.service.ts                # 同时检索项目内需求 + 自己提交的未归集需求
│   │   ├── stats.service.ts
│   │   ├── user.service.ts
│   │   ├── counter.service.ts               # GlobalCounter 原子 increment
│   │   └── auth.service.ts
│   ├── lib/
│   │   ├── db.ts                      # Prisma client（dev 模式 globalThis 缓存）
│   │   ├── auth.ts / auth.config.ts    # NextAuth 配置
│   │   ├── errors.ts                  # AppError 统一错误类
│   │   ├── constants.ts               # 状态/角色/优先级 枚举常量
│   │   ├── transitions.ts             # 流转矩阵 + 权限矩阵
│   │   ├── requirement-form.ts        # 共享的 buildCreatePayload / PRIORITY_OPTIONS
│   │   ├── api-helpers.ts             # parsePagination 等
│   │   ├── rate-limit.ts              # 登录限流（in-memory）
│   │   ├── notifications/channel.ts   # EventEmitter 实现的 SSE 通道
│   │   ├── validation/                # Zod schemas（project/member/comment/requirement）
│   │   ├── ai/                        # AI 插件接口 + NullAIProvider
│   │   └── storage/                   # StorageProvider 抽象层（local + s3）
│   ├── hooks/
│   │   ├── use-notifications.ts        # SSE 客户端 hook
│   │   └── use-requirement-draft.ts    # localStorage 草稿持久化（共享）
│   ├── types/next-auth.d.ts           # NextAuth 类型扩展（role 字段）
│   ├── proxy.ts                       # Next.js 16 middleware 入口（路由守卫）
│   └── generated/prisma/              # Prisma Client 自定义输出（勿改）
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   │   ├── 20260626121428_init/
│   │   └── 20260627120000_support_unassigned_requirements/   # 新增 GlobalCounter + 改字段
│   └── seed.ts                        # 含 5 用户 / 2 项目 / 8 需求 / 评论 / 投票
├── tests/
│   ├── unit/                          # transitions / errors / rate-limit / storage / counter / markdown / api-helpers / ai
│   ├── integration/                   # requirements.test.ts（28 个用例，覆盖项目内 + 未归集）
│   │                                   # storage-s3.test.ts 默认排除，需 MinIO
│   └── e2e/                            # 预存 workflow.spec.ts / permissions.spec.ts，未更新适配新 UI
├── public/uploads/                     # 本地附件存储（实际路径，已通过 SPEC Always 验证）
└── docs/
    ├── spec.md                        # 本规范文档
    ├── plan.md                        # 实现计划
    └── decisions/                     # ADR（如后续补充）
```

## Data Model

```prisma
// ========== 用户与权限 ==========

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  passwordHash  String
  role          Role      @default(SUBMITTER)
  avatar        String?
  projects      ProjectMember[]
  requirements  Requirement[]  @relation("Author")
  assignedReqs  Requirement[]  @relation("Assignee")
  comments      Comment[]
  votes         Vote[]
  notifications Notification[]
  attachments   Attachment[]
  statusLogs    StatusLog[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

enum Role {
  SUBMITTER   // 业务部门员工
  MANAGER     // IT 产品经理/项目经理
  DEVELOPER   // IT 开发人员
  ADMIN       // 系统管理员
}

// ========== 项目空间 ==========

model Project {
  id                     String             @id @default(cuid())
  name                   String
  slug                   String             @unique
  description            String?
  lastRequirementNumber  Int                @default(0)  // 项目内编号计数器（仅已归集需求使用）
  members                ProjectMember[]
  requirements           Requirement[]
  labels                 Label[]
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt
}

// 全局编号计数器（支撑全局需求编号 globalNumber，并发安全靠 Prisma update increment）
model GlobalCounter {
  id    String @id @default(cuid())
  name  String @unique          // 当前唯一用途：name="requirement"
  value Int    @default(0)
}

model ProjectMember {
  id        String      @id @default(cuid())
  userId    String
  user      User        @relation(fields: [userId], references: [id])
  projectId String
  project   Project     @relation(fields: [projectId], references: [id])
  role      ProjectRole @default(MEMBER)
  createdAt DateTime    @default(now())
  @@unique([userId, projectId])
}

enum ProjectRole {
  OWNER   // 项目创建者，可管理成员
  MEMBER  // 项目成员
}

// ========== 需求 ==========
//
// 关键设计：需求可以先于项目存在（"项目后建"）。
//   - projectId/number 可空：未归集的需求没有项目编号
//   - globalNumber 全局唯一编号：所有需求都有，不随归集而变
//   - 未归集需求可走 SUBMITTED ↔ REJECTED 流转，归集后才能进入完整 IPD 流程
model Requirement {
  id                 String             @id @default(cuid())
  projectId          String?                                    // 可空：未归集时为 null
  project            Project?           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  authorId           String
  author             User               @relation("Author", fields: [authorId], references: [id], onDelete: Cascade)
  globalNumber       Int                @unique                // 全局唯一编号，所有需求都有
  number             Int?                                       // 项目内自增编号（归集后才有），如 #1, #2
  title              String             @db.VarChar(200)
  body               String?                                    // Markdown 内容，可选
  status             RequirementStatus  @default(SUBMITTED)
  priority           Priority           @default(MEDIUM)
  assigneeId         String?                                    // 未归集需求无项目，指派无效
  assignee           User?              @relation("Assignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  expectedDate       DateTime?
  acceptanceCriteria String?
  comments           Comment[]
  votes              Vote[]
  statusLogs         StatusLog[]
  labels             RequirementLabel[]
  attachments        Attachment[]
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  @@unique([projectId, number])   // PostgreSQL 允许多个 (NULL, NULL) 共存
  @@index([status])
  @@index([assigneeId])
  @@index([authorId])
  @@index([projectId])           // 加速"未归集"查询（WHERE projectId IS NULL）
  @@index([createdAt])
}

enum RequirementStatus {
  SUBMITTED        // 提交
  UNDER_REVIEW     // 评审（RAT 分析）
  PLANNED          // 规划（纳入路标）
  IN_DEVELOPMENT   // 开发实现
  IN_TESTING       // 测试验证
  DELIVERED        // 交付
  ACCEPTED         // 验收关闭
  REJECTED         // 驳回
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

// ========== 互动 ==========

model Comment {
  id             String        @id @default(cuid())
  requirementId  String
  requirement    Requirement   @relation(fields: [requirementId], references: [id], onDelete: Cascade)
  authorId       String
  author         User          @relation(fields: [authorId], references: [id], onDelete: Cascade)
  body           String        // Markdown
  isDeleted      Boolean       @default(false)  // 软删除，保留审计追溯
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  @@index([requirementId])
}

model Vote {
  id             String        @id @default(cuid())
  requirementId  String
  requirement    Requirement   @relation(fields: [requirementId], references: [id], onDelete: Cascade)
  userId         String
  user           User          @relation(fields: [userId], references: [id])
  createdAt      DateTime      @default(now())
  @@unique([requirementId, userId])
}

// ========== 状态流转日志 ==========

model StatusLog {
  id             String            @id @default(cuid())
  requirementId  String
  requirement    Requirement       @relation(fields: [requirementId], references: [id], onDelete: Cascade)
  fromStatus     RequirementStatus
  toStatus       RequirementStatus
  operatorId     String
  operator       User              @relation(fields: [operatorId], references: [id], onDelete: Cascade)
  note           String?           // 流转备注
  isQuickPath    Boolean           @default(false) // 是否为快速通道跳转
  createdAt      DateTime          @default(now())
  @@index([requirementId])
}

// ========== 通知 ==========

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  title     String
  body      String?  // 纯文本摘要（非 Markdown）
  link      String?  // 跳转链接
  isRead    Boolean  @default(false)
  readAt    DateTime?  // 标记已读时间
  createdAt DateTime @default(now())
  @@index([userId, isRead])
}

enum NotificationType {
  STATUS_CHANGE       // 状态变更
  COMMENT             // 新评论
  VOTE_MILESTONE      // 投票里程碑
  ASSIGNMENT          // 被指派
  REJECTED            // 需求被驳回
}

// ========== 标签 ==========

model Label {
  id             String             @id @default(cuid())
  name           String
  color          String
  projectId      String
  project        Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)
  requirements   RequirementLabel[]
  @@unique([projectId, name])
}

model RequirementLabel {
  requirementId String
  requirement   Requirement @relation(fields: [requirementId], references: [id], onDelete: Cascade)
  labelId       String
  label         Label       @relation(fields: [labelId], references: [id], onDelete: Cascade)
  @@id([requirementId, labelId])
  @@index([labelId])
}

// ========== 附件 ==========

model Attachment {
  id             String   @id @default(cuid())
  requirementId  String
  requirement    Requirement @relation(fields: [requirementId], references: [id], onDelete: Cascade)
  uploaderId     String
  uploader       User     @relation(fields: [uploaderId], references: [id], onDelete: Cascade)
  fileName       String   // 原始文件名（已消毒）
  fileSize       Int      // 字节
  mimeType       String
  storageKey     String   // 存储路径/key
  storageProvider StorageProvider  // 存储方式
  createdAt      DateTime @default(now())
  @@index([requirementId])
}

enum StorageProvider {
  LOCAL
  S3
}
```

## 状态流转规则

### 标准路径（严格 IPD）

```
SUBMITTED ──→ UNDER_REVIEW     [Manager/Admin 操作]
UNDER_REVIEW ──→ PLANNED       [Manager/Admin 操作]
UNDER_REVIEW ──→ REJECTED      [Manager/Admin 操作]
PLANNED ──→ IN_DEVELOPMENT     [Manager/Developer 操作]
PLANNED ──→ REJECTED           [Manager/Admin 操作]
IN_DEVELOPMENT ──→ IN_TESTING  [Developer 操作]
IN_TESTING ──→ IN_DEVELOPMENT  [Developer 操作]（测试发现问题退回开发）
IN_TESTING ──→ DELIVERED       [Developer/Manager 操作]
DELIVERED ──→ ACCEPTED         [Submitter/Manager 操作]
DELIVERED ──→ IN_DEVELOPMENT   [Manager 操作]（交付不达标退回开发）
ACCEPTED ──→ IN_DEVELOPMENT    [Manager/Admin 操作]（验收后发现缺陷重新打开）
REJECTED ──→ SUBMITTED         [Submitter 操作]（重新提交）
```

### 快速通道（Manager/Admin 可跳过中间状态）

适用于简单需求、配置变更、小优化等不需要完整 IPD 流程的场景：

```
SUBMITTED → IN_DEVELOPMENT    // 小需求跳过评审+规划，直接进入开发
SUBMITTED → PLANNED           // 跳过评审，直接进入规划
IN_DEVELOPMENT → DELIVERED    // 跳过测试，适用于配置变更等
DELIVERED → ACCEPTED          // 标准验收，保持不变
```

### 约束

- MANAGER 或 ADMIN 角色可执行快速通道跳转
- ADMIN 是超级用户，可执行所有角色的操作
- 每次跳转仍然写入 StatusLog，`isQuickPath = true`，完整可追溯
- REJECTED 回退路径不变
- ACCEPTED 可被 Manager/Admin 重新打开（reopen），适用于验收后发现缺陷的场景
- 快速通道跳转不限制次数（Manager 自行判断需求复杂度）

### 流转矩阵（合法转换）

```
                  SUBMITTED  UNDER_REVIEW  PLANNED  IN_DEV  IN_TEST  DELIVERED  ACCEPTED  REJECTED
SUBMITTED            -           ✓          ✓(Q)     ✓(Q)      -        -         -         -
UNDER_REVIEW         -           -          ✓         -        -        -         -         ✓
PLANNED              -           -          -         ✓        -        -         -         ✓
IN_DEVELOPMENT       -           -          -         -        ✓       ✓(Q)       -         -
IN_TESTING           -           -          -         ✓        -        ✓         -         -
DELIVERED            -           -          -         ✓        -        -         ✓         -
ACCEPTED             -           -          -         ✓        -        -         -         -
REJECTED             ✓           -          -         -        -        -         -         -

✓ = 合法标准转换    ✓(Q) = 合法快速通道转换（仅 Manager/Admin）    - = 禁止
IN_DEV = IN_DEVELOPMENT    IN_TEST = IN_TESTING（矩阵中缩写以保持对齐）
```

### 权限矩阵（角色 → 可执行的目标状态）

```
角色          可推进到的目标状态
SUBMITTER     SUBMITTED (重新提交), ACCEPTED (验收)
MANAGER       所有标准状态 + 所有快速通道跳转 + REJECTED
DEVELOPER     IN_DEVELOPMENT, IN_TESTING, IN_TESTING→IN_DEVELOPMENT, DELIVERED
ADMIN         所有操作（超级用户，等同 MANAGER + 所有角色权限）

规则：
- ADMIN 可执行任何角色能做的操作
- 操作者必须是项目成员（ProjectMember），除非是 ADMIN
- 全局 Role 决定可执行的操作类型，ProjectRole 决定可访问的项目
- 一个全局 SUBMITTER 如果是项目 OWNER，仍然只有 SUBMITTER 的流转权限
```

## API 契约

### 统一错误格式

```typescript
interface APIError {
  error: {
    code: string;        // "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_TRANSITION"
    message: string;
    details?: unknown;
  };
}

// 状态码映射
// 400 → Client sent invalid data (格式错误)
// 401 → Not authenticated (未登录)
// 403 → Authenticated but not authorized (无权限)
// 404 → Resource not found
// 409 → Conflict (slug 重复、number 冲突)
// 422 → Validation failed (Zod 校验失败，语义错误)
// 429 → Too many requests (速率限制)
// 500 → Server error (never expose internal details)

// 错误码列表
// VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | INVALID_TRANSITION | RATE_LIMITED
// CONFLICT 用于：slug 重复、投票并发冲突、未归集需求被重新归集等
```

### 统一分页

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
```

### 端点列表

```typescript
// 项目
GET    /api/projects                          → 项目列表（仅当前用户参与的项目）
POST   /api/projects                          → 创建项目（MANAGER/ADMIN，创建者自动成为 OWNER）
                                                 body: { name, slug, description?, requirementIds?: string[] }
                                                 requirementIds 一次性归集若干未归集需求进新项目
GET    /api/projects/:slug                    → 项目详情（仅项目成员可访问）
POST   /api/projects/:slug/members            → 添加项目成员（仅 OWNER/ADMIN）
DELETE /api/projects/:slug/members/:userId    → 移除项目成员（仅 OWNER/ADMIN）

// 需求（项目内）
GET    /api/projects/:slug/requirements       → 需求列表（分页+筛选+排序，仅项目成员）
POST   /api/projects/:slug/requirements       → 创建需求（任何项目成员）

// 需求（顶层 + 未归集）
POST   /api/requirements                      → 创建未归集需求（任何登录用户；不需要 projectId）
GET    /api/requirements/inbox                → 需求池（MANAGER/ADMIN）
PATCH  /api/requirements/:id/project          → 把未归集需求归集到指定项目（MANAGER/ADMIN）
                                                 body: { projectId }
// 归集时生成项目内 number 并发送 STATUS_CHANGE 通知给作者

// 需求（通用）
GET    /api/requirements/:id                  → 需求详情（作者本人 / MANAGER / ADMIN / 已归集项目成员）
PATCH  /api/requirements/:id                  → 更新需求（author 可改 title/body；Manager 可改 priority/assigneeId/expectedDate/acceptanceCriteria）
                                                 未归集需求仅 author 可改 title/body，Manager 可驳回/归集
POST   /api/requirements/:id/transition       → 状态流转（body: { toStatus, note? }）
                                                 未归集需求仅允许 SUBMITTED ↔ REJECTED

// 评论
GET    /api/requirements/:id/comments         → 评论列表（分页，排除 isDeleted）
POST   /api/requirements/:id/comments         → 添加评论（任何登录用户；未归集需求也开放评论）
PATCH  /api/comments/:id                      → 编辑评论（仅作者本人）
DELETE /api/comments/:id                      → 删除评论（软删除，仅作者本人或 Manager）

// 投票
POST   /api/requirements/:id/vote             → 投票(toggle)，返回 { voted: boolean, count: number }
                                                 未归集需求：任何登录用户都可投（"低阻力反馈"设计）
                                                 已归集：项目成员 + ADMIN
                                                 里程碑 5/10/20/50：未归集时通知所有 MANAGER/ADMIN，已归集时通知项目内 MANAGER

// @mention 自动补全
GET    /api/requirements/:id/members          → 项目成员列表（@ 输入时弹出）

// 附件
POST   /api/attachments/upload                → 上传文件（multipart，body 含 requirementId）
GET    /api/attachments/:id                   → 下载附件（local: 流式响应；s3: 302 跳转预签名 URL）
DELETE /api/attachments/:id                   → 删除附件（Uploader 或 Manager）
GET    /api/requirements/:id/attachments      → 需求的所有附件（list）
POST   /api/requirements/:id/attachments      → 上传附件并关联到该需求

// 通知
GET    /api/notifications                     → 通知列表（分页，支持 ?unread=true 筛选）
PATCH  /api/notifications/:id/read            → 标记单条已读
POST   /api/notifications/read-all            → 全部标记已读
GET    /api/notifications/stream              → SSE 流（生产使用，/api/sse 保留兜底）

// 实时（SSE）
GET    /api/notifications/stream              → SSE 连接（通过 cookie 认证，推送当前用户相关事件）
// 注：旧版 /api/sse 保留为兜底路由，但客户端 hook 实际订阅 /api/notifications/stream

// 标签
GET    /api/projects/:slug/labels             → 标签列表
POST   /api/projects/:slug/labels             → 创建标签（MANAGER/OWNER）
PATCH  /api/projects/:slug/labels/:labelId    → 修改标签
DELETE /api/labels/:id                        → 删除标签
POST   /api/requirements/:id/labels           → 为需求添加标签（body: { labelId }）
DELETE /api/requirements/:id/labels/:labelId  → 移除需求的标签

// 搜索
GET    /api/search?q=...                     → 标题 + 正文 ILIKE 搜索
                                                 已归集：项目成员范围；未归集：仅自己提交的

// 用户管理（Admin）
GET    /api/admin/users                       → 用户列表（ADMIN）
POST   /api/admin/users                       → 创建用户（ADMIN）
PATCH  /api/admin/users/:id/role              → 修改用户角色（ADMIN）
```

### SSE 事件规范

```
认证方式：基于 NextAuth session cookie（EventSource 自动携带同源 cookie）
事件过滤：服务端只推送与当前用户相关的事件（作者/指派人/评论者/投票者/项目成员）

事件类型（event: 字段）：
  event: notification    data: { "id": "...", "type": "STATUS_CHANGE", "title": "...", "link": "..." }
  event: requirement_updated  data: { "id": "...", "projectId": "...", "field": "status" }

心跳：每 30 秒发送 event: ping，客户端用于检测连接健康
断线重连：客户端指数退避重连（1s/2s/4s/8s/最大 30s）
```

### 通知触发规则

| 触发事件 | 通知类型 | 接收人 |
|----------|----------|--------|
| 状态变更 | STATUS_CHANGE | 需求 author + assignee |
| 需求被驳回 | REJECTED | 需求 author |
| 新评论 | COMMENT | 需求 author + assignee + 之前评论的作者（去重） |
| 投票达到 5/10/20/50 票 | VOTE_MILESTONE | 已归集：项目内所有 MANAGER；未归集：所有全局 MANAGER + ADMIN |
| 被指派 | ASSIGNMENT | 被指派的用户 |
| 需求被归集到项目 | STATUS_CHANGE | 需求 author（额外一条，link 指向项目内详情页） |

### 注册与用户管理

```
注册方式：不开放公开注册
用户创建：
  1. Admin 在管理后台创建用户（指定角色）
  2. 第一个 ADMIN 由 seed 脚本创建（npm run db:seed）
  3. 后续用户由 Admin 创建并分配角色
密码策略：bcrypt 哈希（cost factor 12），最小长度 8
会话策略：NextAuth JWT session（默认 24h 过期）
```

### 架构分层约定

```
Server Components → 直接调用 Service 层获取数据（服务端渲染）
Server Actions    → 调用 Service 层执行变更（表单提交、CRUD）
Route Handlers    → 调用 Service 层（SSE、附件上传等需要独立 HTTP 端点的场景）
Service 层        → 业务逻辑、权限校验、数据库操作（Prisma）
```

> Server Actions 用于 app 内部变更操作；Route Handlers 用于 SSE、文件上传等需要独立 HTTP 端点的场景。两者共享同一 Service 层。

## Code Style

### Service 层示例

```typescript
// src/services/requirement.service.ts
import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'

export class RequirementService {
  async create(projectId: string, authorId: string, input: CreateRequirementInput): Promise<Requirement> {
    const number = await this.getNextNumber(projectId)
    return db.requirement.create({
      data: { ...input, projectId, authorId, number, status: 'SUBMITTED' },
    })
  }

  async transition(
    id: string,
    operatorId: string,
    operatorRole: Role,
    toStatus: RequirementStatus,
    note?: string,
  ): Promise<Requirement> {
    const requirement = await db.requirement.findUniqueOrThrow({ where: { id } })

    const isQuickPath = !isAdjacentTransition(requirement.status, toStatus)
    if (!canTransition(requirement.status, toStatus, isQuickPath)) {
      throw new AppError('INVALID_TRANSITION', `Cannot transition from ${requirement.status} to ${toStatus}`)
    }
    if (!hasTransitionPermission(requirement, operatorId, operatorRole, toStatus, isQuickPath)) {
      throw new AppError('FORBIDDEN', 'No permission for this transition')
    }

    return db.$transaction([
      db.requirement.update({ where: { id }, data: { status: toStatus } }),
      db.statusLog.create({
        data: { requirementId: id, fromStatus: requirement.status, toStatus, operatorId, note, isQuickPath },
      }),
    ])
  }
}
```

### 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `requirement.service.ts` |
| 组件名 | PascalCase | `RequirementCard.tsx` |
| 常量 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| 类型/接口 | PascalCase | `RequirementStatus` |
| 枚举值 | UPPER_SNAKE | `"IN_DEVELOPMENT"` |
| API 端点 | 复数名词 | `/api/requirements` |
| 布尔字段 | is/has 前缀 | `isRead`, `hasAttachments` |

### 其他约定

- 所有 API 输入用 Zod 验证，Service 层信任已验证的数据
- 不使用 `any`，严格 TypeScript
- 组件中不直接调用 Prisma（必须走 Service 层）
- 输入验证在边界（API Route / Server Action），内部函数信任类型

## Testing Strategy

| 层级 | 框架 | 位置 | 覆盖范围 |
|------|------|------|----------|
| 单元测试 | Vitest | `tests/unit/` | Service 层逻辑、状态流转矩阵、验证函数、存储抽象 |
| 集成测试 | Vitest + Next.js test utils | `tests/integration/` | API Route Handler + DB 交互、权限检查 |
| E2E | Playwright | `tests/e2e/` | 核心用户流程（提交→评审→开发→验收） |

### MVP 测试要求

- 状态流转逻辑 100% 覆盖（所有合法/非法/快速通道转换路径）
- API 端点基本覆盖（CRUD + 权限检查）
- 至少 1 条完整 E2E 流程（标准路径 + 快速通道各一条）
- 存储抽象层单元测试（local + s3 provider mock）

## Boundaries

### Always

- 所有 API 输入用 Zod 验证（含长度限制：title ≤ 200 字符，body ≤ 50000 字符，comment body ≤ 10000 字符）
- 状态流转必须写 StatusLog（含 isQuickPath 标记）
- TypeScript strict mode
- 测试通过后才算完成
- 遵循 Service 层隔离模式
- 附件上传校验文件大小（≤ 10MB）和 mimeType 白名单
- 附件下载校验权限（项目成员 或 全局 ADMIN；未归集需求：作者 / MANAGER / ADMIN）
- **本地附件目录必须放在 `public/` 外**（否则 Next.js 会直接 serve 文件，绕过权限检查）
- Markdown 渲染必须经过 rehype-sanitize（禁用 raw HTML，过滤 javascript: URL）
- 认证端点速率限制（登录 10 次/15 分钟）
- 密码使用 bcrypt 哈希（cost factor ≥ 12）
- 用户删除采用 Cascade（需求/评论/投票级联删除）
- 评论删除采用软删除（isDeleted = true，保留审计）
- 需求/评论/投票/附件的访问检查统一走 `services/requirement-access.ts` 的 `requireRequirementAccess()`，避免在多个 service 重复实现
- 全局编号分配必须用 `GlobalCounter` 表的原子 increment，**不能**用 read-then-write

### Ask First

- 添加新 npm 依赖
- 修改 DB Schema
- 修改认证逻辑
- 修改存储配置（local ↔ S3 切换）
- 添加新的外部服务集成

### Never

- 在代码中硬编码密钥/密码
- 跳过权限检查
- 删除 StatusLog 记录
- 在组件中直接调用 Prisma
- 上传未校验的文件到存储
- 暴露 S3 凭证到客户端
- 使用 `dangerouslySetInnerHTML` 渲染用户内容
- 开放公开用户注册（仅 Admin 创建）

## Provider 接口定义

### StorageProvider

```typescript
interface StorageProvider {
  // 上传文件，返回存储 key
  upload(file: Buffer, fileName: string, mimeType: string): Promise<{ key: string }>
  // 删除文件
  delete(key: string): Promise<void>
  // 获取访问 URL（local 返回相对路径，S3 返回预签名 URL）
  getUrl(key: string, expiresIn?: number): Promise<string>
}
```

### AIProvider

**实现**：定义了 `NullAIProvider`（noop）、`HeuristicAIProvider`（默认，离线关键词 + bigram Jaccard）、`OpenAIProvider`（OpenAI 兼容 HTTP，使用内置 `fetch`，无需 SDK 依赖）。

**集成点**（`src/services/requirement.service.ts`）：
- `create()` / `createUnassigned()`：提交时若用户没指定 priority，调用 `aiProvider.suggestPriority()` 推荐（同步、超时降级为 MEDIUM）
- 提交完成后，**fire-and-forget** 异步执行 dedup 扫描：取作者最近 30 天内同 scope 的需求，对调用 `aiProvider.deduplicate()`，相似度 ≥ 0.6 的 top-3 通过 `notificationService.createMany()` 通知作者

**环境变量**（见 `.env.example`）：
- `AI_ENABLED=false` → 始终 NullAIProvider（默认）
- `AI_ENABLED=true` + `AI_PROVIDER=heuristic|openai` 选实现
- OpenAI 模式需要 `AI_API_KEY`、`AI_BASE_URL`（默认 `https://api.openai.com/v1`）、`AI_MODEL`（默认 `gpt-4o-mini`）

```typescript
interface AIProvider {
  // 自动分类需求
  classify(title: string, body?: string): Promise<string | null>
  // 检测重复需求
  deduplicate(title: string, body?: string, existingTitles: string[]): Promise<string | null>
  // 建议优先级
  suggestPriority(title: string, body?: string): Promise<Priority | null>
  // 从描述中提取结构化需求
  extractRequirements(body: string): Promise<string[] | null>
}
```

### 编号并发安全策略

需求有两种编号，都通过 Prisma 的原子 `update { increment: 1 }` 实现，无显式事务 / 行锁：

```typescript
// 项目内编号（已归集需求）
async function getNextProjectNumber(projectId: string): Promise<number> {
  const project = await db.project.update({
    where: { id: projectId },
    data: { lastRequirementNumber: { increment: 1 } },
    select: { lastRequirementNumber: true },
  })
  return project.lastRequirementNumber
}

// 全局编号（所有需求，含未归集）
async function getNextGlobalNumber(): Promise<number> {
  const counter = await db.globalCounter.update({
    where: { name: 'requirement' },
    data: { value: { increment: 1 } },
    select: { value: true },
  })
  return counter.value
}
```

迁移时会预填 GlobalCounter：`value = MAX(globalNumber) FROM "Requirement"`，
所以迁移前已存在的需求拿到 1..N，新建需求从 N+1 开始。

## 环境变量

```bash
# .env.example（提交到仓库的模板）

# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/easyreq"
# DATABASE_TEST_URL="..." # 可选，覆盖集成测试的 *_test 数据库

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"   # 必须与 dev server 的 PORT 同步

# 开发服务器端口（Next.js 自动读取）
PORT=3000

# 文件存储
STORAGE_PROVIDER=local              # local | s3
STORAGE_LOCAL_DIR=./uploads          # ⚠️ 必须 NOT 放在 public/ 下（会绕过权限校验）
STORAGE_LOCAL_BASE_URL=/uploads      # 附件下载 URL 前缀
STORAGE_MAX_FILE_SIZE=10485760      # 10MB

# S3 兼容存储（当 STORAGE_PROVIDER=s3 时）
S3_BUCKET=
S3_REGION=us-east-1
S3_ENDPOINT=                         # 留空用 AWS 默认；MinIO/阿里OSS 填自定义
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=false           # MinIO 等需要 true

# AI 插件
AI_ENABLED=false
```

## 已决议事项

以下决策已在规划阶段与用户确认：

1. **目标用户**：企业内部 IT 部门（类似华为 IT 装备制造部场景），非 SaaS 多租户
2. **产品模型**：类 GitHub Issues，**但允许需求先于项目存在（项目后建）**
3. **AI 定位**：辅助分析 + 自动生成，作为可选插件（MVP 阶段仅预留接口）
4. **架构分层**：Service 层隔离，Server Actions / Route Handlers 共享同一 Service 层
5. **通知方案**：SSE (Server-Sent Events) 实时推送
6. **状态权限**：角色绑定状态流转，不同角色只能推进特定状态
7. **快速通道**：Manager 可对简单需求跳过中间 IPD 状态，但 StatusLog 完整记录
8. **Markdown 预览**：需求描述和评论支持实时预览（write/preview/split 三档，可拖动分屏栏）
9. **附件上传**：支持本地存储和 S3 兼容存储，通过环境变量配置切换
10. **提需求阻力**：最小化 — 只需标题即可提交，**不需选项目**，所有其他字段可选，支持快捷键 N 和草稿自动保存
11. **状态回退**：IN_TESTING 可退回 IN_DEVELOPMENT，DELIVERED 可退回 IN_DEVELOPMENT，PLANNED 可 REJECTED，ACCEPTED 可 reopen
12. **分类方式**：使用 Label 系统（非 Requirement.category 字段，已移除）
13. **用户管理**：不开放公开注册，由 Admin 创建用户，第一个 ADMIN 由 seed 脚本创建
14. **ADMIN 角色**：超级用户，可执行所有操作（包括访问任何项目）
15. **权限模型**：全局 Role 决定操作类型 + ProjectRole 决定项目访问权限
16. **评论删除**：软删除（isDeleted），保留审计追溯
17. **SSE 部署**：MVP 单实例（in-memory `EventEmitter`），后续可扩展 Redis pub/sub 跨实例广播
18. **需求编号（双编号）**：
    - 全局编号 `globalNumber`：所有需求都有，通过 `GlobalCounter` 表原子 increment；迁移时预填为已有需求的 `ROW_NUMBER()`，新建需求从 MAX+1 开始
    - 项目编号 `number`：归集后才有，通过 `Project.lastRequirementNumber` 原子 increment；未归集时为 NULL
    - 都不使用事务行锁，依赖 Prisma `update { increment: 1 }` 的原子性
19. **未归集需求行为**（新增）：
    - 提交无项目阻力：SUBMITTER 提交后立即看到 globalNumber，不需选项目
    - 评论/投票开放：任何登录用户可参与（"低阻力反馈"是核心目的）
    - 状态受限：仅 SUBMITTED ↔ REJECTED，MANAGER/ADMIN 可驳回，作者可重新提交
    - 归集：MANAGER/ADMIN 单条归集，或新建项目时批量归集（`requirementIds`）
    - SSE 广播：未归集时仅推给作者；归集后恢复项目成员广播
