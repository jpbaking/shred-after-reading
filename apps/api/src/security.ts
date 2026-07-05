import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto'

const PASSWORD_HASH_PREFIX = 'scrypt'
const PASSWORD_SALT_BYTES = 16
const PASSWORD_KEY_BYTES = 64

function toBuffer(value: string): Buffer {
  return Buffer.from(value, 'hex')
}

function timingSafeHexEqual(leftHex: string, rightHex: string): boolean {
  const left = toBuffer(leftHex)
  const right = toBuffer(rightHex)

  if (left.length !== right.length) {
    const paddedRight = Buffer.alloc(left.length)
    timingSafeEqual(left, paddedRight)
    return false
  }

  return timingSafeEqual(left, right)
}

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex')
  const hash = scryptSync(password, salt, PASSWORD_KEY_BYTES).toString('hex')
  return `${PASSWORD_HASH_PREFIX}:${salt}:${hash}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [prefix, salt, hash] = storedHash.split(':')

  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !hash) {
    return false
  }

  const candidate = scryptSync(password, salt, PASSWORD_KEY_BYTES).toString('hex')
  return timingSafeHexEqual(candidate, hash)
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function verifyTokenHash(token: string, storedHash: string): boolean {
  return timingSafeHexEqual(hashToken(token), storedHash)
}
