'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { NOTICE_TYPE_LABEL } from '@/lib/config'
import { formatArea, formatPriceRange, formatMonthDayRange } from '@/lib/format'
import { useNoticeDetail } from '@/hooks/useNoticeDetail'
import { DdayBadge } from './DdayBadge'
import { FavoriteStar } from './FavoriteStar'
import type { NoticeRow } from '@/hooks/useNotices'

const PAGE_SIZE = 10

export type NoticeSort = 'deadline' | 'newest'

const SORT_LABEL: Record<NoticeSort, string> = {
  deadline: '마감일순',
  newest: '공고일순',
}

// null-last를 명시한다 — 안 하면 브라우저별로 튄다(§8).
function compareNullLast(a: string | null, b: string | null, desc = false): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return desc ? b.localeCompare(a) : a.localeCompare(b)
}

function sortNotices(rows: NoticeRow[], sort: NoticeSort): NoticeRow[] {
  return [...rows].sort((a, b) =>
    sort === 'deadline'
      ? compareNullLast(a.receiptEnd, b.receiptEnd)
      : compareNullLast(a.noticeDate, b.noticeDate, true),
  )
}

export function NoticeList({
  notices,
  isLoading,
  resetKey,
}: {
  notices: NoticeRow[]
  isLoading: boolean
  resetKey: string
}) {
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<NoticeSort>('deadline')
  const sorted = useMemo(() => sortNotices(notices, sort), [notices, sort])
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = sorted.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  // 필터나 정렬이 바뀌면 1페이지로 되돌린다 — 안 하면 이전 조건에서 보던 페이지 번호가 그대로
  // 남아 "이전" 버튼이 여러 번 눌러야 반응하는 것처럼 보인다. `notices` 배열 참조가 아니라
  // 조건의 정체성으로 판단한다 — 관심 탭은 `.filter()`가 매 렌더 새 배열을 만든다.
  useEffect(() => {
    setPage(0)
  }, [resetKey, sort])

  return (
    <section aria-label="청약 공고 목록">
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-[15px] font-bold text-ink">
          맞춤 청약 공고 <span className="tabular-nums">{sorted.length.toLocaleString()}</span>건
        </h2>
        <label className="flex items-center gap-1 text-[13px] text-ink-sub">
          <span className="sr-only">정렬 기준</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as NoticeSort)}
            className="cursor-pointer bg-transparent font-medium text-ink-sub focus:outline-none"
          >
            {(Object.keys(SORT_LABEL) as NoticeSort[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && <p className="py-8 text-center text-ink-muted">불러오는 중…</p>}
      {!isLoading && sorted.length === 0 && (
        <p className="rounded-card border border-border bg-surface py-12 text-center text-ink-muted">
          조건에 맞는 공고가 없습니다.
        </p>
      )}

      <ul className="space-y-4">
        {pageRows.map((notice) => (
          <li key={notice.id}>
            <NoticeCard notice={notice} />
          </li>
        ))}
      </ul>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-4 py-6">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            className="text-sm text-ink-sub disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-sm tabular-nums text-ink-muted">
            {currentPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage === pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
            className="text-sm text-ink-sub disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </section>
  )
}

/** 공고 카드(Figma `Announcement Card` 8:79). */
function NoticeCard({ notice }: { notice: NoticeRow }) {
  const href = `/notices/${notice.id}?type=${notice.type}`

  return (
    <article className="rounded-card border border-border bg-surface p-6 transition-colors hover:border-brand">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-chip bg-brand-tint px-2 py-1 text-[11px] font-bold text-brand">
              {NOTICE_TYPE_LABEL[notice.type]}
            </span>
            <span className="text-[13px] font-medium text-ink-sub">{notice.region ?? '지역 미정'}</span>
          </div>
          {/* 카드 전체가 아니라 제목만 링크다 — 카드에 onClick을 걸면 관심 버튼 클릭까지
              같이 잡혀 stopPropagation을 여기저기 흩어야 한다. */}
          <Link href={href} className="mt-2 block truncate text-lg font-bold text-ink hover:underline">
            {notice.houseName}
          </Link>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <DdayBadge status={notice.status} dday={notice.dday} />
          <span className="text-xs font-medium tabular-nums text-ink-sub">
            접수: {formatMonthDayRange(notice.receiptStart, notice.receiptEnd)}
          </span>
        </div>
      </div>

      <div className="my-4 h-px bg-border" />

      <div className="flex items-center justify-between gap-4">
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          <Chip label="세대수" value={notice.totalUnits !== null ? `${notice.totalUnits.toLocaleString()}세대` : null} />
          <SupplyChips id={notice.id} type={notice.type} />
        </dl>
        <FavoriteStar id={notice.id} />
      </div>
    </article>
  )
}

// 값이 없으면 칩 자체를 렌더하지 않는다 — OPT Mdl은 SUPLY_AR 필드가 아예 없어서
// 공급면적이 구조적으로 null이다(§4.3 — 환산 추정은 하지 않는다). "-"를 줄줄이 늘어놓는
// 것보다 없는 축을 지우는 쪽이 읽힌다(§4.4와 같은 원칙).
function Chip({ label, value }: { label: string; value: string | null }) {
  if (value === null) return null
  return (
    <div className="flex items-center gap-1.5">
      <dt className="font-medium text-ink-muted">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink-sub">{value}</dd>
    </div>
  )
}

/**
 * 공급면적·분양가는 목록 응답에 없고 상세(Mdl)에만 있다(§4.1) — 화면에 보이는 행만
 * 지연 조회한다. 실패는 에러가 아니라 `-`로 끝난다.
 */
function SupplyChips({ id, type }: { id: string; type: NoticeRow['type'] }) {
  const { data, isLoading, isError } = useNoticeDetail(id, type)

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-4 w-40 animate-pulse rounded bg-border" />
      </div>
    )
  }
  if (isError || !data) return null

  const areas = data.supply.map((row) => row.area.value).filter((v): v is number => v !== null)
  const areaRange =
    areas.length === 0 ? null : `${formatArea(Math.min(...areas))} ~ ${formatArea(Math.max(...areas))}`
  const price = formatPriceRange(data.notice.minPrice, data.notice.maxPrice)

  return (
    <>
      <Chip label={data.supply[0]?.area.kind === 'exclusive' ? '전용면적' : '공급면적'} value={areaRange} />
      <Chip label="분양가" value={price === '-' ? null : price} />
    </>
  )
}
