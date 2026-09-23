'use client'

import { useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useNoticeDetail } from '@/hooks/useNoticeDetail'
import { useCompetition } from '@/hooks/useCompetition'
import { NoticeHeader } from '@/components/NoticeHeader'
import { ScheduleTimeline } from '@/components/ScheduleTimeline'
import { SupplyTable } from '@/components/SupplyTable'
import { SpecialSupplyBox } from '@/components/SpecialSupplyBox'
import { RegulationBox } from '@/components/RegulationBox'
import { AISection } from '@/components/AISection'
import { NOTICE_TYPES } from '@/lib/config'
import { normalizeHouseType } from '@/lib/applyhome/parse'
import type { CompetitionRow, NoticeType, SupplyRow } from '@/lib/types'
import type { CompetitionResult } from '@/lib/applyhome/competition'

function isNoticeType(value: string | null): value is NoticeType {
  return value !== null && (NOTICE_TYPES as readonly string[]).includes(value)
}

// 한 모델에 순위·거주지역별로 여러 CompetitionRow가 붙을 수 있지만 SupplyRow.competition은
// 표시용으로 하나만 받는다(§4.1 — singular인 것은 설계 결함으로 기록됐지만 타입은 유지).
// 선택 규칙: 1순위+해당지역을 최우선으로, 없으면 최저 순위, 그래도 없으면 첫 항목 —
// 사람들이 실제로 인용하는 숫자다. rank·거주지역이 없는 오퍼레이션(REMNDR/OPT/CancRespl)은
// 자연히 마지막 규칙(첫 항목)으로 떨어진다.
function pickPrimaryCompetition(rows: CompetitionRow[]): CompetitionRow | undefined {
  if (rows.length === 0) return undefined
  const rank1Corresponding = rows.find((row) => row.rankCode === 1 && row.resideKind === 'corresponding')
  if (rank1Corresponding) return rank1Corresponding
  const ranked = rows.filter((row) => row.rankCode !== null).sort((a, b) => (a.rankCode as number) - (b.rankCode as number))
  return ranked[0] ?? rows[0]
}

function joinCompetition(supply: SupplyRow[], competition: CompetitionResult | undefined): SupplyRow[] {
  if (!competition) return supply
  return supply.map((row) => {
    const match = competition.rows.find((c) =>
      competition.joinedBy === 'modelNo'
        ? c.modelNo !== null && c.modelNo === row.modelNo
        : normalizeHouseType(c.houseType) === row.houseTypeKey,
    )
    if (!match) return row
    return { ...row, competition: pickPrimaryCompetition(match.competition), score: match.score }
  })
}

export default function NoticeDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')
  const hasValidType = isNoticeType(typeParam)

  // 훅은 항상 호출한다(Rules of Hooks) — `type`이 없거나 잘못됐을 때는 `null`을 넘겨
  // 네트워크만 막는다. 이 경로는 대시보드 링크로는 안 생기지만 북마크·직접 입력·뒤로가기로 실재한다.
  const query = useNoticeDetail(params.id, hasValidType ? typeParam : null)
  const competitionQuery = useCompetition(params.id, hasValidType ? typeParam : null)

  const supply = useMemo(
    () => joinCompetition(query.data?.supply ?? [], competitionQuery.data ?? undefined),
    [query.data, competitionQuery.data],
  )

  if (!hasValidType) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="rounded-lg border border-border bg-surface p-6 text-center text-ink-muted">
          잘못된 주소입니다. 대시보드에서 다시 들어와 주세요.
        </p>
      </main>
    )
  }

  if (query.isLoading) {
    return <main className="mx-auto max-w-5xl px-4 py-10 text-ink-muted">불러오는 중…</main>
  }

  if (query.isError) {
    const code = query.error instanceof Error ? query.error.message : ''
    const message =
      code === 'HTTP_404'
        ? '공고를 찾을 수 없습니다.'
        : code === 'HTTP_503'
          ? '청약홈 인증키가 설정되지 않았습니다. .env에 ODCLOUD_SERVICE_KEY를 설정하세요.'
          : '공고 정보를 불러올 수 없습니다.'
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="rounded-lg border border-border bg-surface p-6 text-center text-ink-muted">{message}</p>
      </main>
    )
  }

  if (!query.data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="rounded-lg border border-border bg-surface p-6 text-center text-ink-muted">
          공고 정보를 불러올 수 없습니다.
        </p>
      </main>
    )
  }

  const { notice, regulation, noticeUrl } = query.data

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <NoticeHeader notice={notice} />
      <ScheduleTimeline notice={notice} />
      <SupplyTable supply={supply} />
      <SpecialSupplyBox specialSupply={competitionQuery.data?.specialSupply} />
      <RegulationBox regulation={regulation} />
      {noticeUrl && (
        <a
          href={noticeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-ink-muted hover:text-ink hover:underline"
        >
          공고문 원문 보기 →
        </a>
      )}
      <AISection />
    </main>
  )
}
