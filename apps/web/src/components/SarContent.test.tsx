import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SarContent } from './SarContent'

function renderSar(content: string, isMarkdown: boolean) {
  return render(<SarContent content={content} isMarkdown={isMarkdown} />)
}

describe('SarContent safety', () => {
  it('renders plain text literally, including HTML and script tags', () => {
    const { container, getByTestId } = renderSar(
      '<script>alert(1)</script><img src=x onerror=alert(1)>',
      false,
    )

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    // The dangerous string is visible as text, not parsed.
    expect(getByTestId('sar-plain').textContent).toContain('<script>alert(1)</script>')
  })

  it('never creates a script element from Markdown', () => {
    const { container } = renderSar('hello\n\n<script>alert(1)</script>\n\n**bold**', true)

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('bold')
  })

  it('drops raw HTML in Markdown (markdown_raw_html=disabled)', () => {
    const { container } = renderSar('before <b onmouseover="alert(1)">clickme</b> after', true)

    expect(container.querySelector('b')).toBeNull()
    const html = container.innerHTML
    expect(html).not.toContain('onmouseover')
  })

  it('blocks event-handler attributes via embedded HTML elements', () => {
    const { container } = renderSar('<img src=x onerror=alert(1)>\n\n<div onclick=alert(1)>x</div>', true)

    expect(container.querySelector('img')).toBeNull()
    expect(container.innerHTML).not.toContain('onerror')
    expect(container.innerHTML).not.toContain('onclick')
  })

  it('blocks javascript: URLs in Markdown links', () => {
    const { container } = renderSar('[click me](javascript:alert(1))', true)

    const link = container.querySelector('a')
    expect(link?.textContent).toBe('click me')
    expect(link?.getAttribute('href') ?? '').not.toContain('javascript')
  })

  it('blocks other dangerous URL schemes but keeps https and relative links', () => {
    const { container } = renderSar(
      '[ok](https://example.com) [rel](/sar/abc) [bad](vbscript:x) [data](data:text/html;base64,PHNjcmlwdD4=)',
      true,
    )

    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('https://example.com')
    expect(hrefs).toContain('/sar/abc')
    for (const href of hrefs) {
      expect(href ?? '').not.toMatch(/^(vbscript|data):/i)
    }
  })

  it('renders code fences with the payload as text', () => {
    const { container } = renderSar('```html\n<script>alert(1)</script>\n```', true)

    const code = container.querySelector('pre code')
    expect(code).not.toBeNull()
    expect(code?.textContent).toContain('<script>alert(1)</script>')
    expect(container.querySelector('script')).toBeNull()
  })

  it('renders GFM tables and normal links', () => {
    const { container } = renderSar(
      '| a | b |\n| - | - |\n| 1 | 2 |\n\n[site](https://example.org)',
      true,
    )

    expect(container.querySelector('table')).not.toBeNull()
    expect(container.querySelector('td')?.textContent).toBe('1')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.org')
  })

  it('preserves line breaks in plain text', () => {
    const { getByTestId } = renderSar('line one\nline two\n\nline four', false)
    expect(getByTestId('sar-plain').textContent).toBe('line one\nline two\n\nline four')
  })
})
