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

/**
 * D-day 배지(Figma `dday-badge`). 임박(D-3 이내)은 주황 틴트, 그 외는 중립이다 —
 * 디자인의 솔리드 채움 대신 틴트를 쓰는 이유는 카드 안에서 유형 배지(파랑 틴트)와
 * 같은 무게로 보여야 하기 때문이다.
 */
// 진행 중(upcoming/open)만 색을 쓴다 — 마감·일정 미정까지 브랜드 틴트를 주면 목록에서
// 전부 같은 무게로 보여 "아직 넣을 수 있는 공고"가 묻힌다.
function toneOf(status: NoticeStatus, dday: number | null): string {
  if (isUrgent(status, dday)) return 'bg-urgent-tint text-urgent'
  switch (status) {
    case 'upcoming':
    case 'open':
      return 'bg-brand-tint text-brand'
    case 'closed':
    case 'unknown':
      return 'bg-canvas text-ink-muted'
  }
}

export function DdayBadge({ status, dday, size = 'sm' }: { status: NoticeStatus; dday: number | null; size?: 'sm' | 'md' }) {
  const pad = size === 'md' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-[13px]'
  return (
    <span className={`inline-block rounded-field font-bold tabular-nums ${pad} ${toneOf(status, dday)}`}>
      {labelFor(status, dday)}
    </span>
  )
}
