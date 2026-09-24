import Image from 'next/image'

interface Summary {
  open: number
  closingToday: number
  closingThisWeek: number
  new: number
}

/**
 * 상단 요약 4칸(Figma `Stat Card` 8:46). 서버가 계산해 내려주는 summary를 그대로 표시하고
 * 재계산하지 않는다(§8) — 관심만 클라이언트 전용이라 개수를 받아 쓴다.
 */
export function StatCards({ summary, favoriteCount }: { summary: Summary; favoriteCount: number }) {
  const items: { label: string; value: number }[] = [
    { label: '진행 중인 공고', value: summary.open },
    { label: '오늘 마감', value: summary.closingToday },
    { label: '이번 주 신규', value: summary.new },
    { label: '관심 공고', value: favoriteCount },
  ]

  return (
    <section aria-label="공고 현황 요약" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-4 rounded-card border border-border bg-surface p-6"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-cell bg-brand-tint">
            <Image src="/icons/briefcase.svg" alt="" width={24} height={24} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink-sub">{item.label}</p>
            <p className="text-[22px] font-bold tabular-nums text-ink">{item.value.toLocaleString()} 건</p>
          </div>
        </div>
      ))}
    </section>
  )
}
