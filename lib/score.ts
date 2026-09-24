export interface ScoreInput {
  noHouseYears: number
  dependents: number
  accountMonths: number
}

export interface ScoreBreakdown {
  noHouse: number
  dependents: number
  account: number
}

export interface ScoreResult {
  total: number
  breakdown: ScoreBreakdown
}

interface ScoreTier {
  min: number
  score: number
}

// 무주택기간(년) — 1년 미만 2점, 이후 1년마다 +2, 15년 이상 32점(상한). §10 표를 그대로 옮긴다.
const NO_HOUSE_TIERS: ScoreTier[] = [
  { min: 0, score: 2 },
  { min: 1, score: 4 },
  { min: 2, score: 6 },
  { min: 3, score: 8 },
  { min: 4, score: 10 },
  { min: 5, score: 12 },
  { min: 6, score: 14 },
  { min: 7, score: 16 },
  { min: 8, score: 18 },
  { min: 9, score: 20 },
  { min: 10, score: 22 },
  { min: 11, score: 24 },
  { min: 12, score: 26 },
  { min: 13, score: 28 },
  { min: 14, score: 30 },
  { min: 15, score: 32 },
]

// 부양가족수(명) — 0명 5점, 1명마다 +5, 6명 이상 35점(상한).
const DEPENDENTS_TIERS: ScoreTier[] = [
  { min: 0, score: 5 },
  { min: 1, score: 10 },
  { min: 2, score: 15 },
  { min: 3, score: 20 },
  { min: 4, score: 25 },
  { min: 5, score: 30 },
  { min: 6, score: 35 },
]

// 청약통장 가입기간(개월) — 6개월 미만 1점, 6개월~1년 미만 2점, 이후 1년마다 +1, 15년(180개월) 이상 17점(상한).
const ACCOUNT_TIERS: ScoreTier[] = [
  { min: 0, score: 1 },
  { min: 6, score: 2 },
  { min: 12, score: 3 },
  { min: 24, score: 4 },
  { min: 36, score: 5 },
  { min: 48, score: 6 },
  { min: 60, score: 7 },
  { min: 72, score: 8 },
  { min: 84, score: 9 },
  { min: 96, score: 10 },
  { min: 108, score: 11 },
  { min: 120, score: 12 },
  { min: 132, score: 13 },
  { min: 144, score: 14 },
  { min: 156, score: 15 },
  { min: 168, score: 16 },
  { min: 180, score: 17 },
]

// tiers는 min 오름차순이다. value 이상인 가장 마지막 구간의 score를 쓴다 — 구간 밖(음수·최상위
// 초과) 값도 첫/마지막 구간의 score로 떨어져 항상 정의된 값을 돌려준다.
function scoreFromTiers(value: number, tiers: ScoreTier[]): number {
  let matched = tiers[0].score
  for (const tier of tiers) {
    if (value < tier.min) break
    matched = tier.score
  }
  return matched
}

/** 항목별 만점(§10) — 화면이 "20 / 32점 만점"을 그리는 데 쓴다. 합이 84다. */
export const SCORE_MAX = { noHouse: 32, dependents: 35, account: 17, total: 84 } as const

export function calcScore(input: ScoreInput): ScoreResult {
  const breakdown: ScoreBreakdown = {
    noHouse: scoreFromTiers(input.noHouseYears, NO_HOUSE_TIERS),
    dependents: scoreFromTiers(input.dependents, DEPENDENTS_TIERS),
    account: scoreFromTiers(input.accountMonths, ACCOUNT_TIERS),
  }
  return { total: breakdown.noHouse + breakdown.dependents + breakdown.account, breakdown }
}
