import { differenceInCalendarDays, parseISO } from 'date-fns'
import { todayInSeoul } from '@/lib/dday'
import { formatMonthDay, formatMonthDayRange } from '@/lib/format'
import type { ReceiptArea, ReceiptWindow } from '@/lib/types'
import type { NoticeDetailResponse } from '@/hooks/useNoticeDetail'

const AREA_ORDER: ReceiptArea[] = ['corresponding', 'etcGyeonggi', 'etcArea']
const AREA_LABEL: Record<ReceiptArea, string> = {
  corresponding: '해당',
  etcGyeonggi: '기타경기',
  etcArea: '기타',
}

// 존재하는 윈도우만 그린다(§9) — 여기 순서가 곧 렌더 순서다.
// `all`은 여기 없다 — "전체 접수기간"이라 별도 단계가 아니라 폴백이다(팀 리드 확정, 아래 참조).
const RECEIPT_STEP_ORDER: { kind: ReceiptWindow['kind']; label: string }[] = [
  { kind: 'special', label: '특별공급' },
  { kind: 'first', label: '1순위' },
  { kind: 'second', label: '2순위' },
  { kind: 'general', label: '일반공급' },
]

interface Step {
  key: string
  label: string
  dateText: string
  breakdown: string | null
  isPast: boolean
}

function isPast(date: string | null, today: Date): boolean {
  if (date === null) return false
  return differenceInCalendarDays(parseISO(date), today) < 0
}

// 1순위·2순위는 거주지역(해당/기타경기/기타)별로 갈리므로 한 단계로 접고
// 그 아래 보조표기로 분해한다(§9): "1순위 9/28 ~ 9/29" + "해당 9/28 · 기타경기 9/29".
function buildStep(windows: ReceiptWindow[], label: string, key: string, today: Date): Step {
  const starts = windows.map((w) => w.start).filter((v): v is string => v !== null)
  const ends = windows.map((w) => w.end).filter((v): v is string => v !== null)
  const start = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null
  const end = ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null

  const breakdown = AREA_ORDER.map((area) => {
    const w = windows.find((x) => x.area === area)
    if (!w) return null
    const text = formatMonthDayRange(w.start, w.end)
    return text ? `${AREA_LABEL[area]} ${text}` : null
  }).filter((v): v is string => v !== null)

  return {
    key,
    label,
    dateText: formatMonthDayRange(start, end),
    breakdown: breakdown.length ? breakdown.join(' · ') : null,
    // 종료일이 없으면 마감 판정 불가(§4.1) — start로 대체하면 접수중일 수 있는 단계를
    // 끝난 것으로 표시한다. 단일 날짜(start===end) 단계는 end가 채워져 있어 영향 없다.
    isPast: isPast(end, today),
  }
}

// `kind: 'all'`은 유형마다 의미가 다르다 — REMNDR/OPT는 구체적 윈도우(special/general 등)와
// 나란히 존재해 그대로 그리면 같은 단계가 두 번 나오고, URBTY_OFCTL/PBL_PVT_RENT는 `all`이
// 유일한 윈도우라 버리면 접수 단계가 사라진다(팀 리드 확정). → 구체적 윈도우가 하나라도 있으면
// `all`은 렌더하지 않고, 하나도 없을 때만 `all`을 "청약접수" 단계로 폴백해 그린다.
function buildReceiptSteps(receipt: ReceiptWindow[], today: Date): Step[] {
  const specific = RECEIPT_STEP_ORDER.flatMap(({ kind, label }) => {
    const windows = receipt.filter((w) => w.kind === kind)
    return windows.length ? [buildStep(windows, label, kind, today)] : []
  })
  if (specific.length > 0) return specific

  const allWindows = receipt.filter((w) => w.kind === 'all')
  return allWindows.length ? [buildStep(allWindows, '청약접수', 'all', today)] : []
}

export function ScheduleTimeline({ notice }: { notice: NoticeDetailResponse['notice'] }) {
  const today = todayInSeoul()
  const steps: Step[] = []

  if (notice.noticeDate !== null) {
    steps.push({
      key: 'notice',
      label: '모집공고',
      dateText: formatMonthDay(notice.noticeDate),
      breakdown: null,
      isPast: isPast(notice.noticeDate, today),
    })
  }

  steps.push(...buildReceiptSteps(notice.receipt, today))

  if (notice.winnerDate !== null) {
    steps.push({
      key: 'winner',
      label: '당첨발표',
      dateText: formatMonthDay(notice.winnerDate),
      breakdown: null,
      isPast: isPast(notice.winnerDate, today),
    })
  }

  if (notice.contractStart !== null || notice.contractEnd !== null) {
    steps.push({
      key: 'contract',
      label: '계약',
      dateText: formatMonthDayRange(notice.contractStart, notice.contractEnd),
      breakdown: null,
      // 종료일 없으면 판정 불가(§4.1) — 위 receipt 단계와 같은 원칙.
      isPast: isPast(notice.contractEnd, today),
    })
  }

  if (steps.length === 0) return null

  // 지난 단계 다음에 오는 첫 단계가 "현재"다 — 디자인의 강조된 노드(Figma 4:152).
  const currentIndex = steps.findIndex((step) => !step.isPast)

  return (
    <section aria-label="청약 일정" className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-lg font-bold text-ink">청약 일정</h2>
      <ol className="mt-5 space-y-5">
        {steps.map((step, index) => {
          const current = index === currentIndex
          return (
            <li key={step.key} className={`flex gap-4 ${step.isPast ? 'opacity-40' : ''}`}>
              <span className="mt-1.5 flex size-4 shrink-0 items-center justify-center" aria-hidden>
                <span
                  className={`rounded-full ${current ? 'size-3 bg-brand' : 'size-2.5 bg-ink-muted'}`}
                />
              </span>
              <div className="min-w-0">
                <p className={`text-[13px] font-medium ${current ? 'text-brand' : 'text-ink-muted'}`}>
                  {step.label}
                  {current && ' (현재)'}
                </p>
                <p className="text-[15px] font-semibold tabular-nums text-ink">{step.dateText}</p>
                {step.breakdown && (
                  <p className="mt-0.5 text-xs tabular-nums text-ink-muted">{step.breakdown}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
