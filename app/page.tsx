'use client'

import { useMemo, useState } from 'react'
import { SummaryBar } from '@/components/SummaryBar'
import { DeadlineCards } from '@/components/DeadlineCards'
import { TypeTabs, type DashboardTab } from '@/components/TypeTabs'
import { RegionFilter } from '@/components/RegionFilter'
import { NoticeTable } from '@/components/NoticeTable'
import { MarketStrip } from '@/components/MarketStrip'
import { useNotices } from '@/hooks/useNotices'
import { useFavorites } from '@/hooks/useFavorites'
import type { NoticeType, Region } from '@/lib/types'

export default function Home() {
  const [tab, setTab] = useState<DashboardTab>('ALL')
  const [regions, setRegions] = useState<Region[]>([])
  const { favorites } = useFavorites()

  // summary는 region·type 필터를 반영한다(§5) — 테이블과 같은 쿼리 결과를 그대로 쓴다.
  // 관심(FAVORITES)은 서버가 모르는 클라이언트 전용 필터라 type을 안 보내 "전체" 쿼리와 같아진다 —
  // 그 덕에 관심 탭에서도 SummaryBar·DeadlineCards는 현재 region 범위 기준을 그대로 유지한다(§8).
  const filterType: NoticeType | undefined = tab === 'ALL' || tab === 'FAVORITES' ? undefined : tab
  const query = useNotices({ region: regions, type: filterType })

  const tableNotices = useMemo(() => {
    const rows = query.data?.notices ?? []
    return tab === 'FAVORITES' ? rows.filter((n) => favorites.includes(n.id)) : rows
  }, [query.data, tab, favorites])

  if (query.isError) {
    const message =
      query.error instanceof Error && query.error.message === 'ODCLOUD_KEY_MISSING'
        ? '청약홈 인증키가 설정되지 않았습니다. .env에 ODCLOUD_SERVICE_KEY를 설정하세요.'
        : '공고 정보를 불러올 수 없습니다.'
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="rounded-lg border border-border bg-surface p-6 text-center text-ink-muted">{message}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {query.isLoading && <p className="text-ink-muted">불러오는 중…</p>}
      {query.data && (
        <>
          <SummaryBar summary={query.data.summary} />
          <DeadlineCards notices={query.data.notices} />
        </>
      )}

      <div className="space-y-4">
        <TypeTabs value={tab} onChange={setTab} />
        <RegionFilter value={regions} onChange={setRegions} />
        <NoticeTable notices={tableNotices} isLoading={query.isLoading} />
      </div>

      {/* 정확히 한 지역만 골랐을 때만 그 지역, 0개나 2개 이상이면 전국이다(§8) — 두 지역을 골랐는데
          그중 하나만 보여주면 임의적이다. 여러 지역을 보고 싶어서 고른 사람에게는 전국이 더 정직하다. */}
      <MarketStrip region={regions.length === 1 ? regions[0] : '전국'} />
    </main>
  )
}
