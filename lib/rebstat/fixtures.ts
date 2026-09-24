import { readFileSync } from 'node:fs'
import path from 'node:path'
import { clampToRange, extractRebstatRows, type RebstatRow } from './parse'

const FIXTURE_DIR = path.join(process.cwd(), 'test/fixtures/rebstat')

// STATBL_ID → 픽스처 파일. 공동주택 실거래가격지수는 코드가 미확정이라(§4.5③) 없다 —
// /api/market/real-transaction은 픽스처 모드에서도 REBSTAT_TABLE_UNKNOWN으로 끝난다(정상).
const STATBL_FIXTURE_FILE: Record<string, string> = {
  A_2024_00045: 'sale-index.json',
  A_2024_00050: 'jeonse-index.json',
}

interface FixtureRowsOptions {
  statblId: string
  clsId: number
  itmId: number
  dtacycleCd: string
  startWrttime: string
  endWrttime: string
}

interface FixtureRow extends RebstatRow {
  CLS_ID: number
  ITM_ID: number
  DTACYCLE_CD: string
}

/**
 * 픽스처 모드에서 오퍼레이션(=STATBL_ID) + 조건에 대응하는 행을 반환한다.
 * `test/fixtures/rebstat/`는 전국(`CLS_ID=500001`) 데이터만 갖고 있다 — 그 외 지역은
 * 라우트가 `REBSTAT_REGION_UNMAPPED`로 먼저 끝나 이 함수까지 도달하지 않는다.
 */
export function fetchFixtureRebstatRows(options: FixtureRowsOptions): RebstatRow[] {
  const filename = STATBL_FIXTURE_FILE[options.statblId]
  if (!filename) return []

  const body = JSON.parse(readFileSync(path.join(FIXTURE_DIR, filename), 'utf-8'))
  const rows = extractRebstatRows<FixtureRow>(body).rows.filter(
    (row) => row.CLS_ID === options.clsId && row.ITM_ID === options.itmId && row.DTACYCLE_CD === options.dtacycleCd,
  )

  return clampToRange(rows, options.startWrttime, options.endWrttime)
}
