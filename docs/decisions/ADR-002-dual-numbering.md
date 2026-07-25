# ADR-002: Dual numbering for requirements (globalNumber + project number)

## Status

Accepted

## Date

2026-07

## Context

ADR-001 引入了"未归集需求"概念后，需求编号方案需要重新设计：

- 已归集需求沿用旧的 `Project.lastRequirementNumber`，每项目从 1 开始
- 未归集需求没有项目，没有项目编号
- 但所有需求都需要稳定的"外部 ID"用于引用、通知、URL

如果只有 `number`（项目内），未归集需求就只能用 cuid 作为外部 ID，可读性差，链接也是 `/requirements/<cuid>` 不美观。

如果只有 `globalNumber`（全局自增），归集到项目后客户看到 `#123` 而不是 `#P-1`，失去项目内引用关系。

## Decision

采用**双编号**：

- `globalNumber Int @unique`：所有需求都有，全局唯一自增，作为稳定的"对外 ID"
- `number Int?`：仅已归集需求有，项目内自增，提供项目维度的快速引用

### 显示策略

- 未归集需求：显示 `#${globalNumber}`
- 已归集需求：
  - 项目上下文（项目内列表、详情页）：优先显示 `#${number}`，通知/链接也用 `requirementLink(slug, number)`
  - 跨项目上下文（仪表盘、搜索结果）：显示 `#${globalNumber}`，因为客户不一定记得项目编号

### 并发安全

两个编号都通过 Prisma 原子 `update { increment: 1 }` 实现：

```typescript
// 全局编号
await db.globalCounter.update({
  where: { name: 'requirement' },
  data: { value: { increment: 1 } },
  select: { value: true },
})

// 项目编号
await db.project.update({
  where: { id: projectId },
  data: { lastRequirementNumber: { increment: 1 } },
  select: { lastRequirementNumber: true },
})
```

不需要显式事务或行锁。Prisma 会生成单条 `UPDATE ... RETURNING` 语句，由数据库保证原子性。

### 迁移

```sql
-- 已有需求按 createdAt 补 globalNumber
UPDATE "Requirement" r SET "globalNumber" = sub.rn
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn FROM "Requirement") sub
WHERE r.id = sub.id;

-- 初始化 GlobalCounter
INSERT INTO "GlobalCounter" (id, name, value)
VALUES (gen_random_uuid()::text, 'requirement', (SELECT MAX("globalNumber") FROM "Requirement"));
```

迁移幂等：若 `Requirement.globalNumber` 已存在则跳过。

## Alternatives Considered

### A. 只用 `number`（项目内）

放弃，未归集需求没有项目编号。

### B. 只用 `globalNumber`

放弃，项目内快速引用（如"看 P-3"）变成"看 #123"，失去局部性。

### C. UUID 作为外部 ID + 显示用 `number`

UUID 不美观（`/requirements/cmqxf6lwt0003jgwl7td6u7jy`），且不可读。

### D. 复合 ID（如 `P-1`, `G-1`）

需要把 `number` 改字符串，多语言环境排序/索引麻烦。

## Consequences

**正面**：
- 对外引用稳定：通知、URL、深链接都用 globalNumber
- 项目内引用仍便捷：开发者之间说"看 P-3"就行
- 两个编号独立维护，无需协调

**代价**：
- URL 出现双编号 → 已归集需求主要用 `/projects/${slug}/requirements/${id}`，cuid 在路径里；未归集用 `/requirements/${id}`
- 通知标题/链接要选择 display number（`number ?? globalNumber`）
- 搜索结果、仪表盘等跨项目场景统一显示 globalNumber

## Notes

最初实现时把所有需求的 `number` 都设为必填（参考 GitHub Issues）。ADR-001 的产品模型调整要求重新设计编号方案。

Prisma 的 `update { increment: 1 }` 在 PostgreSQL 上是 `UPDATE ... SET x = x + 1 RETURNING *`，单语句原子，比 read-then-write + 显式事务简单得多，也避免了死锁。