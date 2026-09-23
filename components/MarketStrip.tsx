'use client'

import dynamic from 'next/dynamic'
import { useMarketPriceIndex } from '@/hooks/useMarketPriceIndex'
import { formatChange } from '@/lib/format'
import type { Region } from '@/lib/types'

// recharts가 First Load JS를 크게 늘린다(119→232kB) — 통계 키가 없으면 아예 안 그려지는
// 화면 하단 섹션이라 초기 번들에 넣을 이유가 없다. 클라이언트에서만, 필요할 때만 불러온다.
const IndexChart = dynamic(() => import('./IndexChart').then((m) => m.IndexChart), { ssr: false })

const MONTHS = 24

function changeClassName(value: number | null): string {
  if (value === null) return 'text-ink-muted'
  if (value > 0) return 'text-up'
  if (value < 0) return 'text-down'
  return 'text-ink-muted'
}

// 통계 키가 없거나(503) 지역이 CLS_ID 미매핑이면(503) 이 섹션만 사라진다(§5/§8) — 나머지
// 대시보드는 그대로 동작한다. 그래서 에러를 별도로 안내하지 않고 조용히 null을 반환한다.
export function MarketStrip({ region }: { region: Region | '전국' }) {
  const query = useMarketPriceIndex(region, MONTHS)

  // 로딩 중엔 스켈레톤을 둬서 섹션이 나중에 끼어들며 레이아웃이 점프하지 않게 한다.
  if (query.isLoading) {
    return (
      <section aria-label="시세 지수" className="rounded-lg border border-border bg-surface p-4">
        <div className="h-[120px] animate-pulse rounded bg-canvas" />
      </section>
    )
  }
  if (query.isError || !query.data) return null

  const sale = query.data.series.find((s) => s.key === 'sale')
  if (!sale || sale.points.length === 0) return null

  return (
    <section aria-label="시세 지수" className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ink-muted">
          {region} 아파트 매매가격지수 <span className="text-ink-muted">(최근 {MONTHS}개월)</span>
        </h2>
        <div className="flex items-center gap-3 text-sm tabular-nums">
          <span className={changeClassName(sale.change.mom)}>전월비 {formatChange(sale.change.mom)}</span>
          <span className={changeClassName(sale.change.yoy)}>전년동월비 {formatChange(sale.change.yoy)}</span>
        </div>
      </div>
      <IndexChart series={[{ key: 'sale', label: sale.label, points: sale.points }]} height={120} />
      <p className="mt-2 text-xs text-ink-muted">{query.data.baseNote}</p>
    </section>
  )
}
