import { describe, expect, it } from 'vitest'
import { generateOpaqueToken, hashPassword, hashToken, verifyPassword, verifyTokenHash } from './security.js'

describe('security utilities', () => {
  it('hashes and verifies account passwords', () => {
    const passwordHash = hashPassword('correct horse battery staple')

    expect(passwordHash).toMatch(/^scrypt:[0-9a-f]+:[0-9a-f]+$/)
    expect(verifyPassword('correct horse battery staple', passwordHash)).toBe(true)
    expect(verifyPassword('wrong password', passwordHash)).toBe(false)
  })

  it('uses unique password salts for the same password', () => {
    const firstHash = hashPassword('same password')
    const secondHash = hashPassword('same password')

    expect(firstHash).not.toBe(secondHash)
    expect(verifyPassword('same password', firstHash)).toBe(true)
    expect(verifyPassword('same password', secondHash)).toBe(true)
  })

  it('hashes and verifies SAR passwords with the same password utility', () => {
    const sarPasswordHash = hashPassword('sar viewer password')

    expect(verifyPassword('sar viewer password', sarPasswordHash)).toBe(true)
    expect(verifyPassword('different SAR password', sarPasswordHash)).toBe(false)
  })

  it('generates opaque random tokens', () => {
    const firstToken = generateOpaqueToken()
    const secondToken = generateOpaqueToken()

    expect(firstToken).not.toBe(secondToken)
    expect(firstToken.length).toBeGreaterThan(20)
  })

  it('hashes and verifies opaque tokens', () => {
    const token = generateOpaqueToken()
    const tokenHash = hashToken(token)

    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(verifyTokenHash(token, tokenHash)).toBe(true)
    expect(verifyTokenHash(generateOpaqueToken(), tokenHash)).toBe(false)
  })
})
