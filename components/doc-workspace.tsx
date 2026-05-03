'use client'

import { DocumentDiff, TitleDiffStrip } from '@/components/document-diff'
import { diffLines } from '@/lib/line-diff'
import { FileText, Loader2, RotateCcw, Save, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type VersionSummary = {
  id: string
  created_at: string
  title: string | null
  neon_branch_id: string
  author_label: string
}

type PreviewPayload = {
  neon_branch_id: string
  preview: {
    tables: { name: string }[]
  }
}

const DEFAULT_TITLE = 'Untitled document'

function displayTitleFromVersion(stored: string | null | undefined) {
  const t = stored?.trim()
  return t ? t : DEFAULT_TITLE
}

export function DocWorkspace() {
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [docKey, setDocKey] = useState('draft')
  const [title, setTitle] = useState(DEFAULT_TITLE)
  const [text, setText] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewPayload | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlightChanges, setHighlightChanges] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  /** Ensures we load the newest saved version into the textarea only once on first list fetch. */
  const initialLatestLoadedRef = useRef(false)

  const refreshVersions = useCallback(async () => {
    setLoadingList(true)
    setError(null)
    try {
      const res = await fetch('/api/versions')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load versions')
      setVersions(data.versions ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load versions')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void refreshVersions()
    })
    return () => cancelAnimationFrame(id)
  }, [refreshVersions])

  const loadVersionIntoEditor = useCallback(async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/versions/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load version')
      const row = data.version as {
        title: string | null
        document_json: { text?: string } | null
      }
      const loaded = row?.document_json?.text
      setSelectedId(id)
      setDocKey(id)
      setTitle(displayTitleFromVersion(row?.title ?? null))
      setText(typeof loaded === 'string' ? loaded : '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load version')
    }
  }, [])

  useEffect(() => {
    if (loadingList) return
    if (initialLatestLoadedRef.current) return
    initialLatestLoadedRef.current = true
    const latest = versions[0]
    if (!latest) return
    const frame = requestAnimationFrame(() => {
      void loadVersionIntoEditor(latest.id)
    })
    return () => cancelAnimationFrame(frame)
  }, [loadingList, versions, loadVersionIntoEditor])

  const selectedSummary = useMemo(() => versions.find((v) => v.id === selectedId) ?? null, [versions, selectedId])

  const showPreviewTitleDiff = Boolean(preview && !previewLoading && selectedSummary)
  const previewTitleBaseline = selectedSummary ? displayTitleFromVersion(selectedSummary.title ?? null) : DEFAULT_TITLE
  const previewTitleCurrent = displayTitleFromVersion(title.trim() || null)

  const previewTitleHasDiff = useMemo(() => {
    const parts = diffLines(previewTitleBaseline, previewTitleCurrent)
    return parts.some((p) => Boolean(p.added || p.removed))
  }, [previewTitleBaseline, previewTitleCurrent])

  const showPreviewTitleDiffStrip = showPreviewTitleDiff && previewTitleHasDiff

  const showPreviewDocumentDiff = useMemo(() => {
    if (!preview || previewLoading) return false
    const baseline = preview.preview.tables[0]?.name ?? ''
    const parts = diffLines(baseline, text)
    return parts.some((p) => Boolean(p.added || p.removed))
  }, [preview, previewLoading, text])

  const handleSaveVersion = async () => {
    setSaveLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentJson: { text },
          title: title.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      await refreshVersions()
      if (data.version?.id) {
        setSelectedId(data.version.id as string)
        setDocKey(data.version.id as string)
        setTitle(displayTitleFromVersion(data.version.title ?? null))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaveLoading(false)
    }
  }

  const handlePreview = async (id: string) => {
    setPreviewLoading(true)
    setPreview(null)
    setError(null)
    try {
      const res = await fetch(`/api/versions/${id}/preview`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Preview failed')
      setPreview(data as PreviewPayload)
      setSelectedId(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleResetDatabase = async () => {
    setResetLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reset', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Reset failed')
      initialLatestLoadedRef.current = false
      setText('')
      setTitle(DEFAULT_TITLE)
      setSelectedId(null)
      setDocKey('draft')
      setPreview(null)
      await refreshVersions()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setResetLoading(false)
    }
  }

  const handleRestore = async (id: string) => {
    setRestoreLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/versions/${id}/restore`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Restore failed')
      refreshVersions().then(() => window.location.reload())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setRestoreLoading(false)
    }
  }

  const formatWhen = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const exitPreview = useCallback(() => {
    setPreview(null)
  }, [])

  return (
    <div className="flex h-dvh min-h-0 max-h-dvh flex-col overflow-hidden bg-[#f8f9fa] text-zinc-900">
      <header className="flex shrink-0 flex-col border-b border-zinc-200 bg-white">
        <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
          <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
            <FileText className="mt-1 size-5 shrink-0 text-zinc-400" aria-hidden />
            <div className="min-w-0 flex-1">
              {showPreviewTitleDiffStrip ? (
                <div className="mb-1 rounded-md border border-zinc-200 bg-zinc-50/80 px-2 py-1.5">
                  <p className="text-[11px] font-medium text-zinc-600">
                    Title diff · <span className="text-zinc-500">Saved version</span>
                    {' → '}
                    <span className="text-zinc-500">Current editor</span>
                  </p>
                  <TitleDiffStrip baselineText={previewTitleBaseline} currentText={previewTitleCurrent} />
                </div>
              ) : null}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={500}
                placeholder={DEFAULT_TITLE}
                aria-label="Document title"
                className={`w-full min-w-0 border-0 border-b border-transparent bg-transparent py-0.5 text-sm font-medium text-zinc-800 outline-none transition-[border-color] placeholder:text-zinc-400 focus:border-zinc-300 ${showPreviewTitleDiffStrip ? 'mt-0.5' : ''}`}
              />
              <p className="break-words text-xs text-zinc-500">
                {selectedSummary ? `${formatWhen(selectedSummary.created_at)} · ${selectedSummary.author_label}` : 'Draft — changes are local until you save'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveVersion()}
            disabled={saveLoading}
            className="inline-flex shrink-0 touch-manipulation items-center justify-center gap-2 self-stretch rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 sm:self-auto sm:py-2"
          >
            {saveLoading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 shrink-0" />}
            <span className="sm:hidden">Save</span>
            <span className="hidden sm:inline">Save version</span>
          </button>
        </div>
        <div className="flex items-center gap-4 border-t border-zinc-100 bg-zinc-50 px-3 py-1.5 text-zinc-600 sm:px-4">
          <span className="text-xs text-zinc-500">
            Total: {versions.length} {versions.length === 1 ? 'version' : 'versions'}
          </span>
        </div>
      </header>
      {error ? <div className="mx-3 mt-2 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:mx-4">{error}</div> : null}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 lg:order-1 lg:px-6 lg:py-8">
          {showPreviewDocumentDiff ? (
            <div className="mx-auto w-full max-w-[816px]">
              <DocumentDiff
                onClose={exitPreview}
                baselineLabel="Current editor"
                currentLabel="Saved text (preview)"
                baselineText={text}
                currentText={preview?.preview.tables[0]?.name ?? ''}
              />
            </div>
          ) : preview && !previewLoading ? (
            <div className="mx-auto mb-3 flex w-full max-w-[816px] justify-end sm:mb-4">
              <button
                type="button"
                onClick={exitPreview}
                className="inline-flex touch-manipulation items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
              >
                <X className="size-3.5 shrink-0" aria-hidden />
                Exit diff
              </button>
            </div>
          ) : null}
          <textarea
            key={docKey}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck
            placeholder="Start typing…"
            className="font-default mx-auto box-border min-h-[min(420px,calc(100dvh-11rem))] w-full max-w-[816px] resize-y rounded-sm border border-zinc-200/90 bg-white px-4 py-8 font-sans text-base leading-relaxed text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:border-zinc-300 focus:ring-2 sm:min-h-[calc(100dvh-13rem)] sm:px-8 sm:py-12 md:px-10 lg:min-h-[calc(100dvh-14rem)] lg:px-14 lg:py-14"
          />
        </main>

        <aside className="order-2 flex max-h-[min(46vh,420px)] min-h-0 w-full shrink-0 flex-col border-t border-zinc-200 bg-[#f0f1f3] lg:order-2 lg:max-h-none lg:h-auto lg:w-80 lg:max-w-[20rem] lg:shrink-0 lg:border-l lg:border-t-0">
          <div className="border-b border-zinc-200/80 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-800">Version history</h2>
              <button
                type="button"
                onClick={() => void handleResetDatabase()}
                disabled={resetLoading || loadingList}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                {resetLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                Reset all
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            {loadingList ? (
              <p className="text-center text-xs text-zinc-500">Loading…</p>
            ) : versions.length === 0 ? (
              <p className="rounded-lg bg-white px-3 py-4 text-center text-xs text-zinc-500 shadow-sm">
                No saves yet. Write in the editor and click <strong>Save version</strong> to create a Neon branch snapshot.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {versions.map((v) => {
                  const active = v.id === selectedId
                  return (
                    <li key={v.id}>
                      <div
                        className={`w-full rounded-lg border px-3 py-2.5 text-left text-xs shadow-sm transition ${
                          active ? 'border-white bg-white' : 'border-transparent bg-transparent hover:bg-white/70'
                        }`}
                      >
                        <div className="min-w-0 text-left">
                          <p className="font-medium text-zinc-900">{formatWhen(v.created_at)}</p>
                          <p className="mt-0.5 text-zinc-500">{v.author_label}</p>
                          {active ? <p className="mt-1 text-[11px] font-medium text-emerald-700">Selected in editor</p> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handlePreview(v.id)
                            }}
                            className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-200"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleRestore(v.id)
                            }}
                            disabled={restoreLoading}
                            className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-50"
                          >
                            Restore this version
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          {(previewLoading || preview) && (
            <div className="max-h-40 shrink-0 overflow-y-auto overscroll-contain border-t border-zinc-200 bg-white px-3 py-2.5 text-xs sm:max-h-48 sm:px-4 sm:py-3">
              <p className="font-semibold text-zinc-800">Branch preview</p>
              {previewLoading ? (
                <p className="mt-2 text-zinc-500">Loading preview…</p>
              ) : preview ? (
                <div className="mt-2 space-y-1 text-zinc-600">
                  <p className="break-all text-[11px] text-zinc-500">Neon branch: {preview.neon_branch_id}</p>
                </div>
              ) : null}
            </div>
          )}
          <div className="shrink-0 border-t border-zinc-200/90 bg-white/90 px-3 py-2.5 backdrop-blur-sm sm:px-4">
            <p className="text-center text-[10px] leading-snug text-zinc-500 sm:text-left">
              <span className="text-zinc-400">Powered by </span>
              <a
                href="https://neon.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#34D59A] underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-900 hover:decoration-zinc-500"
              >
                Neon
              </a>
              <span className="text-zinc-300" aria-hidden>
                {' · '}
              </span>
              <a
                href="https://nextjs.org"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-900 hover:decoration-zinc-500"
              >
                Next.js
              </a>
              <span className="text-zinc-300" aria-hidden>
                {' · '}
              </span>
              <a
                href="https://vercel.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-900 hover:decoration-zinc-500"
              >
                Vercel
              </a>
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
