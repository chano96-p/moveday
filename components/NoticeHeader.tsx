import { DdayBadge } from './DdayBadge'
import { ScoreBadge } from './ScoreBadge'
import type { NoticeDetailResponse } from '@/hooks/useNoticeDetail'
import type { SupplyRow } from '@/lib/types'

export function NoticeHeader({ notice, supply }: { notice: NoticeDetailResponse['notice']; supply: SupplyRow[] }) {
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
      <ScoreBadge supply={supply} />
    </header>
  )
}
