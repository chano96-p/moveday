import { REGIONS } from './config'
import type { Region } from './types'

const REGION_SET = new Set<string>(REGIONS)

/**
 * 청약홈 공급지역명(축약형)을 17개 화이트리스트로 검증한다.
 * 화이트리스트를 벗어나면 `null`.
 */
export function normalizeRegion(value: unknown): Region | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return REGION_SET.has(trimmed) ? (trimmed as Region) : null
}
