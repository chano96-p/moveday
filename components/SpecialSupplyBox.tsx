import type { SpecialSupplyResult } from '@/lib/applyhome/competition'

export function SpecialSupplyBox({ specialSupply }: { specialSupply: SpecialSupplyResult | undefined }) {
  // APT 외 유형은 전용 오퍼레이션이 없어 available이 false다(§4.4) — 섹션째 렌더하지 않는다.
  if (!specialSupply?.available || specialSupply.byType.length === 0) return null

  return (
    <section aria-label="특별공급 접수현황">
      <h2 className="mb-5 text-xl font-bold text-ink">특별공급 접수현황</h2>
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        {/* 셀 패딩은 tr에 한 번만 건다 — SupplyTable과 같은 규칙으로 맞춘다. */}
        <table className="w-full border-collapse whitespace-nowrap text-sm [&_td]:px-4 [&_td]:py-4 [&_th]:px-4 [&_th]:py-3 [&_tr>*:first-child]:pl-6 [&_tr>*:last-child]:pr-6">
          <thead>
            <tr className="border-b border-border bg-canvas text-left text-[13px] font-medium text-ink-muted">
              <th>유형</th>
              <th className="text-right">배정세대수</th>
              <th>접수현황</th>
            </tr>
          </thead>
          <tbody className="[&>tr:last-child]:border-0">
            {specialSupply.byType.map((row) => (
              <tr key={row.label} className="border-b border-border">
                <td className="font-semibold text-ink">{row.label}</td>
                <td className="text-right tabular-nums">
                  {row.units !== null ? row.units.toLocaleString() : '-'}
                </td>
                <td className="max-w-[320px] whitespace-normal text-ink-muted">
                  {row.requestCounts
                    .filter((r) => r.count !== null)
                    .map((r) => `${r.area} ${r.count}`)
                    .join(' · ') || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
