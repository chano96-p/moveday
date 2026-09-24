'use client'

import { useScore } from '@/hooks/useScore'
import type { SupplyRow } from '@/lib/types'

// 주택형이 여럿이면 그중 최저 당첨가점(가장 낮은 값)을 비교 기준으로 쓴다 — "이 공고에
// 들어갈 수 있었는가"를 보는 데는 가장 낮은 문턱이 가장 관련 있는 숫자다.
function lowestWinnerScore(supply: SupplyRow[]): number | null {
  const scores = supply.map((row) => row.score?.lowest).filter((v): v is number => v !== null && v !== undefined)
  return scores.length > 0 ? Math.min(...scores) : null
}

// 내 가점이 저장돼 있지 않으면 배지를 렌더하지 않는다(§10) — 계산기로 유도하는 링크만 둔다.
export function ScoreBadge({ supply }: { supply: SupplyRow[] }) {
  const { result } = useScore()

  // 내 가점이 저장돼 있지 않으면 아무것도 렌더하지 않는다 — 상세 상단에 링크 한 줄만 떠
  // 있으면 섹션 제목처럼 읽힌다. 계산기 유도는 대시보드 배너가 맡는다.
  if (!result) return null

  const winnerLowest = lowestWinnerScore(supply)

  return (
    <span className="inline-flex items-center gap-2 rounded-field bg-brand-tint px-4 py-2 text-sm font-bold tabular-nums text-brand">
      내 가점 {result.total}점
      {winnerLowest !== null && <span className="font-medium text-ink-sub">· 이 공고 최저 당첨 {winnerLowest}점</span>}
    </span>
  )
}
