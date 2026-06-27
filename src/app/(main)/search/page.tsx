import { getCurrentUser } from '@/services/auth.service'
import { redirect } from 'next/navigation'
import { SearchResults } from '@/components/search/search-results'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { q } = await searchParams

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">搜索结果</h1>
      <SearchResults query={q ?? ''} />
    </div>
  )
}
