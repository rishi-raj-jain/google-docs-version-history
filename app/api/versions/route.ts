import { getProductionSql } from '@/lib/db'
import { encodeConnectionString } from '@/lib/encode-connection'
import { createBranchWithEndpoint, getDefaultBranchId } from '@/lib/neon-console'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const saveBodySchema = z.object({
  documentJson: z.unknown(),
  title: z.string().max(500).optional(),
  authorLabel: z.string().max(200).optional(),
})

export async function GET() {
  try {
    const sql = getProductionSql()
    const rows = await sql`
      SELECT id, created_at, title, neon_branch_id, author_label
      FROM document_versions
      ORDER BY created_at DESC
      LIMIT 100
    `
    return NextResponse.json({ versions: rows })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to list versions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let body: z.infer<typeof saveBodySchema>
  try {
    body = saveBodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const projectId = process.env.NEON_PROJECT_ID
  if (!projectId) return NextResponse.json({ error: 'NEON_PROJECT_ID is not configured' }, { status: 500 })
  try {
    const parentBranchId = process.env.NEON_PARENT_BRANCH_ID ?? (await getDefaultBranchId(projectId))
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const branchName = `doc-save-${stamp}`
    const { branchId, connectionUri } = await createBranchWithEndpoint(projectId, parentBranchId, branchName)
    const encoded = encodeConnectionString(connectionUri)
    const sql = getProductionSql()
    const author = body.authorLabel ?? process.env.VERSION_AUTHOR_LABEL ?? 'You'
    const docJson = JSON.stringify(body.documentJson ?? {})
    const inserted = (await sql.query(
      `INSERT INTO document_versions (
        title,
        document_json,
        neon_branch_id,
        encoded_connection_string,
        author_label
      )
      VALUES ($1, $2::jsonb, $3, $4, $5)
      RETURNING id, created_at, title, document_json, neon_branch_id, author_label`,
      [body.title ?? null, docJson, branchId, encoded, author],
    )) as {
      id: string
      created_at: string
      title: string | null
      document_json: unknown
      neon_branch_id: string
      author_label: string
    }[]
    const row = inserted[0]
    if (!row) return NextResponse.json({ error: 'Insert did not return a row' }, { status: 500 })
    return NextResponse.json({
      version: row,
      neon: { branchId },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Save failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
