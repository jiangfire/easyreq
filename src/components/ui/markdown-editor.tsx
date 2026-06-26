'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

type Mode = 'write' | 'preview' | 'split'

export function MarkdownEditor({
  value,
  onChange,
  placeholder = '描述你的需求... 支持 Markdown',
  minHeight = '120px',
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  onSubmit?: () => void
}) {
  const [mode, setMode] = useState<Mode>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [preview, setPreview] = useState(value)

  // Debounced preview update (300ms) to avoid jank on large documents
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setPreview(value), 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    [value, onChange, onSubmit],
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
      <div className={`flex ${mode === 'split' ? 'flex-row' : 'flex-col'}`}>
        {mode !== 'preview' && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full resize-y border-0 p-3 text-sm outline-none focus:ring-0"
            style={{ minHeight }}
          />
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
