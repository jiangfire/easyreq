import { getCurrentUser } from '@/services/auth.service'
import { db } from '@/lib/db'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) return null

  const projects = await db.project.findMany({
    where: {
      members: { some: { userId: user.id } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { requirements: true } },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar projects={projects} />
      <div className="flex flex-1 flex-col lg:pl-64">
        <Header user={user} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
