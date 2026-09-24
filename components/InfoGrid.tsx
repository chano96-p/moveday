import { formatArea, formatPhone, formatPriceRange, formatYearMonth } from '@/lib/format'
import type { NoticeDetailResponse } from '@/hooks/useNoticeDetail'
import type { SupplyRow } from '@/lib/types'

interface Cell {
  label: string
  value: string
}

/**
 * 단지 주요 정보(Figma `section-info` 4:104 / `Info Grid Cell` 8:262).
 * 값이 없는 칸은 렌더하지 않는다 — 유형마다 있는 필드가 달라서(시공사는 APT 전용) "-"로
 * 채우면 빈 칸만 늘어선다(§4.4와 같은 원칙).
 */
export function InfoGrid({
  notice,
  supply,
}: {
  notice: NoticeDetailResponse['notice']
  supply: SupplyRow[]
}) {
  const areas = supply.map((row) => row.area.value).filter((v): v is number => v !== null)
  const areaLabel = supply[0]?.area.kind === 'exclusive' ? '전용면적' : '공급면적'
  const price = formatPriceRange(notice.minPrice, notice.maxPrice)

  const cells: (Cell | null)[] = [
    areas.length > 0
      ? { label: areaLabel, value: `${formatArea(Math.min(...areas))} ~ ${formatArea(Math.max(...areas))}` }
      : null,
    price === '-' ? null : { label: '분양가', value: price },
    // 시공사(CNSTRCT_ENTRPS_NM)는 APT Detail에만 있다 — 없으면 사업주체를 라벨까지 바꿔 보여준다.
    notice.builder
      ? { label: '시공사', value: notice.builder }
      : notice.developer
        ? { label: '사업주체', value: notice.developer }
        : null,
    notice.moveInMonth ? { label: '입주예정', value: `${formatYearMonth(notice.moveInMonth)}` } : null,
    formatPhone(notice.contact) ? { label: '문의처', value: formatPhone(notice.contact)! } : null,
    notice.totalUnits !== null
      ? { label: '공급세대수', value: `${notice.totalUnits.toLocaleString()}세대` }
      : null,
  ]
  const visible = cells.filter((c): c is Cell => c !== null)
  if (visible.length === 0) return null

  return (
    <section aria-label="단지 주요 정보">
      <h2 className="mb-5 text-xl font-bold text-ink">단지 주요 정보</h2>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((cell) => (
          <div key={cell.label} className="rounded-cell border border-border bg-surface p-5">
            <dt className="text-[13px] font-medium text-ink-muted">{cell.label}</dt>
            <dd className="mt-2 text-lg font-bold tabular-nums text-ink">{cell.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
