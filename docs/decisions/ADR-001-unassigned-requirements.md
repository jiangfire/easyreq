# ADR-001: Requirements can exist without a project ("项目后建")

## Status

Accepted

## Date

2026-07

## Context

最初的 spec 把需求建模为 GitHub Issues：每个需求必须挂在一个项目下，提交者必须先被加入项目才能提需求。这反映了 IT 部门内部的"评审 → 立项 → 开发"流程。

但真实业务场景里，**客户提需求的时刻往往还没有项目**：
- 业务部门看到系统不顺手，临时提个想法，可能不会真的要做
- 跨团队的"模糊需求"（如"这个审批能不能加个按钮"）不知道归哪个项目
- 早期 PM 还没建好项目骨架

强制要求选项目会造成两个问题：
1. **客户阻力**：提交者根本不知道归哪个项目，要么瞎选，要么放弃提
2. **PM 阻力**：PM 经常需要先建一个"占位项目"接需求，事后再调整

这违背了原 spec "提需求阻力最小化"的成功标准（5 秒提交）。

## Decision

需求可以先于项目存在，由 PM/管理者后续归集（"项目后建"模型）。

### Schema 改造

```prisma
model Requirement {
  projectId    String?     // 可空
  globalNumber Int         @unique   // 全局唯一，所有需求都有
  number       Int?        // 项目内编号，归集后才有
}

model GlobalCounter {        // 新表
  name  String @unique
  value Int    @default(0)
}
```

- 未归集需求：`projectId=null, number=null`，只有 `globalNumber`
- 已归集需求：`globalNumber` 不变 + 新生成 `number`
- 迁移时用 `ROW_NUMBER() OVER (createdAt)` 给已有需求补 `globalNumber`，初始化 GlobalCounter 为 MAX(globalNumber)

### 行为规则

| 场景 | 未归集 | 已归集 |
|---|---|---|
| 谁可创建 | 任何登录用户 | 项目成员 |
| 标题 | 必填 | 必填 |
| 描述/优先级/日期 | 可选 | 可选 |
| 评论 | **任何登录用户** | 项目成员 |
| 投票 | **任何登录用户** | 项目成员 + ADMIN |
| 标签 | ❌（Label 是项目维度） | ✅ |
| 指派 | ❌ | ✅ |
| 状态流转 | SUBMITTED ↔ REJECTED | 完整 IPD 矩阵 |
| SSE 广播 | 只推给作者 | 推项目成员 |
| 通知 | 只通知作者 | 按现有规则 |

### UI 调整

- 客户仪表盘改为 flat list（自己提交 + 指派给自己的）
- 新增 `/requirements/[id]` 详情页（无项目上下文）
- 新增需求池 `/requirements/inbox` 和 `/admin/inbox`（MANAGER/ADMIN）
- 侧边栏 SUBMITTER 不显示项目和需求池

### 归集方式

- 单条：MANAGER/ADMIN 在需求池点击"归集到项目" → 选择项目 → 生成项目编号
- 批量：新建项目时勾选若干未归集需求 → 一次性归集

## Alternatives Considered

### A. 维持"必须选项目"

放弃，违背成功标准（5 秒提交），增加客户和 PM 双重负担。

### B. 占位项目"需求池"

新建一个公共项目叫"需求池"，所有未归集需求都挂在这里。问题：
- 客户必须知道并加入这个项目才能提需求
- 需求池项目"成员=全员"，权限模型失效
- 不如直接允许 `projectId = null` 干净

### C. 延迟项目 ID 字段

保留 `projectId NOT NULL`，但加 `pooledInboxId` 表示需求池。问题：双 ID 冗余，跨项目检索慢。

### D. 复用现有 `projectId` 但允许自引用"需求池"项目

技术上可行（选个特殊 projectId 表示需求池），但污染了 Project 表语义，迁移旧数据时仍需要某种 nullable 机制。

## Consequences

**正面**：
- 提需求阻力真正最小化（5 秒完成）
- PM 可以从需求池批量归集到新项目，提升评审效率
- 同一客户视角下，所有自己提的需求都能看到（不被项目边界切碎）
- 真实匹配业务场景（"先抱怨，后立项"）

**代价**：
- 数据模型变复杂（双编号、projectId 可空）
- 大量现有代码需要 nullable 兼容（特别是 `getById` 的成员检查）
- UI 多一套（未归集详情页）
- 状态流转要分支（未归集需求绕过 IPD 矩阵）
- 文档（spec/plan）需要重写一部分

**风险缓解**：
- 双编号都已用 Prisma `update { increment: 1 }` 原子实现，无显式锁
- 共享的 `requireRequirementAccess` 集中处理"未归集 vs 已归集"的访问分支
- 集成测试覆盖所有服务层的未归集分支（28 个用例）

## Notes

这次改动是在 MVP 已完成（Phase 1-3 全部 done）之后，由真实用户使用反馈触发的：

> "我在用需求收集的平台，还没有项目的概念"
> "在需求最一开始的阶段，也就是客户提需求，那个时候没有项目啊"
> "客户只有需求能看到，也许其他角色才能看到项目这些东西"

实现是渐进式的，先用一次对话确认产品方向，再用 vertical slice（schema → 核心服务 → UI → 通知 → 角色视图）逐步交付。