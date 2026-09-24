'use client'

import { useMemo, useState } from 'react'
import { StatCards } from '@/components/StatCards'
import { TypeTabs, type DashboardTab } from '@/components/TypeTabs'
import { RegionFilter } from '@/components/RegionFilter'
import { NoticeList } from '@/components/NoticeList'
import { MarketStrip } from '@/components/MarketStrip'
import { GuideBanner } from '@/components/GuideBanner'
import { useNotices } from '@/hooks/useNotices'
import { useFavorites } from '@/hooks/useFavorites'
import type { NoticeType, Region } from '@/lib/types'

export default function Home() {
  const [tab, setTab] = useState<DashboardTab>('ALL')
  const [regions, setRegions] = useState<Region[]>([])
  const { favorites } = useFavorites()

  // summary는 region·type 필터를 반영한다(§5) — 목록과 같은 쿼리 결과를 그대로 쓴다.
  // 관심(FAVORITES)은 서버가 모르는 클라이언트 전용 필터라 type을 안 보내 "전체" 쿼리와 같아진다 —
  // 그 덕에 관심 탭에서도 StatCards는 현재 region 범위 기준을 그대로 유지한다(§8).
  const filterType: NoticeType | undefined = tab === 'ALL' || tab === 'FAVORITES' ? undefined : tab
  const query = useNotices({ region: regions, type: filterType })

  const listNotices = useMemo(() => {
    const rows = query.data?.notices ?? []
    return tab === 'FAVORITES' ? rows.filter((n) => favorites.includes(n.id)) : rows
  }, [query.data, tab, favorites])

  if (query.isError) {
    const message =
      query.error instanceof Error && query.error.message === 'ODCLOUD_KEY_MISSING'
        ? '청약홈 인증키가 설정되지 않았습니다. .env에 ODCLOUD_SERVICE_KEY를 설정하세요.'
        : '공고 정보를 불러올 수 없습니다.'
    return (
      <main className="mx-auto max-w-[1440px] px-6 py-10 xl:px-20">
        <p className="rounded-card border border-border bg-surface p-12 text-center text-ink-muted">{message}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[1440px] space-y-8 px-6 py-10 xl:px-20">
      {query.data && <StatCards summary={query.data.summary} favoriteCount={favorites.length} />}

      <div className="flex flex-col gap-8 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <TypeTabs value={tab} onChange={setTab} />
          <RegionFilter value={regions} onChange={setRegions} />
          <NoticeList
            notices={listNotices}
            isLoading={query.isLoading}
            resetKey={`${tab}:${regions.join(',')}`}
          />
        </div>

        <aside className="w-full space-y-6 xl:w-[400px] xl:shrink-0">
          {/* 정확히 한 지역만 골랐을 때만 그 지역, 0개나 2개 이상이면 전국이다(§8) — 두 지역을
              골랐는데 그중 하나만 보여주면 임의적이다. */}
          <MarketStrip region={regions.length === 1 ? regions[0] : '전국'} />
          <GuideBanner />
        </aside>
      </div>
    </main>
  )
}
