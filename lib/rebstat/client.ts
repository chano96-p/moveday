import { XMLParser } from 'fast-xml-parser'
import { RebstatKeyInvalidError, RebstatKeyMissingError, RebstatSampleResponseError } from '@/lib/errors'
import { dedupe } from '@/lib/cache'
import { isFixtureModeEnabled } from '@/lib/applyhome/fixtures'
import { fetchFixtureRebstatRows } from './fixtures'
import { clampToRange, extractRebstatRows, isSampleResponse, type RebstatRow } from './parse'

export const REBSTAT_BASE = 'https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do'

// 실제 키 존재 여부 그대로다 — 픽스처 모드가 이 값을 참으로 바꾸면 없는 키를 있다고
// 보고하게 된다(§5, Phase 2와 같은 원칙). `/api/health`가 이 값을 그대로 노출한다.
export function hasRebstatKey(): boolean {
  return Boolean(process.env.REB_STAT_API_KEY)
}

/**
 * 픽스처 모드에서는 `'fixture'` sentinel을 반환한다 — `fetchRebstatRows`가 상류 진입 전에
 * 이미 픽스처로 가로채므로 이 값이 실제로 헤더에 나갈 일은 없지만, 라우트가 다른 청약홈
 * 라우트와 같은 모양으로 `assertRebstatKey()`를 얼리 게이트로 쓸 수 있게 한다(§11과 같은 함정).
 */
export function assertRebstatKey(): string {
  if (isFixtureModeEnabled()) return 'fixture'
  const key = process.env.REB_STAT_API_KEY
  if (!key) throw new RebstatKeyMissingError()
  return key
}

interface FetchRowsOptions {
  statblId: string
  clsId: number
  itmId: number
  dtacycleCd: string
  startWrttime: string
  endWrttime: string
  months: number
  revalidate: number
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const xmlParser = new XMLParser({ ignoreAttributes: false })

async function fetchRemoteRows(options: FetchRowsOptions, key: string): Promise<RebstatRow[]> {
  const url = new URL(REBSTAT_BASE)
  url.searchParams.set('KEY', key)
  url.searchParams.set('Type', 'json') // 기본값이 xml이라 반드시 명시해야 한다(§4.5②)
  url.searchParams.set('pIndex', '1')
  url.searchParams.set('pSize', '300')
  url.searchParams.set('STATBL_ID', options.statblId)
  url.searchParams.set('DTACYCLE_CD', options.dtacycleCd)
  url.searchParams.set('CLS_ID', String(options.clsId))
  url.searchParams.set('ITM_ID', String(options.itmId))
  url.searchParams.set('START_WRTTIME', options.startWrttime)
  url.searchParams.set('END_WRTTIME', options.endWrttime)
  const requestUrl = url.toString()

  // dedupe 키에는 KEY를 넣지 않는다 — 인메모리 맵이라도 인증키 값을 굳이 담아둘 이유가 없다.
  const dedupeKey = `rebstat:${options.statblId}:${options.clsId}:${options.itmId}:${options.dtacycleCd}:${options.startWrttime}:${options.endWrttime}`

  return dedupe(dedupeKey, async () => {
    const res = await fetch(requestUrl, { next: { revalidate: options.revalidate } })
    const text = await res.text()
    // Type=json을 명시해도 에러 응답이 xml로 올 수 있다고 보고돼 있다(§4.5② — 이번 조사에서는
    // 재현되지 않았지만 방어로 유지한다). JSON 파싱이 실패하면 xml로 재시도한다.
    const body = tryParseJson(text) ?? xmlParser.parse(text)
    return extractRebstatRows(body)
  })
}

/**
 * `KEY`가 없으면 502/503 에러 없이 실제 데이터 5건이 온다(§4.5①) — 우리 클라이언트는
 * `assertRebstatKey()`가 먼저 503을 내므로 이 경로를 못 밟지만, 가드는 방어로 남긴다.
 */
export async function fetchRebstatRows(options: FetchRowsOptions): Promise<RebstatRow[]> {
  // 픽스처 모드는 여기서 바로 반환한다 — 원격 경로의 clamp→sample 순서를 픽스처까지
  // 태우면 픽스처의 동작이 미묘하게 바뀐다. fetchFixtureRebstatRows가 이미 잘라서 준다.
  if (isFixtureModeEnabled()) return fetchFixtureRebstatRows(options)

  const key = assertRebstatKey()
  const rows = await fetchRemoteRows(options, key).catch((error) => {
    // extractRebstatRows(순수 함수, lib/errors를 모른다)가 ERROR-290을 문자열로 던진다 —
    // 여기서 도메인 에러로 바꿔서 라우트의 toErrorResponse가 그대로 처리할 수 있게 한다.
    if (error instanceof Error && error.message === 'REBSTAT_KEY_INVALID') throw new RebstatKeyInvalidError()
    throw error
  })

  // START_WRTTIME/END_WRTTIME을 상류가 실제로 지키는지 검증되지 않았다(§4.5⑤) — clamp를 먼저 한다.
  // months가 표본 건수(5) 이하일 때, 상류가 기간과 무관한 고정 표본 5건을 주면 자르기 전
  // 건수로는 `months > rowCount`가 거짓이 되어 못 잡는다(months=1 → 1>5 거짓).
  const clamped = clampToRange(rows, options.startWrttime, options.endWrttime)

  if (isSampleResponse(clamped.length, options.months)) throw new RebstatSampleResponseError()

  return clamped
}
