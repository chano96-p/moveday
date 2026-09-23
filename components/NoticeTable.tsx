'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDateShort, formatPriceRange, formatReceiptRange } from '@/lib/format'
import { useNoticeDetail } from '@/hooks/useNoticeDetail'
import { DdayBadge } from './DdayBadge'
import { FavoriteStar } from './FavoriteStar'
import type { NoticeRow } from '@/hooks/useNotices'

const PAGE_SIZE = 10

// 마감일 정렬은 null-last로 명시한다 — 안 하면 브라우저별로 튄다(§8).
function compareByReceiptEnd(a: NoticeRow, b: NoticeRow): number {
  if (a.receiptEnd === null && b.receiptEnd === null) return 0
  if (a.receiptEnd === null) return 1
  if (b.receiptEnd === null) return -1
  return a.receiptEnd.localeCompare(b.receiptEnd)
}

function receiptCell(notice: NoticeRow): string {
  switch (notice.status) {
    case 'unknown':
      return '미정'
    case 'upcoming':
    case 'open':
    case 'closed':
      return formatReceiptRange(notice.receiptStart, notice.receiptEnd)
  }
}

export function NoticeTable({
  notices,
  isLoading,
  resetKey,
}: {
  notices: NoticeRow[]
  isLoading: boolean
  resetKey: string
}) {
  const [page, setPage] = useState(0)
  const sorted = useMemo(() => [...notices].sort(compareByReceiptEnd), [notices])
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = sorted.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  // 필터가 바뀌면 1페이지로 되돌린다 — 안 하면 이전 필터에서 보던 페이지 번호가 그대로 남아
  // "이전" 버튼이 여러 번 눌러야 반응하는 것처럼 보인다. `notices` 배열 참조가 아니라
  // 필터 정체성(resetKey)으로 판단한다 — 관심 탭은 `.filter()`가 매 렌더 새 배열을 만들어서
  // (10분 refetch마다도 포함) 배열 참조로는 필터가 안 바뀌어도 페이지가 리셋됐다.
  useEffect(() => {
    setPage(0)
  }, [resetKey])

  if (isLoading) return <p className="py-8 text-center text-ink-muted">불러오는 중…</p>
  if (sorted.length === 0) return <p className="py-8 text-center text-ink-muted">조건에 맞는 공고가 없습니다.</p>

  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-ink-muted">
            <th className="w-6 py-2"></th>
            <th className="py-2 pr-3">주택명</th>
            <th className="py-2 pr-3">지역</th>
            <th className="py-2 pr-3">공급위치</th>
            <th className="py-2 pr-3">접수기간</th>
            <th className="py-2 pr-3">D-day</th>
            <th className="py-2 pr-3">당첨발표</th>
            <th className="py-2 text-right">분양가 범위</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((notice) => (
            <NoticeRow key={notice.id} notice={notice} />
          ))}
        </tbody>
      </table>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-4 py-4">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            className="text-sm text-ink-muted disabled:opacity-40"
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
            className="text-sm text-ink-muted disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}

function NoticeRow({ notice }: { notice: NoticeRow }) {
  const router = useRouter()
  const href = `/notices/${notice.id}?type=${notice.type}`

  return (
    <tr className="cursor-pointer border-b border-border hover:bg-canvas" onClick={() => router.push(href)}>
      <td className="py-2" onClick={(event) => event.stopPropagation()}>
        <FavoriteStar id={notice.id} />
      </td>
      <td className="py-2 pr-3">
        {/* stopPropagation: 이 Link가 자체 내비게이션을 처리하므로, tr의 onClick까지
            같이 실행되면 같은 경로가 두 번 push된다(리뷰 지적). span으로 바꾸면 키보드
            접근성을 잃으므로 Link는 유지하고 버블링만 막는다. */}
        <Link href={href} className="hover:underline" onClick={(event) => event.stopPropagation()}>
          {notice.houseName}
        </Link>
      </td>
      <td className="py-2 pr-3">{notice.region ?? '-'}</td>
      <td className="py-2 pr-3 text-ink-muted">{notice.address ?? '-'}</td>
      <td className="py-2 pr-3 tabular-nums">{receiptCell(notice)}</td>
      <td className="py-2 pr-3">
        <DdayBadge status={notice.status} dday={notice.dday} />
      </td>
      <td className="py-2 pr-3 tabular-nums">{formatDateShort(notice.winnerDate)}</td>
      <td className="py-2 text-right tabular-nums">
        <PriceRangeCell id={notice.id} type={notice.type} />
      </td>
    </tr>
  )
}

function PriceRangeCell({ id, type }: { id: string; type: NoticeRow['type'] }) {
  const { data, isLoading, isError } = useNoticeDetail(id, type)

  if (isLoading) return <span className="inline-block h-4 w-24 animate-pulse rounded bg-border" />
  if (isError || !data) return <span>—</span>
  return <span>{formatPriceRange(data.notice.minPrice, data.notice.maxPrice)}</span>
}
