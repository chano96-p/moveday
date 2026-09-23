import type { NoticeStatus } from '@/lib/dday'
import { formatDday } from '@/lib/format'

// status로 분기하고 dday는 표시용으로만 쓴다(§8). default 없는 switch로 둬서
// NoticeStatus가 늘어나면 컴파일러가 누락된 케이스를 잡게 한다(§4.1).
function labelFor(status: NoticeStatus, dday: number | null): string {
  switch (status) {
    case 'unknown':
      return '일정 미정'
    case 'closed':
      return '마감'
    case 'upcoming':
    case 'open':
      return formatDday(dday)
  }
}

function isUrgent(status: NoticeStatus, dday: number | null): boolean {
  switch (status) {
    case 'unknown':
    case 'closed':
      return false
    case 'upcoming':
    case 'open':
      return dday !== null && dday >= 0 && dday <= 3
  }
}

export function DdayBadge({ status, dday }: { status: NoticeStatus; dday: number | null }) {
  const urgent = isUrgent(status, dday)
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs tabular-nums ${
        urgent ? 'bg-urgent text-white' : 'border border-border bg-canvas text-ink-muted'
      }`}
    >
      {labelFor(status, dday)}
    </span>
  )
}
