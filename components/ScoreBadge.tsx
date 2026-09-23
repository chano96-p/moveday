'use client'

import Link from 'next/link'
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

  if (!result) {
    return (
      <Link href="/score" className="text-xs text-ink-muted hover:text-ink hover:underline">
        가점 계산하기 →
      </Link>
    )
  }

  const winnerLowest = lowestWinnerScore(supply)

  return (
    <span className="inline-block rounded border border-border bg-canvas px-2 py-0.5 text-xs tabular-nums text-ink-muted">
      내 가점 {result.total}점
      {winnerLowest !== null && <> · 이 공고 최저 당첨 {winnerLowest}점</>}
    </span>
  )
}
