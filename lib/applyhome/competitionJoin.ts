// `lib/applyhome/competition.ts`와 분리한 이유: 그 파일은 `fetchOdcloudAll`(→ `lib/applyhome/fixtures.ts`
// → `node:fs`/`node:path`)까지 끌고 오는 서버 전용 모듈이다. 이 두 함수는 클라이언트 컴포넌트
// (`app/notices/[id]/page.tsx`)가 값으로 import해야 해서, `type` import가 아니면 그 모듈 전체가
// 브라우저 번들에 끌려온다(실제로 빌드가 깨졌다). `CompetitionResult` 등은 `type` import라 무해하다.
import type { CompetitionResult } from './competition'
import type { CompetitionRow, SupplyRow } from '@/lib/types'

// 한 모델에 순위·거주지역별로 여러 CompetitionRow가 붙을 수 있지만 SupplyRow.competition은
// 표시용으로 하나만 받는다(§4.1 — singular인 것은 설계 결함으로 기록됐지만 타입은 유지).
// 선택 규칙: 1순위+해당지역을 최우선으로, 없으면 최저 순위, 그래도 없으면 첫 항목 —
// 사람들이 실제로 인용하는 숫자다. rank·거주지역이 없는 오퍼레이션(REMNDR/OPT/CancRespl)은
// 자연히 마지막 규칙(첫 항목)으로 떨어진다. 순수 함수라 단위 테스트 대상이다.
export function pickPrimaryCompetition(rows: CompetitionRow[]): CompetitionRow | undefined {
  if (rows.length === 0) return undefined
  const rank1Corresponding = rows.find((row) => row.rankCode === 1 && row.resideKind === 'corresponding')
  if (rank1Corresponding) return rank1Corresponding
  const ranked = rows.filter((row) => row.rankCode !== null).sort((a, b) => (a.rankCode as number) - (b.rankCode as number))
  return ranked[0] ?? rows[0]
}

/**
 * `/api/notices/{id}` supply와 `/api/notices/{id}/competition` rows를 조인한다.
 * `houseTypeKey`는 양쪽 다 서버가 이미 계산한 값이다 — 클라이언트가 `normalizeHouseType`을
 * 다시 부를 필요가 없다(조인 키 재계산은 서버-클라이언트 이중 구현이 되어 어긋날 수 있다).
 */
export function joinCompetition(supply: SupplyRow[], competition: CompetitionResult | undefined): SupplyRow[] {
  if (!competition) return supply
  return supply.map((row) => {
    const match = competition.rows.find((c) =>
      competition.joinedBy === 'modelNo' ? c.modelNo !== null && c.modelNo === row.modelNo : c.houseTypeKey === row.houseTypeKey,
    )
    if (!match) return row
    return { ...row, competition: pickPrimaryCompetition(match.competition), score: match.score }
  })
}
