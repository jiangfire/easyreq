import { getCurrentUser } from '@/services/auth.service'
import { redirect } from 'next/navigation'
import { UserManagementTable } from '@/components/admin/user-management-table'

export default async function UsersPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    redirect('/admin')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">用户管理</h1>
      <UserManagementTable />
    </div>
  )
}
