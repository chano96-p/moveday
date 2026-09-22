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
 * `HOUSE_TY`(또는 `TP`)를 조인 키로 정규화한다.
 * 선행 숫자에서 소수점 이하를 버리고(정수 ㎡) 말미 영문 접미사를 붙인다.
 * `"084.9500A"`와 `"84㎡A"`가 같은 키(`"84A"`)가 되도록, 두 형식의 소수 정밀도 차이를
 * 흡수하는 것이 목적이다. 화면 표시에는 쓰지 않는다(원문은 `houseType`에 그대로 보존).
 */
export function normalizeHouseType(raw: string): string {
  if (!raw) return ''
  const numberMatch = raw.match(/(\d+(?:\.\d+)?)/)
  const suffixMatch = raw.match(/([A-Za-z]+)\s*$/)
  const suffix = suffixMatch ? suffixMatch[1].toUpperCase() : ''
  if (!numberMatch) return raw
  const area = Math.floor(parseFloat(numberMatch[1]))
  return `${area}${suffix}`
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
