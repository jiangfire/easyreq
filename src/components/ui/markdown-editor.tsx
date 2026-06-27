'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

type Mode = 'write' | 'preview' | 'split'

type Member = {
  id: string
  name: string
  email: string
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = '描述你的需求... 支持 Markdown',
  minHeight = '120px',
  onSubmit,
  requirementId,
  mentions = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  onSubmit?: () => void
  requirementId?: string
  mentions?: boolean
}) {
  const [mode, setMode] = useState<Mode>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [uploading, setUploading] = useState(false)

  const [preview, setPreview] = useState(value)
  const [dragOver, setDragOver] = useState(false)

  // Mention state
  const [members, setMembers] = useState<Member[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionPos, setMentionPos] = useState({ left: 0, top: 0 })
  const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null)

  // Debounced preview update (300ms) to avoid jank on large documents
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setPreview(value), 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [value])

  // Load members once when mentions are enabled
  useEffect(() => {
    if (!mentions || !requirementId) return
    let cancelled = false
    fetch(`/api/requirements/${requirementId}/members`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Member[]) => {
        if (!cancelled) setMembers(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [mentions, requirementId])

  const filteredMembers = useMemo(() => {
    const q = mentionQuery.toLowerCase()
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    )
  }, [members, mentionQuery])

  const closeMention = useCallback(() => {
    setMentionOpen(false)
    setMentionQuery('')
    setMentionIndex(0)
    setMentionRange(null)
  }, [])

  const updateMentionState = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea || !mentions) return

    const cursor = textarea.selectionStart
    const textBeforeCursor = value.slice(0, cursor)
    const match = /(?:^|\s)@([\w\u4e00-\u9fa5]*)$/.exec(textBeforeCursor)

    if (!match) {
      if (mentionOpen) closeMention()
      return
    }

    const query = match[1]
    const start = cursor - query.length - 1 // position of '@'
    setMentionOpen(true)
    setMentionQuery(query)
    setMentionIndex(0)
    setMentionRange({ start, end: cursor })

    // Calculate dropdown position using mirror
    const mirror = mirrorRef.current
    if (mirror) {
      const text = value.slice(0, start + 1)
      mirror.textContent = text.replace(/\n$/, '\n\u200b') + '\u200b'
      const rect = textarea.getBoundingClientRect()
      const mirrorRect = mirror.getBoundingClientRect()
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10) || 20
      setMentionPos({
        left: mirrorRect.width - rect.width + 12,
        top: mirrorRect.height - rect.height + lineHeight + 4,
      })
    }
  }, [value, mentions, mentionOpen, closeMention])

  const insertMention = useCallback(
    (member: Member) => {
      const textarea = textareaRef.current
      if (!textarea || !mentionRange) return

      const before = value.slice(0, mentionRange.start)
      const after = value.slice(mentionRange.end)
      // Plain-text @name mention: there is no user profile route, so a link
      // would 404. A bolded @name is still visible/clear without being dead.
      const mention = `**@${member.name}**`
      const newValue = before + mention + ' ' + after
      onChange(newValue)
      closeMention()

      requestAnimationFrame(() => {
        textarea.focus()
        const pos = mentionRange.start + mention.length + 1
        textarea.setSelectionRange(pos, pos)
      })
    },
    [value, onChange, mentionRange, closeMention],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen && filteredMembers.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setMentionIndex((i) => (i + 1) % filteredMembers.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setMentionIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length)
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          insertMention(filteredMembers[mentionIndex])
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          closeMention()
          return
        }
      }

      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        onSubmit?.()
        return
      }
      // Tab to insert spaces
      if (e.key === 'Tab') {
        e.preventDefault()
        const start = e.currentTarget.selectionStart
        const end = e.currentTarget.selectionEnd
        const newValue = value.substring(0, start) + '  ' + value.substring(end)
        onChange(newValue)
        requestAnimationFrame(() => {
          e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2
        })
      }
    },
    [mentionOpen, filteredMembers, mentionIndex, insertMention, closeMention, onSubmit, value, onChange],
  )

  const insertText = useCallback(
    (before: string, after = '', placeholder = '') => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selected = value.substring(start, end) || placeholder
      const newValue = value.substring(0, start) + before + selected + after + value.substring(end)
      onChange(newValue)

      requestAnimationFrame(() => {
        textarea.focus()
        const cursorPos = start + before.length + selected.length + after.length
        textarea.setSelectionRange(start + before.length, cursorPos - after.length)
      })
    },
    [value, onChange],
  )

  const handleFileChange = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0]
      if (!file || !requirementId) return

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/api/requirements/${requirementId}/attachments`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: { message: '上传失败' } }))
          alert(data.error?.message || '上传失败')
          return
        }

        const attachment = await res.json()
        const isImage = attachment.mimeType.startsWith('image/')
        const markdown = isImage
          ? `![${attachment.fileName}](${attachment.url})`
          : `[${attachment.fileName}](${attachment.url})`

        insertText('\n' + markdown + '\n', '', '')
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [requirementId, insertText],
  )

  return (
    <div className="overflow-hidden rounded-md border border-gray-300">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-2 py-1">
        <div className="flex items-center gap-0.5">
          <ToolbarButton onClick={() => insertText('**', '**', '加粗')} title="加粗">
            <strong className="text-xs">B</strong>
          </ToolbarButton>
          <ToolbarButton onClick={() => insertText('*', '*', '斜体')} title="斜体">
            <em className="text-xs">I</em>
          </ToolbarButton>
          <ToolbarButton onClick={() => insertText('`', '`', 'code')} title="行内代码">
            <code className="text-xs">{'<>'}</code>
          </ToolbarButton>
          <ToolbarButton onClick={() => insertText('\n```\n', '\n```\n', '代码块')} title="代码块">
            <span className="text-xs">{'{ }'}</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => insertText('[', '](https://)', '链接文字')} title="链接">
            <span className="text-xs">🔗</span>
          </ToolbarButton>
          {mentions && (
            <ToolbarButton onClick={() => insertText('@', '', '')} title="@提及">
              <span className="text-xs">@</span>
            </ToolbarButton>
          )}
          {requirementId && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files)}
                disabled={uploading}
              />
              <ToolbarButton
                onClick={() => fileInputRef.current?.click()}
                title="上传附件"
              >
                <span className="text-xs">{uploading ? '...' : '📎'}</span>
              </ToolbarButton>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <ModeButton active={mode === 'write'} onClick={() => setMode('write')}>
            编辑
          </ModeButton>
          <ModeButton active={mode === 'split'} onClick={() => setMode('split')}>
            分屏
          </ModeButton>
          <ModeButton active={mode === 'preview'} onClick={() => setMode('preview')}>
            预览
          </ModeButton>
        </div>
      </div>

      {/* Editor area */}
      <div
        className={`relative flex ${mode === 'split' ? 'flex-row' : 'flex-col'}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (requirementId) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void handleFileChange(e.dataTransfer.files)
        }}
      >
        {dragOver && requirementId && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-blue-50/90 text-sm text-blue-700">
            松开以上传附件
          </div>
        )}
        {mode !== 'preview' && (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                onChange(e.target.value)
                requestAnimationFrame(updateMentionState)
              }}
              onKeyDown={handleKeyDown}
              onClick={updateMentionState}
              onKeyUp={updateMentionState}
              placeholder={placeholder}
              className="w-full resize-y border-0 p-3 text-sm outline-none focus:ring-0"
              style={{ minHeight }}
            />
            {/* Hidden mirror for cursor position */}
            <div
              ref={mirrorRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 whitespace-pre-wrap break-words p-3 text-sm opacity-0"
              style={{ minHeight }}
            >
            </div>
            {mentionOpen && filteredMembers.length > 0 && (
              <div
                className="absolute z-20 w-48 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
                style={{ left: mentionPos.left, top: mentionPos.top }}
              >
                {filteredMembers.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => insertMention(m)}
                    className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                      i === mentionIndex ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="font-medium text-gray-900">{m.name}</span>
                    <span className="text-xs text-gray-500">{m.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {mode !== 'write' && (
          <div
            className={`overflow-auto border-gray-200 p-3 text-sm ${mode === 'split' ? 'border-l' : 'border-t'}`}
            style={{ minHeight }}
          >
            {preview ? (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                  {preview}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-gray-400">暂无内容</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolbarButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded px-2 py-1 text-gray-600 hover:bg-gray-200"
    >
      {children}
    </button>
  )
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs font-medium ${
        active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  )
}
