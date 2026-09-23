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
import { RegionMarket } from '@/components/RegionMarket'
import { AISection } from '@/components/AISection'
import { NOTICE_TYPES } from '@/lib/config'
import { joinCompetition } from '@/lib/applyhome/competitionJoin'
import type { NoticeType } from '@/lib/types'

function isNoticeType(value: string | null): value is NoticeType {
  return value !== null && (NOTICE_TYPES as readonly string[]).includes(value)
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
      <NoticeHeader notice={notice} supply={supply} />
      <ScheduleTimeline notice={notice} />
      <SupplyTable supply={supply} />
      <SpecialSupplyBox specialSupply={competitionQuery.data?.specialSupply} />
      <RegulationBox regulation={regulation} />
      <RegionMarket region={notice.region} />
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
