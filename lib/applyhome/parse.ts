import { format as formatDateFns } from 'date-fns'
import { DATE_FORMAT_BY_TYPE } from '@/lib/config'
import type { NoticeType, ReceiptWindow } from '@/lib/types'

/**
 * 청약홈 응답의 날짜 필드를 ISO(`yyyy-MM-dd`)로 정규화한다.
 * 입력 형식은 오퍼레이션마다 `yyyy-MM-dd` 또는 `yyyyMMdd`로 다르지만,
 * 이 함수가 형식을 감지해 항상 같은 출력을 낸다.
 * 빈 문자열 · `"-"` · 공백 · `null` · `undefined` 는 모두 `null`.
 */
export function parseIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === '-') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
  }
  return null
}

/**
 * 금액 문자열(쉼표 포함 가능)을 숫자로 변환한다. 단위는 만원.
 * 파싱에 실패하면 `null`을 반환한다 — 0원 분양과 구분하기 위해 0으로 떨어뜨리지 않는다.
 */
export function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/,/g, '').trim()
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * 세대수 등 정수 카운트 필드를 파싱한다. 실패하면 `null`.
 */
export function parseCount(value: unknown): number | null {
  const amount = parseAmount(value)
  return amount === null ? null : Math.trunc(amount)
}

/**
 * `HOUSE_TY`(또는 `TP`)를 조인 키로 쓴다. 트리밍 외에는 원문을 그대로 쓴다.
 *
 * 이전에는 `"084.9500A"`와 `"84㎡A"`를 같은 키로 만든다는 이유로 숫자+말미 영문 접미사를
 * 뽑아 재구성했는데, Phase 8 실측(Detail/Mdl·경쟁률 대량 표본 전수 대조)에서 `㎡` 표기는
 * API에 실재하지 않았다 — 픽스처가 청약홈 웹사이트 렌더링을 API 실측으로 잘못 기록한
 * 것이었다. 같은 오퍼레이션 계열의 두 응답(Mdl vs 경쟁률)은 같은 원본 데이터에서 나와
 * `HOUSE_TY`/`TP` 원문이 항상 그대로 일치했다(모델번호 있는 3개 오퍼레이션 300/300,
 * 폴백 조인 대상인 REMNDR 249/249, OPT 291/291 — 정규화가 늘려준 매칭이 0건).
 *
 * 그리고 그 정규화의 접미사 정규식(`[A-Za-z]+\s*$`)이 숫자로 끝나는 실제 TP 값
 * (`59A-1`, `84A1`, `84B-1` 등)에서 매칭에 실패해 서로 다른 주택형 6종을 전부 `"84"`로
 * 뭉개는 조인 충돌을 만들었다. 원문 비교가 더 정확하고 더 단순하므로 트리밍만 한다.
 */
export function toHouseTypeKey(raw: string): string {
  return raw.trim()
}

// 청약홈 응답에서 "값 없음"을 관용적으로 표시하는 자리표시자 집합이다(§4.0 — 값의 집합을
// 우리가 통제한다). `GP`(군)가 없으면 빈 문자열이 아니라 `"-"`로 온다(Phase 8 실측,
// PBL_PVT_RENT 100%·URBTY_OFCTL 15%). 필터링 목적으로만 쓴다 — 표시 문자열 자체는 안 바꾼다.
const BLANK_PLACEHOLDERS = new Set(['-'])

export function isMeaningfulValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value !== '' && !BLANK_PLACEHOLDERS.has(value)
}

/**
 * `CMPET_RATE`(경쟁률)를 파싱한다. OAS상 `string` 타입이고, 청약홈 화면에서 미달 시 `△` 표기가
 * 관측됐다(API 필드에 그대로 들어가는지는 미확인, §4.4). 숫자로 파싱되면 `rate`, 아니면
 * `rate: null` + `rateRaw`에 원문을 그대로 보존한다. 화면은 `rateRaw`를 보여주고
 * 정렬·비교는 `rate`에만 적용한다.
 */
export function parseCompetitionRate(value: unknown): { rate: number | null; rateRaw: string } {
  const rateRaw = typeof value === 'string' ? value : value == null ? '' : String(value)
  const trimmed = rateRaw.trim()
  const n = Number(trimmed)
  const rate = trimmed !== '' && Number.isFinite(n) ? n : null
  return { rate, rateRaw }
}

/**
 * `cond[RCRIT_PBLANC_DE::GTE]` 등 필터 값에 넣을 날짜를 유형별 형식으로 만든다.
 */
export function formatCondDate(type: NoticeType, date: Date): string {
  const format = DATE_FORMAT_BY_TYPE[type]
  return format === 'compact' ? formatDateFns(date, 'yyyyMMdd') : formatDateFns(date, 'yyyy-MM-dd')
}

/**
 * 존재하는 접수 윈도우들에서 `receiptStart`(min) / `receiptEnd`(max)를 뽑는다.
 * 날짜가 ISO `yyyy-MM-dd` 고정 폭 문자열이라 사전순 비교가 곧 날짜 비교다.
 */
export function computeReceiptBounds(receipt: ReceiptWindow[]): { start: string | null; end: string | null } {
  const starts = receipt.map((w) => w.start).filter((v): v is string => v !== null)
  const ends = receipt.map((w) => w.end).filter((v): v is string => v !== null)
  return {
    start: starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null,
    end: ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null,
  }
}
