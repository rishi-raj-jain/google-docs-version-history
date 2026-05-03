import * as v from 'valibot'

/** Route param `id` for `/api/versions/[id]` — must be a UUID string. */
export const versionIdSchema = v.pipe(v.string(), v.uuid())
