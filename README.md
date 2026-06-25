# easyreq

面向企业内部 IT 部门的需求收集与状态跟踪工具，交互模型类似 GitHub Issues。

- 提需求阻力最小化 — 只需标题即可提交，其他字段均可选
- IPD 风格状态流转 — 标准路径 + 快速通道（Manager 可跳过中间状态）
- 论坛式互动 — 评论、投票、@mention，Markdown 实时预览
- 实时通知 — SSE 推送状态变更、新评论、投票里程碑
- 附件上传 — 支持本地存储和 S3 兼容存储（MinIO/阿里OSS），可配置切换
- AI 插件化 — 预留接口，后续接入分类/去重/优先级建议

## 文档

- [产品规范 (Spec)](docs/spec.md)
- [实现计划 (Plan)](docs/plan.md)

## 技术栈

Next.js 15 (App Router) + PostgreSQL + Prisma + NextAuth.js + Tailwind CSS + shadcn/ui
