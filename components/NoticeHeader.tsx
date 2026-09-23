import { DdayBadge } from './DdayBadge'
import type { NoticeDetailResponse } from '@/hooks/useNoticeDetail'

export function NoticeHeader({ notice }: { notice: NoticeDetailResponse['notice'] }) {
  return (
    <header className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <span>{notice.region ?? '-'}</span>
        {notice.totalUnits !== null && <span className="tabular-nums">총 {notice.totalUnits.toLocaleString()}세대</span>}
      </div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-ink">{notice.houseName}</h1>
        <DdayBadge status={notice.status} dday={notice.dday} />
      </div>
    </header>
  )
}
