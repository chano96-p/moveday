import { formatArea, formatManwon } from '@/lib/format'
import type { CompetitionRow, SupplyRow } from '@/lib/types'

// 경쟁률 숫자만 보이면 그게 몇 순위·어느 거주지역 값인지 알 수 없다 — 값이 있는 것만 보조표기한다.
function competitionSubtext(row: CompetitionRow): string | null {
  const parts: string[] = []
  if (row.rankCode !== null) parts.push(`${row.rankCode}순위`)
  if (row.resideArea !== null) parts.push(row.resideArea)
  return parts.length ? parts.join(' ') : null
}

function specialBreakdownText(row: SupplyRow): string {
  if (!row.specialBreakdown) return '-'
  const parts = Object.entries(row.specialBreakdown)
    // 0세대인 특별공급 유형은 "없음"이다 — 나열하면 해당 유형이 있는 것처럼 읽힌다(§4.3②).
    .filter(([, value]) => value !== null && value > 0)
    .map(([label, value]) => `${label} ${value}`)
  return parts.length ? parts.join(' · ') : '-'
}

export function SupplyTable({ supply }: { supply: SupplyRow[] }) {
  if (supply.length === 0) return null

  // area.kind가 이미 exclusive/supply 구분을 들고 있다(§9) — 유형 분기 없이 헤더 라벨만 바꾼다.
  const areaHeader = supply[0].area.kind === 'exclusive' ? '전용면적' : '공급면적'
  // 경쟁률·최저 당첨가점 열은 데이터가 있을 때만 렌더한다(§9) — 조인 실패는 에러가 아니라
  // 그 행의 열이 비는 것으로 끝나고, 전부 비면 열 자체를 없앤다.
  const hasCompetition = supply.some((row) => row.competition)
  const hasScore = supply.some((row) => row.score)

  return (
    <section aria-label="주택형별 공급 정보">
      <h2 className="mb-5 text-xl font-bold text-ink">주택형</h2>
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-canvas text-left text-ink-muted">
            <th className="py-2 pr-3">주택형</th>
            <th className="py-2 pr-3 text-right">{areaHeader}</th>
            <th className="py-2 pr-3 text-right">공급세대</th>
            <th className="py-2 pr-3 text-right">분양가</th>
            <th className="py-2 pr-3">특별공급 세부</th>
            {hasCompetition && <th className="py-2 pr-3 text-right">경쟁률</th>}
            {hasScore && <th className="py-2 text-right">최저 당첨가점</th>}
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
              <td className="py-2 pr-3 text-ink-muted">{specialBreakdownText(row)}</td>
              {hasCompetition && (
                <td className="py-2 pr-3 text-right">
                  {row.competition ? (
                    <>
                      {/* CMPET_RATE가 null이면 rateRaw가 빈 문자열이라 셀이 빈칸이 된다. */}
                      <div className="tabular-nums">{row.competition.rateRaw || '-'}</div>
                      {competitionSubtext(row.competition) && (
                        <div className="text-xs text-ink-muted">{competitionSubtext(row.competition)}</div>
                      )}
                    </>
                  ) : (
                    '-'
                  )}
                </td>
              )}
              {hasScore && (
                <td className="py-2 text-right tabular-nums">
                  {row.score?.lowest !== null && row.score?.lowest !== undefined ? row.score.lowest.toLocaleString() : '-'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </section>
  )
}
