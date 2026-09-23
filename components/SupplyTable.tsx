import { formatArea, formatManwon } from '@/lib/format'
import type { SupplyRow } from '@/lib/types'
import type { NoticeDetailResponse } from '@/hooks/useNoticeDetail'

function specialBreakdownText(row: SupplyRow): string {
  if (!row.specialBreakdown) return '-'
  const parts = Object.entries(row.specialBreakdown)
    // 0세대인 특별공급 유형은 "없음"이다 — 나열하면 해당 유형이 있는 것처럼 읽힌다(§4.3②).
    .filter(([, value]) => value !== null && value > 0)
    .map(([label, value]) => `${label} ${value}`)
  return parts.length ? parts.join(' · ') : '-'
}

export function SupplyTable({ supply }: { supply: NoticeDetailResponse['supply'] }) {
  if (supply.length === 0) return null

  // area.kind가 이미 exclusive/supply 구분을 들고 있다(§9) — 유형 분기 없이 헤더 라벨만 바꾼다.
  const areaHeader = supply[0].area.kind === 'exclusive' ? '전용면적' : '공급면적'

  return (
    <section aria-label="주택형별 공급 정보">
      <h2 className="mb-3 text-sm font-medium text-ink-muted">주택형</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-ink-muted">
            <th className="py-2 pr-3">주택형</th>
            <th className="py-2 pr-3 text-right">{areaHeader}</th>
            <th className="py-2 pr-3 text-right">공급세대</th>
            <th className="py-2 pr-3 text-right">분양가</th>
            <th className="py-2">특별공급 세부</th>
          </tr>
        </thead>
        <tbody>
          {supply.map((row) => (
            <tr key={row.modelNo} className="border-b border-border">
              <td className="py-2 pr-3">{row.houseType}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatArea(row.area.value)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.generalUnits !== null ? row.generalUnits.toLocaleString() : '-'}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatManwon(row.price)}</td>
              <td className="py-2 text-ink-muted">{specialBreakdownText(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
