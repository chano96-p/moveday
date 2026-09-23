export function formatManwon(value: number | null): string {
  if (value === null) return '-'
  const negative = value < 0
  const abs = Math.abs(value)
  const eok = Math.floor(abs / 10000)
  const rest = abs % 10000
  const body = eok > 0
    ? rest > 0 ? `${eok}억 ${rest.toLocaleString()}만` : `${eok}억`
    : `${rest.toLocaleString()}만`
  return negative ? `-${body}` : body
}

export function formatPriceRange(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return min === max ? formatManwon(min) : `${formatManwon(min)} ~ ${formatManwon(max)}`
  }
  if (min !== null) return formatManwon(min)
  if (max !== null) return formatManwon(max)
  return '-'
}

export function formatArea(value: number | null): string {
  if (value === null) return '-'
  return `${value}㎡`
}

export function formatDday(dday: number | null): string {
  if (dday === null) return '-'
  if (dday === 0) return 'D-DAY'
  if (dday < 0) return '마감'
  return `D-${dday}`
}

export function formatChange(value: number | null): string {
  if (value === null) return '-'
  if (value > 0) return `▲ ${value.toFixed(2)}%`
  if (value < 0) return `▼ ${Math.abs(value).toFixed(2)}%`
  return '0.00%'
}

export function formatMonth(value: string): string {
  if (!/^\d{6}$/.test(value)) return value
  return `${value.slice(0, 4)}.${value.slice(4, 6)}`
}

export function formatMonthDay(value: string | null): string {
  if (value === null) return '-'
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return '-'
  return `${Number(match[1])}/${Number(match[2])}`
}

export function formatMonthDayRange(start: string | null, end: string | null): string {
  if (start !== null && end !== null) {
    return start === end ? formatMonthDay(start) : `${formatMonthDay(start)} ~ ${formatMonthDay(end)}`
  }
  if (start !== null) return formatMonthDay(start)
  if (end !== null) return formatMonthDay(end)
  return ''
}

export function formatDateShort(value: string | null): string {
  if (value === null) return '-'
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return '-'
  return `${match[1]}.${match[2]}`
}

export function formatReceiptRange(start: string | null, end: string | null): string {
  if (start !== null && end !== null) {
    return start === end ? formatDateShort(start) : `${formatDateShort(start)} ~ ${formatDateShort(end)}`
  }
  if (start !== null) return `${formatDateShort(start)} ~`
  if (end !== null) return `~ ${formatDateShort(end)}`
  // 현재 유일한 호출부(NoticeTable.receiptCell)는 status가 unknown이 아닐 때만 이 함수를 부르고,
  // 그 경우 open/closed는 end가, upcoming은 start가 항상 있어 이 분기에 실질적으로 도달하지 않는다.
  // 그래도 start/end 둘 다 null인 입력은 타입상 유효하므로 공유 유틸의 방어적 fallback으로 남긴다.
  return '미정'
}
