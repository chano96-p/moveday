import { differenceInCalendarDays, parseISO } from 'date-fns'

export type NoticeStatus = 'upcoming' | 'open' | 'closed' | 'unknown'

export interface DdayInfo {
  dday: number | null
  status: NoticeStatus
}

const SEOUL_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * `now`를 KST 캘린더 기준 '오늘' 날짜로 변환한다.
 * `date-fns`의 `differenceInCalendarDays`는 서버 로컬 캘린더로 동작해서,
 * `TZ=UTC`로 도는 Vercel에서는 그대로 쓰면 한국시간 00:00~09:00 동안 하루 밀린다(§4.1).
 */
export function todayInSeoul(now: Date = new Date()): Date {
  return parseISO(SEOUL_YMD.format(now))
}

/**
 * 접수 시작·종료일과 기준 시각(`now`)으로 D-day·status를 계산한다.
 * 캐시에 굽지 않고 응답 시점에 매번 다시 계산해야 한다(§6).
 * status 판정 원칙: 종료일이 없으면 마감 판정 불가(§4.1).
 */
export function computeDday(receiptStart: string | null, receiptEnd: string | null, now: Date = new Date()): DdayInfo {
  const today = todayInSeoul(now)
  const start = receiptStart ? parseISO(receiptStart) : null
  const end = receiptEnd ? parseISO(receiptEnd) : null

  const dday = end ? differenceInCalendarDays(end, today) : null

  let status: NoticeStatus
  if (start && differenceInCalendarDays(start, today) > 0) {
    status = 'upcoming'
  } else if (!end) {
    status = 'unknown'
  } else if (differenceInCalendarDays(end, today) < 0) {
    status = 'closed'
  } else {
    status = 'open'
  }

  return { dday, status }
}
