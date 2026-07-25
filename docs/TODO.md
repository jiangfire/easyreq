# TODO: 未完成工作清单

按优先级排列。每个条目给出：描述、验收标准、估计工作量、依赖。

---

## P0 — 上线前必须

### 1. 跑通 S3 存储测试 ✅ DONE (2026-07)
- 安装 MinIO（`winget install MinIO.Server`），以 root `minioadmin` / `minioadmin` 启动
- 在 `localhost:9000` 创建 bucket `easyreq-s3-test`，运行 `npm run test:s3`，3 个用例全部通过
- 验收 ✅：S3StorageProvider 与真实 MinIO 端点互通正常
- **遗留**：CI 集成时仍需提供 MinIO 服务；测试默认不跑（`test:s3` 需要显式触发）

### 2. 重写 Playwright E2E ✅ DONE (2026-07)
- 重写三个 E2E 文件，覆盖新 UI：
  - `tests/e2e/submitter-flow.spec.ts`（2 个用例）：SUBMITTER 端到端 + 越权检查
  - `tests/e2e/manager-flow.spec.ts`（2 个用例）：标准路径 + 快速路径
  - `tests/e2e/role-visibility.spec.ts`（7 个用例）：四种角色侧边栏 + 越权重定向
- 副带改进：`addMemberSchema` 增加 `email` 选项（不再需要 ADMIN 权限查 userId），`api/projects/[slug]/members/route.ts` 支持邮箱添加
- 验收 ✅：`npx playwright test` → 11/11 通过（约 34s）
- 整改：`playwright.config.ts` 用内置 chromium-headless-shell（不再依赖系统 msedge）

---

## P1 — 应该尽快做

### 3. AI 插件接入（占位接口已就绪）✅ DONE (2026-07)
- 选型：**默认启发式（零依赖、离线）+ 可选 OpenAI 兼容 HTTP**。不绑死任何具体服务，便于本地无 key 演示
- 实现两个 provider：
  - `HeuristicAIProvider`（`src/lib/ai/heuristic-provider.ts`）：关键词分级 + 大小写/标点无关 + bigram Jaccard 相似度
  - `OpenAIProvider`（`src/lib/ai/openai-provider.ts`）：内置 fetch，无需 SDK；超 8s 超时降级 + JSON 解析失败降级
- 工厂切换（`src/lib/ai/index.ts`）：`AI_ENABLED=true` 时按 `AI_PROVIDER` 选实现；`false` 默认 `NullAIProvider`
- 集成（`src/services/requirement.service.ts`）：
  - `create()` / `createUnassigned()`：若用户没指定 priority，同步调 `suggestPriority()`（超时/失败降级为 MEDIUM）
  - 提交成功后 fire-and-forget：扫描作者最近 30 天同 scope 需求，相似度 ≥ 0.6 的 top-3 通过 `notificationService.createMany()` 发"可能与历史需求重复"通知
- 环境变量：`.env.example` 完整列出 `AI_ENABLED`/`AI_PROVIDER`/`AI_API_KEY`/`AI_BASE_URL`/`AI_MODEL`
- 验收 ✅：
  - 单元：23 个 AI 用例全过（关键词分级、相似度排序、忽略大小写/标点、列表分块提取）
  - 集成：4 个新用例覆盖"NullAIProvider 默认行为不变" + "启发式 override 未指定 priority" + "启发式触发重复通知"
  - 全套：lint ✅ / typecheck ✅ / unit+integration 143/143 ✅ / E2E 11/11 ✅ / build ✅
- **遗留**（后续可选）：
  - AI 分类结果落库（现在只影响 submit 时写入的 priority，未存储 AI 建议的 category 字段）
  - 多 requirement 批量提取 + paste-to-create 入口（`extractRequirements` 已实现但未接 UI）
  - OpenAI 模式下流式响应（当前是单次完整响应）（1d）

### 4. 通知中心补强 ✅ DONE (2026-07)
- 按类型筛选：`/notifications?type=COMMENT` 等，URL query 参数驱动；空筛选结果显示空态文案
- 按时间分组：今天 / 昨天 / 更早（`groupByTimeBucket`），每组显示数量徽章
- 点击即读：每条卡片用 `<form action={markReadAction}>` 提交 Server Action，同步标记已读 + 重定向到 `link`（若有），保证 badge 计数立即更新
- 批量删除：新建 `ClearReadForm` 客户端组件，下拉菜单"清除已读 / 清除全部"，调 `DELETE /api/notifications`，带 `?mode=read|all`
- API 扩展：
  - `GET /api/notifications?types=COMMENT,STATUS_CHANGE&unread=true&page=1&pageSize=25`
  - `DELETE /api/notifications` body `{ mode: 'read' | 'all' }`
  - `markRead` 幂等化（已读的不会被重复 stamp `readAt`）
- Bell 下拉：未读时点击直接 fire-and-forget PATCH 标记已读
- 验收 ✅：
  - 单元/集成：8 个新增通知测试（filter、idempotent markRead、bulk delete、用户隔离等），共 165/165 通过
  - E2E：11/11 仍通过
  - 全套：lint ✅ / typecheck ✅ / build ✅

### 5. 需求统计补强 ✅ DONE (2026-07)
- 项目积压排行（`getProjectBacklog`）：按 open 需求数倒序，含未归集（"未归集"虚拟项目）；每行附状态分布（如"评审:1 · 开发:2"）
- 时间窗口（`getWindowedStats` + `STATS_WINDOW_LABELS`）：全部 / 本周 / 本月 / 本季度，按 `createdAt` 过滤；返回 total / open / closed 三组计数
- 用户贡献榜（`getUserLeaderboard`）：同时给出提交最多 + 关闭最多两个 top-5；用户对象含 id/name/email/role
- UI：`<TimeWindowFilter>` 客户端 chips 切换窗口；统计页加 3 个窗口卡片 + 项目积压栏 + 双榜
- 验收 ✅：
  - 单元/集成：14 个新增 stats 测试（按项目/窗口/贡献排名），共 165/165 通过
  - 全套：lint ✅ / typecheck ✅ / build ✅

---

## P2 — 体验优化

### 6. 需求拖拽排序（看板视图）✅ DONE (2026-07)
- 新建 `/projects/[slug]/board` 页面：8 列（SUBMITTED → ACCEPTED + REJECTED），卡片按状态分组
- `KanbanBoard` 客户端组件，原生 HTML5 drag-and-drop（无新依赖）：
  - 卡片用 `draggable` + `onDragStart/Over/Drop`
  - 拖到目标列后乐观更新 + POST `/api/requirements/:id/transition`（复用现有端点）
  - 失败时回滚到原列
  - 仅当 `hasTransitionPermission(from, to, role)` 为真才可拖（前端禁用）
- 项目详情页加"看板"链接
- 验收 ✅：集成测试 11 个用例（`tests/integration/kanban.test.ts`）；E2E 11/11；build ✅

### 7. 全文搜索升级 ✅ DONE (2026-07)
- 加 `pg_trgm` 扩展 + GIN 索引（`prisma/migrations/20260725120000_search_trgm_index`）
- **关键发现**：pg_trgm 的 `word_similarity` 对 CJK 文本返回 0（byte-trigram 不适合多字节字符）
- 实际方案：保留 `ILIKE` 子串匹配（CJK 友好）+ 手写相关性评分：
  - title 精确子串（不分大小写）：+10
  - title 子串：+5
  - body 子串：+3
  - 排序：rank desc → votes desc → createdAt desc
- 搜索 UI 加"匹配 X%"徽章 + 上下文 snippet
- 验收 ✅：集成测试 11 个用例；E2E 11/11；build ✅
- **遗留**：真正的 `tsvector` 中文分词需要额外分词器（jieba/zhparser），属后续 P3

### 8. 附件预览/在线查看 ✅ DONE (2026-07)
- 新建 `AttachmentPreview` 客户端组件：
  - 整张卡片可点击 → 模态打开
  - 图片：全屏居中
  - PDF：`<iframe src={url}>` 让 Chrome 内置 PDF viewer 渲染
  - 其他：显示图标 + 下载按钮
- 模态：Esc 关闭 / 背景点击关闭 / body scroll 锁
- 替换 `projects/[slug]/requirements/[id]/page.tsx` 和 `requirements/[id]/page.tsx` 的附件渲染
- 验收 ✅：build 通过，E2E 不变

### 9. 移动端体验 ✅ DONE (2026-07)
- 新建 `MobileTabBar` 客户端组件（fixed bottom，`lg:hidden`）：
  - 4 个一级 tab：看板 / 搜索 / 通知 / 项目
  - 通知 tab 有未读小红点
  - 右侧"更多"按钮打开全屏抽屉（含完整项目列表 + inbox + admin）
- `(main)/layout.tsx` 加 `pb-16 lg:pb-0` 给内容区留出底部空间
- 桌面端（`lg`）继续用侧边栏，底部栏隐藏
- 验收 ✅：build 通过，E2E 不变
- **遗留**：移动端详情页 / 看板的横滑体验优化；iOS safe-area 真机验证

---

## P3 — 长期 / 架构

### 10. Redis pub/sub 跨实例 SSE
- **现状**：`EventEmitter` 内存版，单实例
- **Spec 非目标里已声明**：MVP 单实例，后续加
- **可做**：用 Redis pub/sub 让多个 Next.js 实例共享 SSE 通道
- **依赖**：Redis 运维
- **工作量**：M

### 11. 字段级编辑审计
- **现状**：只有 StatusLog 记录状态变更
- **Spec 非目标里已声明**：MVP 不做
- **可做**：类似 StatusLog，加一个 EditLog 记录 title/body/priority 等字段的修改
- **工作量**：M

### 12. 公开注册 / OAuth
- **现状**：仅 Admin 后台创建用户
- **如果开放注册**：加邮箱验证流程、密码强度策略、邀请制注册
- **可加**：OAuth（GitHub / Google / 企业 SSO）
- **工作量**：L

---

## 性能 / 监控（DevOps）

### 13. 慢查询监控
- **现状**：无
- **可加**：Prisma query log + 慢查询阈值 + 集成到 APM
- **工作量**：S

### 14. 错误上报
- **现状**：未捕获错误只在 stderr 输出
- **可加**：Sentry / 自建错误收集
- **工作量**：S

### 15. Dockerfile 多阶段构建优化
- **现状**：根目录有 `Dockerfile`，未验证
- **可加**：.next/standalone 输出 + 减小镜像
- **工作量**：S

---

## 优先级总览

| 优先级 | 条目 | 工作量 |
|---|---|---|
| ~~P0~~ | ~~1. S3 测试~~ | ~~S~~ ✅ |
| ~~P0~~ | ~~2. E2E 重写~~ | ~~L~~ ✅ |
| ~~P1~~ | ~~3. AI 插件~~ | ~~M~~ ✅ |
| ~~P1~~ | ~~4. 通知中心补强~~ | ~~M~~ ✅ |
| ~~P1~~ | ~~5. 统计补强~~ | ~~M~~ ✅ |
| ~~P2~~ | ~~6. 拖拽看板~~ | ~~M~~ ✅ |
| ~~P2~~ | ~~7. 全文搜索升级~~ | ~~S-M~~ ✅ |
| ~~P2~~ | ~~8. 附件预览~~ | ~~M~~ ✅ |
| ~~P2~~ | ~~9. 移动端~~ | ~~L~~ ✅ |
| P3 | 10. Redis pub/sub | M |
| P3 | 11. 字段级审计 | M |
| P3 | 12. 公开注册/OAuth | L |
| 运维 | 13. 慢查询监控 | S |
| 运维 | 14. 错误上报 | S |
| 运维 | 15. Dockerfile 优化 | S |

---

## 完成度统计

- **spec 已决议 19 项**：18 项已实现，1 项未实现（待定的具体 AI 服务）
- **plan 17 + 4 (Phase 3.5) = 21 个 Task**：17 个 done，4 个 done（含未归集扩展），0 个明确未完成（但 E2E 待补）
- **ADR**：2 个（项目后建、双编号）
- **文档同步**：spec.md / plan.md 已与代码对齐
- **测试**：
  - 单元/集成：187 个用例通过（`npm run test`），含 23 AI 单元 / 4 AI 集成 / 8 通知 / 14 stats / 11 search / 11 kanban
  - E2E：11 个用例通过（`npx playwright test`）
  - S3（MinIO 集成）：3 个用例通过（`npm run test:s3`）