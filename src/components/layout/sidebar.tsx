'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

type ProjectItem = {
  id: string
  name: string
  slug: string
  _count: { requirements: number }
}

export function Sidebar({ projects }: { projects: ProjectItem[] }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-4 top-4 z-50 rounded-md bg-white p-2 shadow-sm ring-1 ring-gray-200 lg:hidden"
        aria-label="Toggle sidebar"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
        </svg>
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-gray-200 bg-white transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <nav className="flex h-full flex-col p-4">
          {/* Logo */}
          <Link href="/" className="mb-6 flex items-center gap-2 px-2" onClick={() => setMobileOpen(false)}>
            <span className="text-xl font-bold text-gray-900">easyreq</span>
          </Link>

          {/* Main nav */}
          <div className="space-y-1">
            <SidebarLink href="/projects" active={isActive('/projects')} onClick={() => setMobileOpen(false)}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              项目列表
            </SidebarLink>
            <SidebarLink href="/dashboard" active={isActive('/dashboard')} onClick={() => setMobileOpen(false)}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              我的看板
            </SidebarLink>
            <SidebarLink href="/notifications" active={isActive('/notifications')} onClick={() => setMobileOpen(false)}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              通知
            </SidebarLink>
          </div>

          {/* Projects */}
          <div className="mt-6 flex-1">
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              项目
            </h3>
            <div className="space-y-1">
              {projects.length === 0 ? (
                <p className="px-2 text-sm text-gray-400">暂无项目</p>
              ) : (
                projects.map((p) => (
                  <SidebarLink
                    key={p.id}
                    href={`/projects/${p.slug}`}
                    active={isActive(`/projects/${p.slug}`)}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-600">
                      {p.name.charAt(0)}
                    </span>
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-gray-400">{p._count.requirements}</span>
                  </SidebarLink>
                ))
              )}
            </div>
          </div>
        </nav>
      </aside>
    </>
  )
}

function SidebarLink({
  href,
  active,
  onClick,
  children,
}: {
  href: string
  active: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </Link>
  )
}
