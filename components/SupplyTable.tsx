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
        {/* 셀 패딩은 tr에 한 번만 건다 — 열 개수가 데이터에 따라 달라져서(경쟁률·가점 열)
            첫/마지막 셀에 개별로 주면 열이 빠질 때 카드 가장자리에 값이 달라붙는다. */}
        <table className="w-full border-collapse whitespace-nowrap text-sm [&_td]:px-4 [&_td]:py-4 [&_th]:px-4 [&_th]:py-3 [&_tr>*:first-child]:pl-6 [&_tr>*:last-child]:pr-6">
          <thead>
            <tr className="border-b border-border bg-canvas text-left text-[13px] font-medium text-ink-muted">
              <th>주택형</th>
              <th className="text-right">{areaHeader}</th>
              <th className="text-right">공급세대</th>
              <th className="text-right">분양가</th>
              <th className="whitespace-normal">특별공급 세부</th>
              {hasCompetition && <th className="text-right">경쟁률</th>}
              {hasScore && <th className="text-right">최저 당첨가점</th>}
            </tr>
          </thead>
          <tbody className="[&>tr:last-child]:border-0">
            {supply.map((row) => (
              <tr key={row.modelNo} className="border-b border-border">
                <td className="font-semibold text-ink">{row.houseType}</td>
                <td className="text-right tabular-nums">{formatArea(row.area.value)}</td>
                <td className="text-right tabular-nums">
                  {row.generalUnits !== null ? row.generalUnits.toLocaleString() : '-'}
                </td>
                <td className="text-right tabular-nums">{formatManwon(row.price)}</td>
                <td className="max-w-[260px] whitespace-normal text-ink-muted">{specialBreakdownText(row)}</td>
                {hasCompetition && (
                  <td className="text-right">
                    {row.competition ? (
                      <>
                        {/* CMPET_RATE가 null이면 rateRaw가 빈 문자열이라 셀이 빈칸이 된다. */}
                        <div className="font-semibold tabular-nums text-ink">{row.competition.rateRaw || '-'}</div>
                        {competitionSubtext(row.competition) && (
                          <div className="mt-0.5 text-xs text-ink-muted">{competitionSubtext(row.competition)}</div>
                        )}
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                )}
                {hasScore && (
                  <td className="text-right font-semibold tabular-nums text-ink">
                    {row.score?.lowest !== null && row.score?.lowest !== undefined
                      ? row.score.lowest.toLocaleString()
                      : '-'}
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
