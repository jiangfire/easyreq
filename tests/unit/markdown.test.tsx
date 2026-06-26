import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

function renderMarkdown(markdown: string): string {
  return renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSanitize] },
      markdown,
    ),
  )
}

describe('Markdown rendering (XSS safety)', () => {
  it('renders basic markdown correctly', () => {
    const html = renderMarkdown('# Hello World')
    expect(html).toContain('Hello World')
    expect(html).toMatch(/<h1>/)
  })

  it('renders bold text', () => {
    const html = renderMarkdown('This is **bold** text')
    expect(html).toContain('<strong>bold</strong>')
  })

  it('renders code blocks', () => {
    const html = renderMarkdown('```\ncode here\n```')
    expect(html).toContain('<pre>')
    expect(html).toContain('<code>')
  })

  it('renders links', () => {
    const html = renderMarkdown('[example](https://example.com)')
    expect(html).toContain('href="https://example.com"')
  })

  it('renders GFM tables', () => {
    const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<td>1</td>')
  })

  it('strips raw HTML script tags (XSS protection)', () => {
    const html = renderMarkdown('<script>alert("xss")</script>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert')
  })

  it('strips raw HTML img onerror (XSS protection)', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('alert')
  })

  it('strips javascript: URLs in links (XSS protection)', () => {
    const html = renderMarkdown('[click](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
  })
})
