import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const PREFIX_V1 = 'v1:'
const PREFIX_AES = 'aes:'

function getKey(): Buffer | null {
  const secret = process.env.BRANCH_URI_SECRET
  if (!secret || secret.length < 16) return null
  return scryptSync(secret, 'neon-branch-uri', 32)
}

/**
 * Stores the branch connection URI in an encoded form (AES-256-GCM when
 * `BRANCH_URI_SECRET` is set; otherwise base64url for local dev only).
 */
export function encodeConnectionString(connectionUri: string): string {
  const key = getKey()
  if (!key) return PREFIX_V1 + Buffer.from(connectionUri, 'utf8').toString('base64url')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(connectionUri, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const enc = Buffer.concat([ciphertext, tag])
  return PREFIX_AES + iv.toString('base64url') + '.' + enc.toString('base64url')
}

export function decodeConnectionString(encoded: string): string {
  if (encoded.startsWith(PREFIX_AES)) {
    const key = getKey()
    if (!key) throw new Error('Cannot decode AES branch URI: set BRANCH_URI_SECRET to the same value used when encoding.')
    const raw = encoded.slice(PREFIX_AES.length)
    const [ivPart, dataPart] = raw.split('.')
    if (!ivPart || !dataPart) throw new Error('Invalid encoded connection string')
    const iv = Buffer.from(ivPart, 'base64url')
    const data = Buffer.from(dataPart, 'base64url')
    const tag = data.subarray(data.length - 16)
    const ciphertext = data.subarray(0, data.length - 16)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  }
  if (encoded.startsWith(PREFIX_V1)) return Buffer.from(encoded.slice(PREFIX_V1.length), 'base64url').toString('utf8')
  throw new Error('Unknown encoded connection string format')
}
