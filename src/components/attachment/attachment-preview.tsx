'use client'

import { useEffect, useState } from 'react'

/**
 * Click-to-preview dialog for attachments.
 *
 *  - Images: shown full-size, fit-to-screen, dark backdrop.
 *  - PDFs: rendered in an `<iframe>` so Chrome's built-in PDF viewer
 *    shows them inline (no extra dependency).
 *  - Other types: "no inline preview" notice with a download link.
 *
 * The trigger button is the attachment card itself — the whole card is
 * clickable. The dialog closes on backdrop click, Escape, or close button.
 */
export function AttachmentPreview({
  url,
  fileName,
  mimeType,
  size,
}: {
  url: string
  fileName: string
  mimeType: string
  size: number
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
  const canPreview = isImage || isPdf

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex max-w-[200px] flex-col overflow-hidden rounded-md border border-gray-200 bg-white text-left hover:border-blue-300"
        title={canPreview ? '点击预览' : '点击下载'}
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={fileName}
            className="h-24 w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-24 w-full items-center justify-center bg-gray-100">
            <span className="text-2xl">{iconFor(mimeType, fileName)}</span>
          </div>
        )}
        <div className="truncate px-2 py-1.5 text-xs text-gray-700">{fileName}</div>
        <div className="px-2 pb-1.5 text-[10px] text-gray-400">{formatSize(size)}</div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={fileName}
        >
          <div
            className="relative flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
              <div className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">
                {fileName}
                <span className="ml-2 text-xs text-gray-400">({formatSize(size)})</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={url}
                  download={fileName}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  下载
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                  aria-label="关闭"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-100">
              {canPreview ? (
                isImage ? (
                  <div className="flex h-full items-center justify-center p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={fileName}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <iframe
                    src={url}
                    title={fileName}
                    className="h-full w-full"
                  />
                )
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <span className="text-5xl">{iconFor(mimeType, fileName)}</span>
                  <p className="text-gray-600">该文件类型不支持在线预览</p>
                  <a
                    href={url}
                    download={fileName}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    下载文件
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function iconFor(mimeType: string, fileName: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) return '📕'
  if (mimeType.includes('zip') || fileName.toLowerCase().endsWith('.zip')) return '🗜️'
  if (mimeType.startsWith('text/')) return '📄'
  return '📄'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}