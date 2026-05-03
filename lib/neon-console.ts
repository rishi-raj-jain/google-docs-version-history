const NEON_API = 'https://console.neon.tech/api/v2'

function neonHeaders(): HeadersInit {
  const key = process.env.NEON_API_KEY
  if (!key) throw new Error('NEON_API_KEY is not configured')
  return {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

async function neonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${NEON_API}${path}`, {
    ...init,
    headers: { ...neonHeaders(), ...init?.headers },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Neon API ${init?.method ?? 'GET'} ${path}: ${res.status} ${text.slice(0, 500)}`)
  }
  return text ? (JSON.parse(text) as T) : ({} as T)
}

export type NeonBranch = {
  id: string
  name: string
  default?: boolean
  primary?: boolean
}

export type CreateBranchResponse = {
  branch: { id: string; name: string; parent_id: string }
  endpoints?: Array<{ id: string; host: string; type: string }>
  connection_uris?: Array<{ connection_uri: string }>
}

export async function listBranches(projectId: string): Promise<NeonBranch[]> {
  const data = await neonFetch<{ branches: NeonBranch[] }>(`/projects/${projectId}/branches`)
  return data.branches ?? []
}

export async function getDefaultBranchId(projectId: string): Promise<string> {
  const branches = await listBranches(projectId)
  const def = branches.find((b) => b.default) ?? branches.find((b) => b.primary)
  if (def) return def.id
  if (branches[0]) return branches[0].id
  throw new Error('No branches found for Neon project')
}

export async function createBranchWithEndpoint(projectId: string, parentBranchId: string, name: string): Promise<{ branchId: string; connectionUri: string }> {
  const body = {
    branch: {
      name,
      parent_id: parentBranchId,
    },
    endpoints: [{ type: 'read_write', autoscaling_limit_min_cu: 1, autoscaling_limit_max_cu: 1 }],
  }

  const res = await neonFetch<CreateBranchResponse>(`/projects/${projectId}/branches`, { method: 'POST', body: JSON.stringify(body) })

  const uri = res.connection_uris?.[0]?.connection_uri
  if (!uri) {
    throw new Error('Neon did not return connection_uris on branch create; wait for compute or check API response.')
  }

  return { branchId: res.branch.id, connectionUri: uri }
}

export async function restoreBranchToSource(params: {
  projectId: string
  /** Branch that will be updated (usually production / main) */
  targetBranchId: string
  /** Branch whose head state we restore onto the target */
  sourceBranchId: string
  preserveUnderName?: string
}): Promise<void> {
  const body: Record<string, string> = {
    source_branch_id: params.sourceBranchId,
  }
  if (params.preserveUnderName) {
    body.preserve_under_name = params.preserveUnderName
  }

  await neonFetch<{ branch?: { id: string } }>(`/projects/${params.projectId}/branches/${params.targetBranchId}/restore`, { method: 'POST', body: JSON.stringify(body) })
}
