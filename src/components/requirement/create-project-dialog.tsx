'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProjectSchema } from '@/lib/validation/project'

export function CreateProjectDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setErrors({})

    const input = {
      name: formData.get('name') as string,
      slug: formData.get('slug') as string,
      description: (formData.get('description') as string) || undefined,
    }

    const result = createProjectSchema.safeParse(input)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[issue.path[0] as string] = issue.message
      }
      setErrors(fieldErrors)
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      })

      if (res.status === 409) {
        setErrors({ slug: '项目标识已存在' })
        setLoading(false)
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setErrors({ name: data?.error?.message ?? '创建失败' })
        setLoading(false)
        return
      }

      const project = await res.json()
      setOpen(false)
      router.push(`/projects/${project.slug}`)
      router.refresh()
    } catch {
      setErrors({ name: '网络错误，请重试' })
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        新建项目
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold">新建项目</h2>
            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">项目名称</label>
                <input
                  name="name"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="如：内部门户系统"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">项目标识</label>
                <input
                  name="slug"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="如：internal-portal"
                />
                <p className="mt-1 text-xs text-gray-400">用于 URL，只能包含小写字母、数字和连字符</p>
                {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">描述（可选）</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="项目说明..."
                />
                {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
