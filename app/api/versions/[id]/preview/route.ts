import { getProductionSql } from '@/lib/db'
import { decodeConnectionString } from '@/lib/encode-connection'
import { versionIdSchema } from '@/lib/version-id'
import { neon } from '@neondatabase/serverless'
import * as v from 'valibot'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const parsed = v.safeParse(versionIdSchema, id)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid version id' }, { status: 400 })
  try {
    const sqlMain = getProductionSql()
    const rows = (await sqlMain.query(
      `SELECT encoded_connection_string, neon_branch_id, document_json
       FROM document_versions WHERE id = $1`,
      [parsed.output],
    )) as {
      encoded_connection_string: string
      neon_branch_id: string
      document_json: unknown
    }[]
    const row = rows[0]
    if (!row) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    const connectionUri = decodeConnectionString(row.encoded_connection_string)
    const branchSql = neon(connectionUri)
    const stats = (await branchSql`
      SELECT document_json
      FROM document_versions
      ORDER BY created_at DESC
      LIMIT 1
    `) as { document_json: { text?: string } }[]
    const tables =
      stats.length > 0
        ? stats.map((s) => ({
            name: s.document_json.text,
          }))
        : [{ name: '' }]
    return NextResponse.json({
      neon_branch_id: row.neon_branch_id,
      preview: { tables },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ message: 'Could not preview this branch' }, { status: 500 })
  }
}
