import Link from 'next/link'
import { NOTICE_TYPE_LABEL } from '@/lib/config'
import { formatDday } from '@/lib/format'
import type { NoticeRow } from '@/hooks/useNotices'

// D-3 이내만, 최대 5장. unknown은 dday가 없어 자연히 제외된다(§8).
export function DeadlineCards({ notices }: { notices: NoticeRow[] }) {
  const cards = notices
    .filter((n) => n.dday !== null && n.dday >= 0 && n.dday <= 3)
    .sort((a, b) => (a.dday as number) - (b.dday as number))
    .slice(0, 5)

  if (cards.length === 0) return null

  return (
    <section aria-label="마감 임박 공고">
      <h2 className="mb-2 text-sm font-medium text-ink-muted">마감 임박</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((notice) => (
          <li key={notice.id} className="rounded-lg border border-border bg-surface p-3">
            <Link href={`/notices/${notice.id}?type=${notice.type}`} className="block">
              <p className="text-xs text-ink-muted">
                {NOTICE_TYPE_LABEL[notice.type]} · {notice.region ?? '-'}
              </p>
              <p className="mt-1 truncate font-medium text-ink">{notice.houseName}</p>
              <p className="mt-2 text-right tabular-nums text-urgent">{formatDday(notice.dday)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
