'use client'

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatYearMonth } from '@/lib/format'

export interface IndexChartSeries {
  key: string
  label: string
  points: { month: string; value: number }[]
  color?: string // 지정 안 하면 단색(--color-line) — MarketStrip의 1라인 원칙(§7)
  dashArray?: string // RegionMarket의 3라인 예외에서 색 외에 패턴으로도 구분한다(§7)
}

function mergeByMonth(series: IndexChartSeries[]): Record<string, string | number>[] {
  const months = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.month)))).sort()
  return months.map((month) => {
    const row: Record<string, string | number> = { month }
    for (const s of series) {
      const point = s.points.find((p) => p.month === month)
      if (point) row[s.key] = point.value
    }
    return row
  })
}

// recharts의 domain=['auto','auto']는 데이터 범위에만 맞춰 100을 잘라낼 수 있다 — 기준선(100)은
// §7이 항상 표시하라고 정한 것이라 도메인에 100을 강제로 포함시킨다.
function domainIncluding100(series: IndexChartSeries[]): [number, number] {
  const values = series.flatMap((s) => s.points.map((p) => p.value))
  const min = Math.min(100, ...values)
  const max = Math.max(100, ...values)
  const padding = Math.max((max - min) * 0.1, 0.5)
  return [Math.floor(min - padding), Math.ceil(max + padding)]
}

// 지수 차트는 단색 라인 + 기준선(100) 표시가 원칙이다(§7). RegionMarket만 3라인이라 색으로
// 구분하되, 색각 이상 사용자를 위해 실선·점선 패턴도 함께 쓴다 — 색만으로 구분하지 않는다.
export function IndexChart({
  series,
  height = 200,
  // 대시보드 우측 카드는 축·격자를 지우고 선만 남긴다(Figma `chart-container` 3:221).
  // 기준선(100)은 §7이 항상 표시하라고 정한 것이라 minimal에서도 유지한다.
  minimal = false,
}: {
  series: IndexChartSeries[]
  height?: number
  minimal?: boolean
}) {
  const data = mergeByMonth(series)
  const showLegend = series.length > 1
  const domain = domainIncluding100(series)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={minimal ? { top: 8, right: 8, left: 8, bottom: 0 } : { top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray={minimal ? '0' : '3 3'} stroke="var(--color-border)" vertical={false} />
        {!minimal && (
          <XAxis dataKey="month" tickFormatter={formatYearMonth} tick={{ fontSize: 11 }} stroke="var(--color-ink-muted)" />
        )}
        {!minimal && <YAxis domain={domain} tick={{ fontSize: 11 }} stroke="var(--color-ink-muted)" width={40} />}
        {minimal && <YAxis domain={domain} hide />}
        <ReferenceLine y={100} stroke="var(--color-line-base)" strokeDasharray="4 4" />
        <Tooltip
          labelFormatter={(value) => formatYearMonth(String(value))}
          formatter={(value, name) => [typeof value === 'number' ? value.toFixed(2) : String(value), String(name)]}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? 'var(--color-line)'}
            strokeDasharray={s.dashArray}
            strokeWidth={2}
            // minimal은 마지막 점만 찍는다 — 디자인의 active-dot.
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
