export interface RebstatRow {
  WRTTIME_IDTFR_ID: string // YYYYMM
  DTA_VAL: number
}

// ERROR-290(인증키 무효)은 여기서 던지고, INFO-000 외 나머지 코드는 일반 에러로 올린다.
// 두 형태(래퍼 있음/없음) 모두에서 같은 판정을 쓴다 — 문서는 "에러는 래퍼 없이 단독으로 온다"고
// 하지만 래퍼가 있는데 head의 RESULT.CODE가 에러인 경우까지 안 보면, 그 진짜 원인이 빈 rows로
// 내려가 isSampleResponse에 SAMPLE_RESPONSE로 오보된다(§4.5① 이 경계한 "디버깅을 헤매게 하는" 부류).
//
// INFO-200("해당하는 데이터가 없습니다")은 접두어가 INFO-라 에러가 아니라 "조회 결과 없음"이다
// (Phase 8 실측 — 요청 창에 아직 공표되지 않은 최신 구간을 물으면 이 코드가 온다). 에러로
// 던지지 않고 빈 rows로 자연히 떨어지게 둔다 — "데이터 없음은 에러가 아니다, 섹션을 숨긴다"는
// 이 프로젝트의 원칙(§4.4 경쟁률, §9 지도)과 같다. 존재하지 않는 STATBL_ID에도 같은 코드가
// 와서 이 둘을 구분할 수 없지만, 통계표 상수 3개가 실측으로 확정된 지금은 감수할 위험이다.
function checkResultCode(code: string | undefined): void {
  if (code === 'ERROR-290') throw new Error('REBSTAT_KEY_INVALID')
  if (code === 'INFO-200') return
  if (code && code !== 'INFO-000') throw new Error(`rebstat upstream ${code}`)
}

export interface RebstatExtraction<T extends RebstatRow = RebstatRow> {
  rows: T[]
  // head의 list_total_count — 상류가 보고하는 전체 건수. 샘플(키 미적용) 판별에 쓴다.
  // 뽑을 수 없으면(래퍼 없음·파싱 실패) null — "모르면 샘플로 단정하지 않는다"(§4.5①).
  listTotalCount: number | null
}

/**
 * R-ONE 정상 응답은 `SttsApiTblData` 배열([0]=head, [1]=row)이고,
 * 에러 응답은 래퍼 없이 `{"RESULT":{...}}` 단독으로 온다(§4.5③) — 파서가 둘 다 처리해야 한다.
 */
export function extractRebstatRows<T extends RebstatRow = RebstatRow>(body: unknown): RebstatExtraction<T> {
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

    const totalCountEntry = headSection?.head?.find(
      (entry) => entry !== null && typeof entry === 'object' && 'list_total_count' in entry,
    ) as { list_total_count?: unknown } | undefined
    const listTotalCount = typeof totalCountEntry?.list_total_count === 'number' ? totalCountEntry.list_total_count : null

    const rowSection = wrapper.find((section) => section !== null && typeof section === 'object' && 'row' in section) as
      | { row?: unknown }
      | undefined
    const rawRows = rowSection?.row
    const rows = rawRows == null ? [] : Array.isArray(rawRows) ? (rawRows as T[]) : [rawRows as T]
    return { rows, listTotalCount }
  }

  checkResultCode((record?.RESULT as { CODE?: string } | undefined)?.CODE)
  return { rows: [], listTotalCount: null }
}

/**
 * `WRTTIME_IDTFR_ID`(고정폭 YYYYMM 문자열)로 요청 기간을 잘라낸다. Phase 8 실측에서 상류의
 * START/END_WRTTIME이 실제로 동작하는 것이 확인됐지만(§4.5⑤), 제거만 하고 값을 지어내지
 * 않으니 상류가 언젠가 필터를 무시해도 결과가 틀리지 않는 쪽이라 남긴다.
 */
export function clampToRange(rows: RebstatRow[], startWrttime: string, endWrttime: string): RebstatRow[] {
  return rows.filter((row) => row.WRTTIME_IDTFR_ID >= startWrttime && row.WRTTIME_IDTFR_ID <= endWrttime)
}

/**
 * `KEY`를 생략해도 에러가 아니라 실제 데이터가 온다(§4.5①) — 다만 상류가 `pSize`만큼 다
 * 안 주고 잘라서 보낸다. `list_total_count`(상류가 보고하는 전체 건수)와 실제로 받은 행
 * 수를 비교해 판별한다 — 공표 지연으로 실제 건수 자체가 적은 정상 응답은 두 값이 같아서
 * 구분된다(예전 기준 `requestedMonths > rowCount`는 이 경우를 샘플로 오판했다).
 * `list_total_count`를 모르면(파싱 실패 등) 샘플로 단정하지 않는다 — 정상 요청에 틀린
 * 에러를 내는 쪽이 더 나쁘다.
 */
export function isSampleResponse(rowCount: number, listTotalCount: number | null, pageSize: number): boolean {
  // 페이지 한도(pSize)만큼 받았으면 "잘린" 게 아니라 페이지네이션이다. 이 구분이 없으면
  // 시계열이 pSize를 넘는 순간(월 1행씩 늘어 약 26개월 뒤, 또는 주간 주기 통계표를 추가하면
  // 즉시) 정상 응답이 502가 된다 — clampToRange를 남겨둔 이유와 정면으로 모순되는 실패다.
  return listTotalCount !== null && rowCount < Math.min(listTotalCount, pageSize)
}
