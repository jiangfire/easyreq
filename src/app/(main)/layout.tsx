import { getCurrentUser } from '@/services/auth.service'
import { projectService } from '@/services/project.service'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { GlobalQuickSubmit } from '@/components/requirement/global-quick-submit'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) return null

  const projects = await projectService.listForUser(user.id)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar projects={projects} />
      <div className="flex flex-1 flex-col lg:pl-64">
        <Header user={user} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
        <GlobalQuickSubmit />
      </div>
    </div>
  )
}
