'use client'

import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { PRIORITY_OPTIONS } from '@/lib/requirement-form'
import type { Priority } from '@/hooks/use-requirement-draft'

/**
 * Shared form fields for creating a requirement.
 * Used by both the project-scoped full page form and the global quick-submit modal.
 */
export function RequirementFormFields({
  title,
  body,
  priority,
  expectedDate,
  acceptanceCriteria,
  showAdvanced,
  onTitleChange,
  onTitleErrorClear,
  onBodyChange,
  onPriorityChange,
  onExpectedDateChange,
  onAcceptanceCriteriaChange,
  onToggleAdvanced,
  titleError,
  loading,
}: {
  title: string
  body: string
  priority: Priority
  expectedDate: string
  acceptanceCriteria: string
  showAdvanced: boolean
  onTitleChange: (v: string) => void
  onTitleErrorClear: () => void
  onBodyChange: (v: string) => void
  onPriorityChange: (v: Priority) => void
  onExpectedDateChange: (v: string) => void
  onAcceptanceCriteriaChange: (v: string) => void
  onToggleAdvanced: () => void
  titleError: string | null
  loading: boolean
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          标题 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            onTitleChange(e.target.value)
            if (titleError) onTitleErrorClear()
          }}
          disabled={loading}
          placeholder="一句话描述你的需求..."
          maxLength={200}
          className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            titleError
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          }`}
        />
        {titleError && <p className="mt-1 text-xs text-red-600">{titleError}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          详细描述 <span className="text-xs text-gray-400">（支持 Markdown，可选）</span>
        </label>
        <MarkdownEditor
          value={body}
          onChange={onBodyChange}
          minHeight="160px"
        />
      </div>

      <button
        type="button"
        onClick={onToggleAdvanced}
        className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
      >
        <svg
          className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {showAdvanced ? '收起高级选项' : '展开高级选项'}
      </button>

      {showAdvanced && (
        <div className="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">优先级</label>
            <select
              value={priority}
              onChange={(e) => onPriorityChange(e.target.value as Priority)}
              disabled={loading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">期望交付日期</label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => onExpectedDateChange(e.target.value)}
              disabled={loading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">验收标准</label>
            <textarea
              value={acceptanceCriteria}
              onChange={(e) => onAcceptanceCriteriaChange(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder="怎样算完成了这个需求？"
              className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}
