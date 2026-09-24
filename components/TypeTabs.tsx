'use client'

import { NOTICE_TYPE_LABEL } from '@/lib/config'
import type { NoticeType } from '@/lib/types'

export type DashboardTab = NoticeType | 'ALL' | 'FAVORITES'

// "탭 4종"은 유형 탭이 4개(APT/무순위·잔여/오피스텔·도시형/공공지원 민간임대)라는 뜻이다(§8).
// 임의공급(OPT)은 그 4개 중 어디에도 안 걸리므로 "전체" 탭에만 보인다.
const TABS: { key: DashboardTab; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'APT', label: NOTICE_TYPE_LABEL.APT },
  { key: 'REMNDR', label: NOTICE_TYPE_LABEL.REMNDR },
  { key: 'URBTY_OFCTL', label: NOTICE_TYPE_LABEL.URBTY_OFCTL },
  { key: 'PBL_PVT_RENT', label: NOTICE_TYPE_LABEL.PBL_PVT_RENT },
  { key: 'FAVORITES', label: '관심' },
]

export function TypeTabs({ value, onChange }: { value: DashboardTab; onChange: (tab: DashboardTab) => void }) {
  return (
    <div role="tablist" aria-label="공고 유형" className="flex gap-2 overflow-x-auto border-b border-border">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={`shrink-0 border-b-2 px-4 py-3 text-[15px] whitespace-nowrap transition-colors ${
            value === tab.key
              ? 'border-brand font-bold text-brand'
              : 'border-transparent font-medium text-ink-sub hover:text-ink'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
