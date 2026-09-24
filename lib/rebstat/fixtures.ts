import { readFileSync } from 'node:fs'
import path from 'node:path'
import { clampToRange, extractRebstatRows, type RebstatRow } from './parse'

const FIXTURE_DIR = path.join(process.cwd(), 'test/fixtures/rebstat')

// STATBL_ID → 픽스처 파일. Phase 8에서 실거래가격지수 코드를 확보해 세 표가 다 있다.
const STATBL_FIXTURE_FILE: Record<string, string> = {
  A_2024_00045: 'sale-index.json',
  A_2024_00050: 'jeonse-index.json',
  A_2024_00178: 'real-transaction-index.json',
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
 * 픽스처는 전국과 공고 픽스처가 쓰는 4개 지역(서울·경기·인천·부산)만 갖고 있다 —
 * 그 외 지역은 매핑은 되지만 픽스처에 행이 없어 빈 배열이 되고, 차트가 스스로 숨는다.
 *
 * `CLS_ID`는 통계표마다 다르다(§4.5④) — 같은 `500008`이 매매·전세 표에서는 서울이고
 * 실거래 표에서는 부산이다. 파일이 표별로 갈려 있으므로 이 필터가 옳게 동작한다.
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
