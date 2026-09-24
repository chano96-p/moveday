'use client'

import { useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useNoticeDetail } from '@/hooks/useNoticeDetail'
import { useCompetition } from '@/hooks/useCompetition'
import { NoticeHero } from '@/components/NoticeHero'
import { InfoGrid } from '@/components/InfoGrid'
import { ApplyCta } from '@/components/ApplyCta'
import { ScoreBadge } from '@/components/ScoreBadge'
import { ScheduleTimeline } from '@/components/ScheduleTimeline'
import { SupplyTable } from '@/components/SupplyTable'
import { SpecialSupplyBox } from '@/components/SpecialSupplyBox'
import { RegulationBox } from '@/components/RegulationBox'
import { RegionMarket } from '@/components/RegionMarket'
import { KakaoMap } from '@/components/KakaoMap'
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
      <main className="mx-auto max-w-[1440px] px-6 py-10 xl:px-20">
        <p className="rounded-card border border-border bg-surface p-12 text-center text-ink-muted">
          잘못된 주소입니다. 대시보드에서 다시 들어와 주세요.
        </p>
      </main>
    )
  }

  if (query.isLoading) {
    return <main className="mx-auto max-w-[1440px] px-6 py-10 text-ink-muted xl:px-20">불러오는 중…</main>
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
      <main className="mx-auto max-w-[1440px] px-6 py-10 xl:px-20">
        <p className="rounded-card border border-border bg-surface p-12 text-center text-ink-muted">{message}</p>
      </main>
    )
  }

  if (!query.data) {
    return (
      <main className="mx-auto max-w-[1440px] px-6 py-10 xl:px-20">
        <p className="rounded-card border border-border bg-surface p-12 text-center text-ink-muted">
          공고 정보를 불러올 수 없습니다.
        </p>
      </main>
    )
  }

  const { notice, regulation, noticeUrl } = query.data

  return (
    <main className="mx-auto max-w-[1440px] space-y-8 px-6 py-10 xl:px-20">
      <NoticeHero notice={notice} />

      <div className="flex flex-col gap-8 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-10">
          <InfoGrid notice={notice} supply={supply} />
          <ScoreBadge supply={supply} />
          <RegulationBox regulation={regulation} noticeUrl={noticeUrl} />

          {/* 아래는 디자인에 없지만 유지하는 섹션들이다 — 경쟁률·당첨가점·특별공급·지도·지역
              시세는 Phase 4~7에서 만든 기능이고, 디자이너가 화면에 안 그렸다는 것이 삭제
              근거는 아니다(팀 리드 판단). 디자인 섹션 아래에 이어붙인다. */}
          <SupplyTable supply={supply} />
          <SpecialSupplyBox specialSupply={competitionQuery.data?.specialSupply} />
          <KakaoMap address={notice.address} />
          <RegionMarket region={notice.region} />
          <AISection />
        </div>

        <aside className="w-full space-y-6 xl:w-[400px] xl:shrink-0">
          <ScheduleTimeline notice={notice} />
          <ApplyCta noticeUrl={noticeUrl} />
        </aside>
      </div>
    </main>
  )
}
