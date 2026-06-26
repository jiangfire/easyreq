import { getCurrentUser } from '@/services/auth.service'
import { projectService } from '@/services/project.service'
import { RequirementForm } from '@/components/requirement/requirement-form'
import { notFound } from 'next/navigation'

export default async function NewRequirementPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getCurrentUser()
  if (!user) return null

  try {
    await projectService.getBySlug(slug, user.id)
  } catch {
    notFound()
  }

  return <RequirementForm projectSlug={slug} />
}
