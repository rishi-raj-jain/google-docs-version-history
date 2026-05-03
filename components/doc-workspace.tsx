'use client'

import { DocumentDiff } from '@/components/document-diff'
import { ChevronDown, Loader2, RotateCcw, Save, X } from 'lucide-react'
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

export function DocWorkspace() {
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [docKey, setDocKey] = useState('draft')
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
      const loaded = data.version?.document_json.text
      setSelectedId(id)
      setDocKey(id)
      setText(loaded)
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

  const handleSaveVersion = async () => {
    setSaveLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentJson: { text },
          title: `Save ${new Date().toLocaleString()}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      await refreshVersions()
      if (data.version?.id) {
        setSelectedId(data.version.id as string)
        setDocKey(data.version.id as string)
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
      const res = await fetch('/api/reset-database', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Reset failed')
      initialLatestLoadedRef.current = false
      setText('')
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
      refreshVersions().then(() => {
        loadVersionIntoEditor(versions[0].id)
      })
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

  return (
    <div className="flex h-screen min-h-0 flex-col bg-[#f8f9fa] text-zinc-900">
      <header className="flex shrink-0 flex-col border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-800">
              {selectedSummary ? (selectedSummary.title ?? formatWhen(selectedSummary.created_at)) : 'Untitled document'}
            </p>
            <p className="text-xs text-zinc-500">
              {selectedSummary ? `${formatWhen(selectedSummary.created_at)} · ${selectedSummary.author_label}` : 'Draft — changes are local until you save'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveVersion()}
            disabled={saveLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            {saveLoading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save version
          </button>
        </div>
        <div className="flex items-center gap-4 border-t border-zinc-100 bg-zinc-50 px-4 py-1.5 text-zinc-600">
          <span className="text-xs text-zinc-500">
            Total: {versions.length} {versions.length === 1 ? 'version' : 'versions'}
          </span>
        </div>
      </header>

      {error ? <div className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}

      <div className="flex min-h-0 flex-1">
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8">
          {preview && !previewLoading ? (
            <DocumentDiff baselineLabel="Saved text (preview)" currentLabel="Current editor" baselineText={preview.preview.tables[0].name} currentText={text} />
          ) : null}
          <textarea
            key={docKey}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck
            placeholder="Start typing…"
            className="font-default box-border min-h-[calc(100vh-14rem)] w-full max-w-[816px] resize-y rounded-sm border border-zinc-200/90 bg-white px-10 py-14 font-sans text-base leading-relaxed text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:border-zinc-300 focus:ring-2 sm:px-14"
          />
        </main>

        <aside className="flex w-[320px] shrink-0 flex-col border-l border-zinc-200 bg-[#f0f1f3]">
          <div className="border-b border-zinc-200/80 bg-white px-4 py-3">
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
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
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
                            DB preview
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
                            Restore to main
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
            <div className="max-h-48 overflow-y-auto border-t border-zinc-200 bg-white px-4 py-3 text-xs">
              <p className="font-semibold text-zinc-800">Branch preview</p>
              {previewLoading ? (
                <p className="mt-2 text-zinc-500">Loading preview…</p>
              ) : preview ? (
                <div className="mt-2 space-y-1 text-zinc-600">
                  <p className="break-all text-[11px] text-zinc-500">Neon branch: {preview.neon_branch_id}</p>
                  <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                    {preview.preview.tables.map((t) => (
                      <li key={t.name} className="flex justify-between gap-2">
                        {t.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
