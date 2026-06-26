import { getCurrentUser } from '@/services/auth.service'
import { redirect } from 'next/navigation'

export default async function Home() {
  const user = await getCurrentUser()
  if (user) {
    redirect('/dashboard')
  }
  redirect('/login')
}
