import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // Create users
  const passwordHash = await bcrypt.hash('password123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@easyreq.dev' },
    update: {},
    create: {
      email: 'admin@easyreq.dev',
      name: 'System Admin',
      passwordHash,
      role: 'ADMIN',
    },
  })

  const manager = await prisma.user.upsert({
    where: { email: 'manager@easyreq.dev' },
    update: {},
    create: {
      email: 'manager@easyreq.dev',
      name: 'IT Manager',
      passwordHash,
      role: 'MANAGER',
    },
  })

  const developer = await prisma.user.upsert({
    where: { email: 'dev@easyreq.dev' },
    update: {},
    create: {
      email: 'dev@easyreq.dev',
      name: 'IT Developer',
      passwordHash,
      role: 'DEVELOPER',
    },
  })

  const submitter1 = await prisma.user.upsert({
    where: { email: 'alice@company.dev' },
    update: {},
    create: {
      email: 'alice@company.dev',
      name: 'Alice (Submitter)',
      passwordHash,
      role: 'SUBMITTER',
    },
  })

  const submitter2 = await prisma.user.upsert({
    where: { email: 'bob@company.dev' },
    update: {},
    create: {
      email: 'bob@company.dev',
      name: 'Bob (Submitter)',
      passwordHash,
      role: 'SUBMITTER',
    },
  })

  console.log(`Created 5 users: ${[admin, manager, developer, submitter1, submitter2].map((u) => u.email).join(', ')}`)

  // Create projects
  const portalProject = await prisma.project.upsert({
    where: { slug: 'internal-portal' },
    update: {},
    create: {
      name: 'Internal Portal',
      slug: 'internal-portal',
      description: '企业内部门户系统需求收集',
      members: {
        create: [
          { userId: manager.id, role: 'OWNER' },
          { userId: developer.id, role: 'MEMBER' },
          { userId: submitter1.id, role: 'MEMBER' },
          { userId: submitter2.id, role: 'MEMBER' },
        ],
      },
    },
    include: { members: true },
  })

  const infraProject = await prisma.project.upsert({
    where: { slug: 'it-infra' },
    update: {},
    create: {
      name: 'IT Infrastructure',
      slug: 'it-infra',
      description: 'IT基础设施需求',
      members: {
        create: [
          { userId: manager.id, role: 'OWNER' },
          { userId: developer.id, role: 'MEMBER' },
          { userId: admin.id, role: 'MEMBER' },
        ],
      },
    },
    include: { members: true },
  })

  console.log(`Created 2 projects: ${portalProject.name}, ${infraProject.name}`)

  // Create labels for portal project
  const bugLabel = await prisma.label.create({
    data: { name: 'bug', color: '#d73a4a', projectId: portalProject.id },
  })
  const featureLabel = await prisma.label.create({
    data: { name: 'feature', color: '#a2eeef', projectId: portalProject.id },
  })
  const enhancementLabel = await prisma.label.create({
    data: { name: 'enhancement', color: '#84b6eb', projectId: portalProject.id },
  })

  console.log(`Created 3 labels for ${portalProject.name}`)

  // Create requirements
  const requirements = [
    {
      title: '登录页面支持企业微信扫码登录',
      body: '目前只有账号密码登录，希望支持企业微信扫码，方便员工快速登录。',
      status: 'UNDER_REVIEW' as const,
      priority: 'HIGH' as const,
      author: submitter1,
      project: portalProject,
    },
    {
      title: '门户首页加载速度优化',
      body: '首页加载需要3秒以上，希望优化到1秒以内。',
      status: 'IN_DEVELOPMENT' as const,
      priority: 'CRITICAL' as const,
      author: submitter2,
      project: portalProject,
      assignee: developer,
    },
    {
      title: '增加数据导出功能',
      body: '希望支持将报表导出为Excel和CSV格式。',
      status: 'SUBMITTED' as const,
      priority: 'MEDIUM' as const,
      author: submitter1,
      project: portalProject,
    },
    {
      title: '修复用户头像上传失败的问题',
      body: '上传超过2MB的头像时返回500错误。',
      status: 'IN_TESTING' as const,
      priority: 'HIGH' as const,
      author: submitter2,
      project: portalProject,
      assignee: developer,
    },
    {
      title: '邮件通知支持自定义模板',
      body: '希望管理员可以自定义邮件通知的模板内容。',
      status: 'PLANNED' as const,
      priority: 'LOW' as const,
      author: submitter1,
      project: portalProject,
    },
    {
      title: '服务器磁盘空间监控告警',
      body: '需要增加磁盘空间使用率超过80%时的自动告警。',
      status: 'DELIVERED' as const,
      priority: 'HIGH' as const,
      author: manager,
      project: infraProject,
      assignee: developer,
    },
    {
      title: 'VPN接入配置文档更新',
      body: 'VPN配置文档过时，需要更新为最新版本。',
      status: 'ACCEPTED' as const,
      priority: 'LOW' as const,
      author: submitter1,
      project: infraProject,
    },
    {
      title: '增加操作日志审计功能',
      body: '需要记录所有用户的操作日志，支持按时间、用户、操作类型筛选。',
      status: 'SUBMITTED' as const,
      priority: 'MEDIUM' as const,
      author: submitter2,
      project: infraProject,
    },
  ]

  for (let i = 0; i < requirements.length; i++) {
    const r = requirements[i]
    const existing = await prisma.requirement.findFirst({
      where: { projectId: r.project.id, title: r.title },
    })
    if (existing) {
      console.log(`  Requirement #${existing.number} already exists: ${r.title}`)
      continue
    }

    const number = i + 1
    const req = await prisma.requirement.create({
      data: {
        projectId: r.project.id,
        authorId: r.author.id,
        number,
        title: r.title,
        body: r.body,
        status: r.status,
        priority: r.priority,
        assigneeId: r.assignee?.id ?? null,
        labels: r.project === portalProject && i < 2
          ? { create: [{ labelId: i === 0 ? featureLabel.id : enhancementLabel.id }] }
          : undefined,
      },
    })
    console.log(`  Created #${req.number}: ${r.title} [${r.status}]`)

    // Add a comment to the first requirement
    if (i === 0) {
      await prisma.comment.create({
        data: {
          requirementId: req.id,
          authorId: manager.id,
          body: '已收到需求，我们会评估优先级。',
        },
      })
    }

    // Add votes to the first two requirements
    if (i < 2) {
      await prisma.vote.createMany({
        data: [
          { requirementId: req.id, userId: submitter1.id },
          { requirementId: req.id, userId: submitter2.id },
        ],
        skipDuplicates: true,
      })
    }
  }

  console.log('Seed complete!')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
