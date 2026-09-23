export interface RebstatRow {
  WRTTIME_IDTFR_ID: string // YYYYMM
  DTA_VAL: number
}

// ERROR-290(인증키 무효)은 여기서 던지고, INFO-000 외 나머지 코드는 일반 에러로 올린다.
// 두 형태(래퍼 있음/없음) 모두에서 같은 판정을 쓴다 — 문서는 "에러는 래퍼 없이 단독으로 온다"고
// 하지만 래퍼가 있는데 head의 RESULT.CODE가 에러인 경우까지 안 보면, 그 진짜 원인이 빈 rows로
// 내려가 isSampleResponse에 SAMPLE_RESPONSE로 오보된다(§4.5① 이 경계한 "디버깅을 헤매게 하는" 부류).
function checkResultCode(code: string | undefined): void {
  if (code === 'ERROR-290') throw new Error('REBSTAT_KEY_INVALID')
  if (code && code !== 'INFO-000') throw new Error(`rebstat upstream ${code}`)
}

/**
 * R-ONE 정상 응답은 `SttsApiTblData` 배열([0]=head, [1]=row)이고,
 * 에러 응답은 래퍼 없이 `{"RESULT":{...}}` 단독으로 온다(§4.5③) — 파서가 둘 다 처리해야 한다.
 */
export function extractRebstatRows<T extends RebstatRow = RebstatRow>(body: unknown): T[] {
  const record = body as Record<string, unknown> | null
  const wrapper = record?.SttsApiTblData

  if (Array.isArray(wrapper)) {
    const headSection = wrapper.find((section) => section !== null && typeof section === 'object' && 'head' in section) as
      | { head?: unknown[] }
      | undefined
    const resultEntry = headSection?.head?.find(
      (entry) => entry !== null && typeof entry === 'object' && 'RESULT' in entry,
    ) as { RESULT?: { CODE?: string } } | undefined
    checkResultCode(resultEntry?.RESULT?.CODE)

    const rowSection = wrapper.find((section) => section !== null && typeof section === 'object' && 'row' in section) as
      | { row?: unknown }
      | undefined
    const rows = rowSection?.row
    if (rows == null) return []
    return Array.isArray(rows) ? (rows as T[]) : [rows as T]
  }

  checkResultCode((record?.RESULT as { CODE?: string } | undefined)?.CODE)
  return []
}

/**
 * `WRTTIME_IDTFR_ID`(고정폭 YYYYMM 문자열)로 요청 기간을 잘라낸다 — 상류가 START/END_WRTTIME을
 * 실제로 지원하는지 검증되지 않았으므로(§4.5⑤), 상류가 필터를 무시해도 결과가 틀리지 않게 한다.
 */
export function clampToRange(rows: RebstatRow[], startWrttime: string, endWrttime: string): RebstatRow[] {
  return rows.filter((row) => row.WRTTIME_IDTFR_ID >= startWrttime && row.WRTTIME_IDTFR_ID <= endWrttime)
}

/**
 * `KEY`를 생략하면 에러가 아니라 실제 데이터 5건이 온다(§4.5①). 요청한 기간보다 짧게
 * 5건 이하로 돌아오면 키 미적용으로 간주한다.
 */
export function isSampleResponse(rowCount: number, requestedMonths: number): boolean {
  return rowCount <= 5 && requestedMonths > rowCount
}
