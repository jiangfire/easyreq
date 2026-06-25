# Spec: easyreq

## Objective

**easyreq** 是一个面向企业内部 IT 部门的需求收集与状态跟踪工具，交互模型类似 **GitHub Issues**：

- 业务部门员工像"提 Issue"一样提交需求，阻力极低（只需标题即可提交）
- IT 团队像"管理 Issue"一样评审、分配、推进需求
- 所有人可以在需求下评论、投票、讨论
- 需求状态按 IPD 风格流转，全程透明可追溯
- AI 作为可选插件，辅助分类、去重、优先级建议

### 用户画像

- **Submitter（提交者）**：业务部门员工，提需求、投票、评论、验收
- **Manager（管理者）**：IT 产品经理/项目经理，评审、规划、分配
- **Developer（开发者）**：IT 开发人员，接收需求、更新进度
- **Admin（管理员）**：系统管理，用户管理、配置

### Success Criteria

- 提交者可以在 5 秒内提交一个需求（仅需标题）
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
| 框架 | Next.js 15 (App Router) | 全栈单体 |
| 语言 | TypeScript (strict mode) | 类型安全 |
| UI | Tailwind CSS + shadcn/ui | 组件库 |
| ORM | Prisma | 类型安全数据库访问 |
| DB | PostgreSQL | 主数据库 |
| Auth | NextAuth.js v5 | Credentials Provider + 角色 |
| Validation | Zod | 边界验证 |
| 实时通知 | SSE (Server-Sent Events) | 状态变更推送 |
| Markdown | react-markdown + remark-gfm + rehype-sanitize | 渲染与实时预览，XSS 防护 |
| 文件存储 | StorageProvider 抽象层 | 本地 / S3 可切换 |
| S3 SDK | @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner | 兼容 MinIO/阿里OSS |
| AI (插件) | AIProvider 接口 + NullAIProvider | 预留接口，非 MVP 必须 |
| 测试 | Vitest + Playwright | 单元/集成 + E2E |

## Commands

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run lint         # ESLint 检查
npm run typecheck    # TypeScript 类型检查
npm run test         # Vitest 单元/集成测试
npm run test:e2e     # Playwright E2E 测试
npm run db:migrate   # 数据库迁移
npm run db:seed      # 种子数据
npm run db:studio    # Prisma Studio
```

## Project Structure

```
easyreq/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # 登录/注册页面组
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (main)/                 # 主应用页面组
│   │   │   ├── projects/           # 项目空间（类似 GitHub Repo）
│   │   │   │   ├── page.tsx        # 项目列表
│   │   │   │   └── [slug]/
│   │   │   │       ├── page.tsx    # 项目首页（需求列表）
│   │   │   │       └── requirements/
│   │   │   │           ├── new/page.tsx       # 提交需求
│   │   │   │           └── [id]/page.tsx      # 需求详情（含评论/投票/附件）
│   │   │   ├── dashboard/page.tsx  # 个人看板
│   │   │   └── notifications/page.tsx
│   │   ├── admin/                  # 管理后台
│   │   │   ├── page.tsx            # 概览
│   │   │   ├── review/page.tsx     # 评审队列
│   │   │   └── users/page.tsx      # 用户管理
│   │   └── api/                    # API Route Handlers
│   │       ├── requirements/
│   │       ├── comments/
│   │       ├── votes/
│   │       ├── notifications/
│   │       ├── attachments/        # 附件上传/下载/删除
│   │       └── sse/                # SSE 端点
│   ├── components/
│   │   ├── ui/                     # shadcn/ui 基础组件
│   │   │   └── markdown-editor.tsx # Markdown 编辑器 + 实时预览
│   │   ├── requirement/            # 需求相关组件
│   │   ├── comment/                # 评论组件
│   │   ├── attachment/             # 附件组件
│   │   └── layout/                 # 布局组件
│   ├── services/                   # Service 层（业务逻辑）
│   │   ├── requirement.service.ts
│   │   ├── comment.service.ts
│   │   ├── vote.service.ts
│   │   ├── notification.service.ts
│   │   ├── project.service.ts
│   │   ├── label.service.ts
│   │   ├── search.service.ts
│   │   ├── auth.service.ts
│   │   ├── ai/                     # AI 插件
│   │   │   ├── types.ts            # AIProvider 接口
│   │   │   ├── null-provider.ts    # 空实现
│   │   │   └── provider.ts         # 工厂
│   │   └── storage/                # 文件存储抽象
│   │       ├── types.ts            # StorageProvider 接口
│   │       ├── local-provider.ts   # 本地存储实现
│   │       ├── s3-provider.ts      # S3 兼容存储实现
│   │       └── index.ts            # 工厂函数
│   ├── lib/
│   │   ├── db.ts                   # Prisma client
│   │   ├── auth.ts                 # NextAuth 配置
│   │   ├── errors.ts               # AppError 统一错误类
│   │   ├── sse.ts                  # SSE 连接管理
│   │   ├── validation/             # Zod schemas
│   │   └── constants.ts            # 状态枚举、角色定义、流转矩阵、权限矩阵
│   ├── hooks/                      # React hooks
│   │   └── use-notifications.ts    # SSE 客户端 hook
│   └── types/                      # 共享类型定义
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── uploads/                        # 本地附件存储（默认路径，可配置）
└── docs/
    ├── spec.md                     # 本规范文档
    └── plan.md                     # 实现计划
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
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?
  lastRequirementNumber Int @default(0)  // 需求编号自增计数器（并发安全）
  members     ProjectMember[]
  requirements Requirement[]
  labels      Label[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
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

model Requirement {
  id              String             @id @default(cuid())
  projectId       String
  project         Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)
  authorId        String
  author          User               @relation("Author", fields: [authorId], references: [id], onDelete: Cascade)
  number          Int                // 项目内自增编号，如 #1, #2
  title           String             @db.VarChar(200)  // 唯一必填字段，最小提交阻力
  body            String?            // Markdown 内容，可选
  status          RequirementStatus  @default(SUBMITTED)
  priority        Priority           @default(MEDIUM)
  assigneeId      String?            // 指派给谁
  assignee        User?              @relation("Assignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  expectedDate    DateTime?          // 期望交付日期
  acceptanceCriteria String?         // 验收标准
  comments        Comment[]
  votes           Vote[]
  statusLogs      StatusLog[]
  labels          RequirementLabel[]
  attachments     Attachment[]
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  @@unique([projectId, number])
  @@index([status])
  @@index([assigneeId])
  @@index([authorId])
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
GET    /api/projects/:slug                    → 项目详情（仅项目成员可访问）
POST   /api/projects/:slug/members            → 添加项目成员（仅 OWNER/ADMIN）
DELETE /api/projects/:slug/members/:userId    → 移除项目成员（仅 OWNER/ADMIN）

// 需求
GET    /api/projects/:slug/requirements       → 需求列表（分页+筛选+排序，仅项目成员）
POST   /api/projects/:slug/requirements       → 创建需求（仅需 title，任何项目成员）
GET    /api/requirements/:id                  → 需求详情（含 author/assignee/labels/voteCount/commentCount/attachments）
PATCH  /api/requirements/:id                  → 更新需求（author 可改 title/body；Manager 可改 priority/assigneeId/expectedDate/acceptanceCriteria）
POST   /api/requirements/:id/transition       → 状态流转（body: { toStatus, note? }，校验权限矩阵）

// 评论
GET    /api/requirements/:id/comments         → 评论列表（分页，排除 isDeleted）
POST   /api/requirements/:id/comments         → 添加评论（项目成员）
PATCH  /api/comments/:id                      → 编辑评论（仅作者本人）
DELETE /api/comments/:id                      → 删除评论（软删除，仅作者本人或 Manager）

// 投票
POST   /api/requirements/:id/vote             → 投票(toggle)，返回 { voted: boolean, count: number }

// 附件
POST   /api/attachments/upload                → 上传文件（multipart，body 含 requirementId）
GET    /api/attachments/:id                   → 下载附件（local: 流式响应；s3: 302 跳转预签名 URL）
DELETE /api/attachments/:id                   → 删除附件（Uploader 或 Manager）

// 通知
GET    /api/notifications                     → 通知列表（分页，支持 ?unread=true 筛选）
PATCH  /api/notifications/:id/read            → 标记单条已读
POST   /api/notifications/read-all            → 全部标记已读

// 实时（SSE）
GET    /api/sse                               → SSE 连接（通过 cookie 认证，推送当前用户相关事件）

// 标签
GET    /api/projects/:slug/labels             → 标签列表
POST   /api/projects/:slug/labels             → 创建标签（MANAGER/OWNER）
DELETE /api/labels/:id                        → 删除标签
POST   /api/requirements/:id/labels           → 为需求添加标签（body: { labelId }）
DELETE /api/requirements/:id/labels/:labelId  → 移除需求的标签

// 用户管理（Admin）
GET    /api/admin/users                       → 用户列表（ADMIN）
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
| 投票达到 5/10/20/50 票 | VOTE_MILESTONE | 项目所有 MANAGER |
| 被指派 | ASSIGNMENT | 被指派的用户 |

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
- 附件下载校验权限（项目成员）
- Markdown 渲染必须经过 rehype-sanitize（禁用 raw HTML，过滤 javascript: URL）
- 认证端点速率限制（登录 10 次/15 分钟）
- 密码使用 bcrypt 哈希（cost factor ≥ 12）
- 用户删除采用 Cascade（需求/评论/投票级联删除）
- 评论删除采用软删除（isDeleted = true，保留审计）

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

### getNextNumber 并发安全策略

```typescript
// 使用数据库事务 + 行锁保证并发安全
async function getNextNumber(projectId: string): Promise<number> {
  return db.$transaction(async (tx) => {
    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      // SELECT ... FOR UPDATE 行锁
    })
    const nextNumber = (project.lastRequirementNumber ?? 0) + 1
    await tx.project.update({
      where: { id: projectId },
      data: { lastRequirementNumber: nextNumber },
    })
    return nextNumber
  })
}
// Project 模型需新增 lastRequirementNumber Int @default(0) 字段
```

## 环境变量

```bash
# .env.example（提交到仓库的模板）
DATABASE_URL="postgresql://user:password@localhost:5432/easyreq"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# 文件存储
STORAGE_PROVIDER=local              # local | s3
STORAGE_LOCAL_PATH=./uploads
STORAGE_MAX_FILE_SIZE=10485760      # 10MB

# S3 兼容存储（当 STORAGE_PROVIDER=s3 时）
STORAGE_S3_BUCKET=
STORAGE_S3_REGION=
STORAGE_S3_ENDPOINT=                # 留空使用 AWS 默认，MinIO/阿里OSS 填自定义
STORAGE_S3_ACCESS_KEY=
STORAGE_S3_SECRET_KEY=

# AI 插件
AI_ENABLED=false
# AI_PROVIDER=openai               # 后续实现时填写
# AI_API_KEY=                      # 后续实现时填写
```

## 已决议事项

以下决策已在规划阶段与用户确认：

1. **目标用户**：企业内部 IT 部门（类似华为 IT 装备制造部场景），非 SaaS 多租户
2. **产品模型**：类 GitHub Issues 的项目空间模型，非传统需求管理后台
3. **AI 定位**：辅助分析 + 自动生成，作为可选插件（MVP 阶段仅预留接口）
4. **架构分层**：Service 层隔离，Server Actions / Route Handlers 共享同一 Service 层
5. **通知方案**：SSE (Server-Sent Events) 实时推送
6. **状态权限**：角色绑定状态流转，不同角色只能推进特定状态
7. **快速通道**：Manager 可对简单需求跳过中间 IPD 状态，但 StatusLog 完整记录
8. **Markdown 预览**：需求描述和评论支持实时预览
9. **附件上传**：支持本地存储和 S3 兼容存储，通过环境变量配置切换
10. **提需求阻力**：最小化 — 只需标题即可提交，所有其他字段可选，支持快捷键和草稿自动保存
11. **状态回退**：IN_TESTING 可退回 IN_DEVELOPMENT，DELIVERED 可退回 IN_DEVELOPMENT，PLANNED 可 REJECTED，ACCEPTED 可 reopen
12. **分类方式**：使用 Label 系统（非 Requirement.category 字段，已移除）
13. **用户管理**：不开放公开注册，由 Admin 创建用户，第一个 ADMIN 由 seed 脚本创建
14. **ADMIN 角色**：超级用户，可执行所有操作
15. **权限模型**：全局 Role 决定操作类型 + ProjectRole 决定项目访问权限
16. **评论删除**：软删除（isDeleted），保留审计追溯
17. **SSE 部署**：MVP 单实例，后续可扩展 Redis pub/sub 跨实例广播
18. **需求编号**：Project.lastRequirementNumber 字段 + 事务行锁保证并发安全
