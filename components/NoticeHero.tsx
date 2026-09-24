import Link from 'next/link'
import { NOTICE_TYPE_LABEL } from '@/lib/config'
import { DdayBadge } from './DdayBadge'
import type { NoticeDetailResponse } from '@/hooks/useNoticeDetail'

const STATUS_LABEL: Record<NoticeDetailResponse['notice']['status'], string> = {
  upcoming: '접수예정',
  open: '접수중',
  closed: '마감',
  unknown: '일정 미정',
}

/** 브레드크럼 + 히어로 배너(Figma `breadcrumbs` 4:86 / `hero-banner` 4:90). */
export function NoticeHero({ notice }: { notice: NoticeDetailResponse['notice'] }) {
  const open = notice.status === 'open'

  return (
    <div className="space-y-5">
      <nav aria-label="탐색 경로" className="flex items-center gap-2 text-[13px]">
        <Link href="/" className="text-ink-muted hover:text-ink">
          전체 공고
        </Link>
        <span aria-hidden className="text-ink-muted">
          ›
        </span>
        <span className="font-semibold text-ink">{notice.houseName}</span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-4 rounded-hero border border-border bg-surface p-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-chip bg-brand-tint px-2 py-1 text-xs font-bold text-brand">
              {NOTICE_TYPE_LABEL[notice.type]}
            </span>
            <span className="text-[15px] font-medium text-ink-sub">{notice.address ?? notice.region ?? '-'}</span>
          </div>
          <h1 className="mt-3 text-[28px] font-extrabold leading-tight text-ink">{notice.houseName}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {/* 접수중일 때만 상태 배지를 세운다 — 마감·예정은 D-day 배지가 이미 같은 말을 한다. */}
          {open && (
            <span className="rounded-field bg-urgent-tint px-4 py-2 text-sm font-bold text-urgent">
              {STATUS_LABEL[notice.status]}
            </span>
          )}
          <DdayBadge status={notice.status} dday={notice.dday} size="md" />
        </div>
      </header>
    </div>
  )
}
