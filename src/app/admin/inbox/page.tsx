import { getCurrentUser } from '@/services/auth.service'
import { redirect } from 'next/navigation'
import { projectService } from '@/services/project.service'
import { RequirementInbox } from '@/components/requirement/requirement-inbox'

export default async function AdminInboxPage() {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/dashboard')
  }

  const projects = await projectService.listForUser(user.id)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">需求池</h1>
      <p className="text-sm text-gray-500">未归集到项目的需求，管理员可在此归集</p>
      <RequirementInbox projects={projects.map((p) => ({ id: p.id, name: p.name, slug: p.slug }))} />
    </div>
  )
}
