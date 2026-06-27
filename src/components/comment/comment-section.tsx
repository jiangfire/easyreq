'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { MarkdownEditor } from '@/components/ui/markdown-editor'

type Comment = {
  id: string
  body: string
  createdAt: string
  author: { id: string; name: string }
}

export function CommentSection({
  requirementId,
  initialComments,
  currentUserId,
}: {
  requirementId: string
  initialComments: Comment[]
  currentUserId: string
}) {
  const router = useRouter()
  const [comments, setComments] = useState(initialComments)
  const [newBody, setNewBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  async function handleSubmit() {
    if (!newBody.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/requirements/${requirementId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newBody.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error?.message ?? '评论失败')
        setLoading(false)
        return
      }

      const comment = await res.json()
      setComments([...comments, comment])
      setNewBody('')
      router.refresh()
    } catch {
      setError('网络错误')
      setLoading(false)
    }
  }

  async function handleDelete(commentId: string) {
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      if (!res.ok) {
        setError('删除失败')
        return
      }
      setComments(comments.filter((c) => c.id !== commentId))
      router.refresh()
    } catch {
      setError('网络错误')
    }
  }

  function startEdit(commentId: string, body: string) {
    setEditingId(commentId)
    setEditBody(body)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditBody('')
  }

  async function handleSaveEdit(commentId: string) {
    if (!editBody.trim()) return
    setEditLoading(true)
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editBody.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error?.message ?? '编辑失败')
        setEditLoading(false)
        return
      }
      const updated = await res.json()
      setComments(comments.map((c) => (c.id === commentId ? updated : c)))
      cancelEdit()
      router.refresh()
    } catch {
      setError('网络错误')
      setEditLoading(false)
    }
  }

  return (
    <div>
      {/* Comment list */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
              {comment.author.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{comment.author.name}</span>
                  <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                </div>
                {editingId === comment.id ? (
                  <div className="space-y-2">
                    <MarkdownEditor
                      value={editBody}
                      onChange={setEditBody}
                      onSubmit={() => handleSaveEdit(comment.id)}
                      placeholder="编辑评论..."
                      minHeight="60px"
                      requirementId={requirementId}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveEdit(comment.id)}
                        disabled={editLoading || !editBody.trim()}
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {editLoading ? '保存中...' : '保存'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-md px-3 py-1 text-xs text-gray-500 hover:bg-gray-100"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                      {comment.body}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              {editingId !== comment.id && comment.author.id === currentUserId && (
                <div className="mt-1 flex gap-3">
                  <button
                    onClick={() => startEdit(comment.id, comment.body)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-xs text-gray-400 hover:text-red-600"
                  >
                    删除
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New comment */}
      <div className="mt-4 flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
          你
        </div>
        <div className="min-w-0 flex-1">
          <MarkdownEditor
            value={newBody}
            onChange={setNewBody}
            onSubmit={handleSubmit}
            placeholder="写下你的评论... 支持 Markdown，输入 @ 可提及成员"
            minHeight="80px"
            requirementId={requirementId}
            mentions
          />
          <div className="mt-2 flex items-center justify-between">
            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : (
              <p className="text-xs text-gray-400">Ctrl+Enter 发表评论</p>
            )}
            <button
              onClick={handleSubmit}
              disabled={loading || !newBody.trim()}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '发表中...' : '评论'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
