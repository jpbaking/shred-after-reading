import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface SarContentProps {
  content: string
  isMarkdown: boolean
}

/**
 * Only allow link/image URLs with safe protocols. react-markdown's default
 * transform already rejects `javascript:` and friends; this narrows further
 * to an explicit allow-list per PROJECT-DECISIONS (`script_policy`).
 */
export function safeUrlTransform(url: string): string {
  const sanitized = defaultUrlTransform(url)
  if (/^(https?:|mailto:|#|\/)/i.test(sanitized) || sanitized === '') {
    return sanitized
  }
  // Relative URLs without a protocol are fine; anything else is dropped.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(sanitized)) {
    return sanitized
  }
  return ''
}

/**
 * The single safety path for SAR display and preview.
 *
 * - Plain text renders as text inside <pre>: never parsed as HTML.
 * - Markdown renders through react-markdown, which builds React elements
 *   directly (no innerHTML) and never executes raw HTML because
 *   `markdown_raw_html` is disabled — raw HTML stays literal text.
 */
export function SarContent({ content, isMarkdown }: SarContentProps) {
  if (!isMarkdown) {
    return (
      <pre className="sar-plain" data-testid="sar-plain" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {content}
      </pre>
    )
  }

  return (
    <div className="prose" data-testid="sar-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={safeUrlTransform}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
