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
