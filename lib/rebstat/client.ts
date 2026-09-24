import { XMLParser } from 'fast-xml-parser'
import { RebstatKeyInvalidError, RebstatKeyMissingError, RebstatSampleResponseError, RebstatUpstreamError } from '@/lib/errors'
import { dedupe } from '@/lib/cache'
import { isFixtureModeEnabled } from '@/lib/applyhome/fixtures'
import { fetchFixtureRebstatRows } from './fixtures'
import { clampToRange, extractRebstatRows, isSampleResponse, type RebstatExtraction, type RebstatRow } from './parse'

export const REBSTAT_BASE = 'https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do'

// 한 번만 호출하고 페이지를 넘기지 않는다 — 월 단위 시계열이라 months(최대 120) 요청이
// 이 한도를 넘을 수 없다. isSampleResponse가 이 값을 알아야 "한도만큼 받은 것"과
// "상류가 잘라 보낸 것"을 구분한다.
const REBSTAT_PAGE_SIZE = 300

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

async function fetchRemoteRows(options: FetchRowsOptions, key: string): Promise<RebstatExtraction> {
  const url = new URL(REBSTAT_BASE)
  url.searchParams.set('KEY', key)
  url.searchParams.set('Type', 'json') // 기본값이 xml이라 반드시 명시해야 한다(§4.5②)
  url.searchParams.set('pIndex', '1')
  url.searchParams.set('pSize', String(REBSTAT_PAGE_SIZE))
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
    // 5xx에 HTML 오류 페이지가 실리면 검사 없이는 xml 파서가 그럭저럭 파싱해 빈 rows가
    // 되고, 그게 SAMPLE_RESPONSE로 오보된다 — "상류가 죽었다"가 "키가 미적용됐다"로 둔갑한다.
    if (!res.ok) throw new Error(`rebstat upstream HTTP ${res.status}`)
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
  const { rows, listTotalCount } = await fetchRemoteRows(options, key).catch((error) => {
    // extractRebstatRows(순수 함수, lib/errors를 모른다)가 RESULT.CODE 오류를 문자열로 던진다 —
    // 여기서 도메인 에러로 바꿔서 라우트의 toErrorResponse가 502(상류 문제)로 처리하게 한다.
    // 이 두 메시지 외의 예외는 우리 코드의 버그일 수 있으니 그대로 흘려보내 500으로 남긴다 —
    // 502/500을 구분해야 운영 로그에서 원인을 가른다.
    if (error instanceof Error && error.message === 'REBSTAT_KEY_INVALID') throw new RebstatKeyInvalidError()
    if (error instanceof Error && error.message.startsWith('rebstat upstream ')) throw new RebstatUpstreamError()
    throw error
  })

  // 샘플 판별은 클램프 **전** 건수로 한다. list_total_count는 상류가 서버 측 필터를 적용한 뒤
  // 보고하는 총건수라, "상류가 자기가 가졌다고 말한 것보다 적게 줬는가"를 재는 값이다.
  // 클램프 후와 비교하면, 상류가 범위 필터를 무시해 전체를 돌려줬을 때 클램프가 걸러낸 행까지
  // "잘렸다"로 읽혀 정상 데이터가 SAMPLE_RESPONSE로 버려진다 — 클램프가 존재하는 이유가
  // 바로 그 시나리오인데 판정이 거꾸로 동작하게 된다.
  if (isSampleResponse(rows.length, listTotalCount, REBSTAT_PAGE_SIZE)) throw new RebstatSampleResponseError()

  // START_WRTTIME/END_WRTTIME이 실제로 동작하는 것이 Phase 8 실측으로 확인됐지만(§4.5⑤),
  // 클램프는 값을 지어내지 않고 제거만 하니 실패 방향이 안전한 쪽이라 그대로 둔다.
  return clampToRange(rows, options.startWrttime, options.endWrttime)
}
