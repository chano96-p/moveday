import type { SpecialSupplyResult } from '@/lib/applyhome/competition'

export function SpecialSupplyBox({ specialSupply }: { specialSupply: SpecialSupplyResult | undefined }) {
  // APT 외 유형은 전용 오퍼레이션이 없어 available이 false다(§4.4) — 섹션째 렌더하지 않는다.
  if (!specialSupply?.available || specialSupply.byType.length === 0) return null

  return (
    <section aria-label="특별공급 접수현황">
      <h2 className="mb-5 text-xl font-bold text-ink">특별공급 접수현황</h2>
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-canvas text-left text-ink-muted">
            <th className="py-2 pr-3">유형</th>
            <th className="py-2 pr-3 text-right">배정세대수</th>
            <th className="py-2">접수현황</th>
          </tr>
        </thead>
        <tbody>
          {specialSupply.byType.map((row) => (
            <tr key={row.label} className="border-b border-border">
              <td className="py-2 pr-3">{row.label}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.units !== null ? row.units.toLocaleString() : '-'}
              </td>
              <td className="py-2 text-ink-muted">
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
