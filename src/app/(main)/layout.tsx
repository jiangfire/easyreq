import { getCurrentUser } from '@/services/auth.service'
import { projectService } from '@/services/project.service'
import { notificationService } from '@/services/notification.service'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { GlobalQuickSubmit } from '@/components/requirement/global-quick-submit'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) return null

  const [projects, unreadCount] = await Promise.all([
    projectService.listForUser(user.id),
    notificationService.countUnread(user.id),
  ])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar projects={projects} role={user.role} />
      <div className="flex flex-1 flex-col pb-16 lg:pb-0 lg:pl-64">
        <Header user={user} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
        <GlobalQuickSubmit userRole={user.role} />
      </div>
      <MobileTabBar
        role={user.role}
        projects={projects}
        hasUnread={unreadCount > 0}
      />
    </div>
  )
}
