interface Summary {
  open: number
  closingThisWeek: number
  new: number
}

const ITEMS: { key: keyof Summary; label: string }[] = [
  { key: 'open', label: '접수중' },
  { key: 'closingThisWeek', label: '이번주 마감' },
  { key: 'new', label: '신규공고' },
]

// 서버가 계산해 내려주는 summary를 그대로 표시한다. 재계산하지 않는다(§8).
export function SummaryBar({ summary }: { summary: Summary }) {
  return (
    <section aria-label="공고 현황 요약" className="grid grid-cols-3 gap-3">
      {ITEMS.map((item) => (
        <div key={item.key} className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">{item.label}</p>
          <p className="mt-1 text-right text-2xl font-semibold tabular-nums text-ink">
            {summary[item.key].toLocaleString()}건
          </p>
        </div>
      ))}
    </section>
  )
}
