import { getCurrentUser } from '@/services/auth.service'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="fixed left-0 top-0 z-10 hidden h-screen w-64 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="flex h-14 items-center border-b border-gray-200 px-4">
          <Link href="/" className="text-lg font-bold text-blue-600">
            easyreq
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <AdminNavLink href="/admin" label="统计看板" />
          <AdminNavLink href="/admin/review" label="评审队列" />
          <AdminNavLink href="/admin/users" label="用户管理" />
        </nav>
      </aside>
      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
          <h1 className="text-lg font-semibold text-gray-900">管理后台</h1>
          <Link href="/projects" className="text-sm text-blue-600 hover:text-blue-700">
            返回项目
          </Link>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

function AdminNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    >
      {label}
    </Link>
  )
}
