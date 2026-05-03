import { getProductionSql } from '@/lib/db'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** Drops every table in `public` on the DATABASE_URL branch (main / production), then reapplies scripts/create-versions-table.sql. */
const DROP_ALL_PUBLIC_TABLES = `
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;
`

export async function POST() {
  try {
    const sql = getProductionSql()
    await sql.query(DROP_ALL_PUBLIC_TABLES)
    await sql.query(`
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT,
  document_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  neon_branch_id TEXT NOT NULL,
  encoded_connection_string TEXT NOT NULL,
  author_label TEXT NOT NULL DEFAULT 'You'
);`)
    await sql.query(`
CREATE INDEX IF NOT EXISTS document_versions_created_at_idx
ON document_versions (created_at DESC);`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Reset failed'
    console.error(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
