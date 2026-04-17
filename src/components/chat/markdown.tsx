'use client'

import { useState, type HTMLAttributes } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  content: string
}

export function Markdown({ content }: Props) {
  return (
    <div className="prose prose-slate max-w-none text-[#1E293B] text-sm leading-relaxed prose-headings:font-semibold prose-headings:text-[#1E293B] prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeRenderer,
          pre: ({ children }) => <>{children}</>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3B82F6] hover:underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

type CodeRendererProps = HTMLAttributes<HTMLElement> & { inline?: boolean }

function CodeRenderer({ inline, className, children, ...rest }: CodeRendererProps) {
  const [copied, setCopied] = useState(false)
  const text = String(children ?? '').replace(/\n$/, '')
  const isInline = inline ?? !text.includes('\n')

  if (isInline) {
    return (
      <code
        className={cn(
          'rounded bg-slate-100 px-1.5 py-0.5 text-[0.85em] text-[#1E293B]',
          className
        )}
        {...rest}
      >
        {children}
      </code>
    )
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 text-slate-100">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs text-slate-200 opacity-0 transition group-hover:opacity-100 hover:bg-white/20"
        aria-label="코드 복사"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" /> 복사됨
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> 복사
          </>
        )}
      </button>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
        <code className={className} {...rest}>
          {text}
        </code>
      </pre>
    </div>
  )
}
