import { getProductionSql } from '@/lib/db'
import { versionIdSchema } from '@/lib/version-id'
import * as v from 'valibot'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const parsed = v.safeParse(versionIdSchema, id)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid version id' }, { status: 400 })
  try {
    const sql = getProductionSql()
    const rows = (await sql.query(
      `SELECT id, created_at, title, document_json, neon_branch_id, author_label
       FROM document_versions WHERE id = $1`,
      [parsed.output],
    )) as {
      id: string
      created_at: string
      title: string | null
      document_json: unknown
      neon_branch_id: string
      author_label: string
    }[]
    const row = rows[0]
    if (!row) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    return NextResponse.json({ version: row })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load version'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
