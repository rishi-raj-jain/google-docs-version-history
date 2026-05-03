import { getProductionSql } from '@/lib/db'
import { getDefaultBranchId, restoreBranchToSource } from '@/lib/neon-console'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const idSchema = z.string().uuid()

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid version id' }, { status: 400 })
  const projectId = process.env.NEON_PROJECT_ID
  if (!projectId) return NextResponse.json({ error: 'NEON_PROJECT_ID is not configured' }, { status: 500 })
  try {
    const sql = getProductionSql()
    const rows = (await sql.query(`SELECT neon_branch_id FROM document_versions WHERE id = $1`, [parsed.data])) as { neon_branch_id: string }[]
    const row = rows[0]
    if (!row) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    const targetBranchId = process.env.NEON_MAIN_BRANCH_ID ?? (await getDefaultBranchId(projectId))
    const preserve = process.env.NEON_RESTORE_PRESERVE_PREFIX ?? 'pre-restore'
    const preserveUnderName = `${preserve}-${Date.now()}`
    await restoreBranchToSource({
      projectId,
      targetBranchId,
      sourceBranchId: row.neon_branch_id,
      preserveUnderName,
    })
    return NextResponse.json({
      ok: true,
      restoredFromBranchId: row.neon_branch_id,
      targetBranchId,
      preservedPreviousHeadAs: preserveUnderName,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Restore failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
