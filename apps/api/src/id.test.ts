import { describe, it, expect } from 'vitest'
import { generateSARId, isValidSARId, sortSARIds } from './id.js'

describe('ID Helper', () => {
  it('should generate a valid UUIDv7', () => {
    const id = generateSARId()
    expect(isValidSARId(id)).toBe(true)
  })

  it('should generate unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const id = generateSARId()
      expect(ids.has(id)).toBe(false)
      ids.add(id)
    }
  })

  it('should sort IDs by creation time', () => {
    const ids = [generateSARId(), generateSARId(), generateSARId()]
    const sorted = sortSARIds(ids)
    expect(sorted).toEqual([...ids].sort())
  })

  it('should return false for invalid IDs', () => {
    expect(isValidSARId('')).toBe(false)
    expect(isValidSARId('not-a-uuid')).toBe(false)
    // UUIDv7 validation may accept some edge cases; test with clearly invalid values
    expect(isValidSARId('invalid')).toBe(false)
  })
})
