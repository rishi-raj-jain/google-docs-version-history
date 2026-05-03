'use client'

import { diffLines } from '@/lib/line-diff'

/** Inline title diff for the header (same highlights as {@link DocumentDiff}). */
export function TitleDiffStrip({ baselineText, currentText }: { baselineText: string; currentText: string }) {
  const parts = diffLines(baselineText, currentText)
  const hasChange = parts.some((p) => Boolean(p.added || p.removed))
  return (
    <div className="min-h-[1.25rem] whitespace-pre-wrap break-words">
      {!hasChange ? (
        <span className="text-sm font-medium text-zinc-500">{currentText}</span>
      ) : (
        <span className="text-sm font-medium leading-snug text-zinc-900">
          {parts.map((part, i) => (
            <span key={i} className={part.added ? 'bg-emerald-100 text-emerald-950' : part.removed ? 'bg-rose-100 text-rose-950' : undefined}>
              {part.value.replace(/\n/g, '')}
            </span>
          ))}
        </span>
      )}
    </div>
  )
}

export function DocumentDiff({
  baselineLabel,
  currentLabel,
  baselineText,
  currentText,
}: {
  baselineLabel: string
  currentLabel: string
  baselineText: string
  currentText: string
}) {
  const parts = diffLines(baselineText, currentText)
  const hasChange = parts.some((p) => Boolean(p.added || p.removed))
  return (
    <div className="mb-4 w-full max-w-[816px] rounded-md border border-zinc-200 bg-white shadow-sm sm:mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2 sm:px-4">
        <p className="text-xs font-medium text-zinc-700">
          Text diff · <span className="text-zinc-500">{baselineLabel}</span>
          {' → '}
          <span className="text-zinc-500">{currentLabel}</span>
        </p>
      </div>
      <div className="max-h-[min(50vh,420px)] overflow-auto px-3 py-3 sm:px-4">
        {!hasChange ? (
          <p className="text-sm text-zinc-500">No differences — editor matches this version’s saved text.</p>
        ) : (
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-900">
            {parts.map((part, i) => (
              <span key={i} className={part.added ? 'bg-emerald-100 text-emerald-950' : part.removed ? 'bg-rose-100 text-rose-950' : undefined}>
                {part.value}
              </span>
            ))}
          </pre>
        )}
      </div>
    </div>
  )
}
