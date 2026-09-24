'use client'

import dynamic from 'next/dynamic'
import { useMarketPriceIndex } from '@/hooks/useMarketPriceIndex'
import { formatChange } from '@/lib/format'
import type { Region } from '@/lib/types'

// recharts가 First Load JS를 크게 늘린다 — 통계 키가 없으면 아예 안 그려지는 섹션이라
// 초기 번들에 넣을 이유가 없다. 클라이언트에서만, 필요할 때만 불러온다.
const IndexChart = dynamic(() => import('./IndexChart').then((m) => m.IndexChart), { ssr: false })

const MONTHS = 24

function changeClassName(value: number | null): string {
  if (value === null) return 'text-ink-muted'
  if (value > 0) return 'text-up'
  if (value < 0) return 'text-down'
  return 'text-ink-muted'
}

/**
 * 우측 컬럼 시세 카드(Figma `market-index` 3:215). 통계 키가 없거나 지역이 CLS_ID
 * 미매핑이면(503) 이 카드만 사라진다(§5/§8) — 나머지 대시보드는 그대로 동작한다.
 */
export function MarketStrip({ region }: { region: Region | '전국' }) {
  const query = useMarketPriceIndex(region, MONTHS)

  // 로딩 중엔 스켈레톤을 둬서 섹션이 나중에 끼어들며 레이아웃이 점프하지 않게 한다.
  if (query.isLoading) {
    return (
      <section aria-label="시세 지수" className="rounded-card border border-border bg-surface p-6">
        <div className="h-[196px] animate-pulse rounded bg-canvas" />
      </section>
    )
  }
  if (query.isError || !query.data) return null

  const sale = query.data.series.find((s) => s.key === 'sale')
  if (!sale || sale.points.length === 0) return null

  const latest = sale.points[sale.points.length - 1]

  return (
    <section aria-label="시세 지수" className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-base font-bold text-ink">{region} 아파트 시세 지수</h2>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
        <span className="text-[22px] font-extrabold tabular-nums text-ink">{latest.value.toFixed(1)}</span>
        <span className={`text-[13px] font-semibold tabular-nums ${changeClassName(sale.change.mom)}`}>
          {formatChange(sale.change.mom)} (전월 대비)
        </span>
      </div>

      <div className="mt-5">
        <IndexChart series={[{ key: 'sale', label: sale.label, points: sale.points }]} height={140} minimal />
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
        <span>{MONTHS}개월 전</span>
        <span>현재</span>
      </div>
      <p className="mt-3 text-[11px] text-ink-muted">{query.data.baseNote}</p>
    </section>
  )
}
