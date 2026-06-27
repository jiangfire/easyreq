# easyreq

[English](README.md) · [简体中文](README.zh-CN.md)

一个给企业内部 IT 部门用的 GitHub Issues 风格需求看板。写个标题就能提单，状态沿 IPD 流程走，沟通公开透明地挂在每条工单上。

![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2.4-149eca?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-必装-336791?logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?logo=prisma)
![License](https://img.shields.io/badge/license-MIT-green)

## 为什么做 easyreq

大多数"需求跟踪"工具提个工单像在填税表。easyreq 反过来：只填一个标题就能提交，其他字段都是可选的，团队成员之后补。

我们按 IT 部门真实的工作流打造它。一线工程师提问题，经理分派，开发评估并落地。easyreq 让所有参与者都能看到这条循环在跑。

## 你能拿到什么

**五秒钟提一条需求。** 一个标题框，回车。验收标准、优先级、期望交付日期都可以后补。把摩擦挡在门口，不卡在表单里。

**两条状态路径，一张看板。** 标准 IPD 流程：已提交 → 已受理 → 进行中 → 已交付 → 已关闭。经理可以走快速通道，跳过中间状态处理紧急工作。

**每条工单自带论坛式讨论。** 嵌套评论、投票排序、@mention 拉人、Markdown 实时预览。对话贴在工单旁边，不丢在邮件链里。

**SSE 实时通知。** 状态变更、新评论、投票里程碑、@提醒：右上角小铃铛自动刷新，不需要手动 F5。

**存储你说了算。** 单机部署用本地文件系统，规模上来了切到 S3 兼容对象存储（MinIO、阿里云 OSS、AWS S3）。一个环境变量搞定切换。

**权限分层内置。** Member 提单和评论，Manager 编辑和流转状态，Admin 管理项目、标签、成员。角色校验集中在 service 层，不散落在 route handler 里。

**可插拔的 AI 钩子。** 预留了 service 接口，接分类、去重、优先级建议随时都行。模型自己接，目前不绑死。

## 快速开始

```bash
git clone https://github.com/your-org/easyreq.git
cd easyreq
npm install
cp .env.example .env
# 填好 DATABASE_URL、NEXTAUTH_SECRET，以及至少一种存储配置
npx prisma migrate dev
npm run db:seed   # 可选，写入演示数据
npm run dev
```

开发服务器跑在 http://localhost:3000。用 seed 出来的管理员登录，或者自己注册一个。

## 技术架构

| 层 | 选型 | 原因 |
|---|---|---|
| 框架 | Next.js 16 App Router | 服务端组件渲染公开列表，route handler 暴露 API，详情页用 RSC 流式输出 |
| 数据库 | PostgreSQL + Prisma 7 | 关系模型强，类型自动生成，需要时还能切到原生 SQL |
| 认证 | NextAuth.js 5 (beta) | 凭据登录 + bcrypt，JWT session，角色写到 token |
| 存储 | 可插拔 `StorageProvider` | 开发用 `LocalStorageProvider`，生产用支持预签名 URL 的 `S3StorageProvider` |
| 实时 | Server-Sent Events | 单向推送，浏览器原生支持，不用折腾 WebSocket |
| UI | Tailwind 4 + shadcn 风格组件 | 标记自己掌控，省掉运行时 |

业务规则全部在 `src/services/`。route handler 负责把 HTTP 转成 service 调用，再把 `AppError` 翻译成结构化 JSON 返回。同一套 service 既给 API 用、也给测试用，以后想加 SDK 也是同一套入口。

## 目录结构

```
src/
  app/                    Next.js App Router（页面 + API 路由）
  services/               业务逻辑——唯一直接操作 Prisma 的地方
  lib/                    跨模块工具（auth、errors、storage、sse）
  components/             按功能分组的 UI 组件
  hooks/                  客户端 React hooks
prisma/
  schema.prisma           数据模型的唯一真源
tests/
  unit/                   纯逻辑和 provider 测试
  integration/            跑在独立测试库上的 service 集成测试
docs/
  spec.md                 产品规范（合同）
  plan.md                 架构与实现决策
```

## 参与贡献

欢迎提 PR。先看 `docs/plan.md` 了解当前进度。提交前跑一遍：

```bash
npm run lint
npm run typecheck
npm test
```

集成测试用独立的测试库，从 `DATABASE_URL` 派生（`<db>_test`）。如果 URL 不是 `_test` 结尾，测试会直接拒绝启动，开发数据不会被擦。

## 协议

MIT。可以使用、修改、拿去发布。详见 [LICENSE](LICENSE)。

## 文档

- [产品规范](docs/spec.md)
- [架构与实现计划](docs/plan.md)
