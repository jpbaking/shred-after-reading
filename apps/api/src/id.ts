import { v7 } from 'uuid'

export function generateSARId(): string {
  return v7()
}

export function isValidSARId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export function sortSARIds(ids: string[]): string[] {
  return [...ids].sort()
}