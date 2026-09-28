'use client'

import { useAnalysis } from '@/hooks/useAnalysis'
import { VERDICT_LABEL, type NoticeAnalysis } from '@/lib/analysis/schema'
import type { NoticeType } from '@/lib/types'

const VERDICT_STYLE: Record<NoticeAnalysis['verdict'], string> = {
  competitive: 'bg-urgent-tint text-urgent',
  moderate: 'bg-field text-ink-sub',
  accessible: 'bg-brand-tint text-brand',
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="AI 분석">
      <h2 className="mb-5 text-xl font-bold text-ink">AI 분석</h2>
      <div className="rounded-card border border-border bg-surface p-6">{children}</div>
    </section>
  )
}

/**
 * 공고 하나를 Gemini에 넘겨 읽어주는 섹션(§13). **버튼을 눌러야만** 호출한다 —
 * 무료 티어 한도가 방문 수가 아니라 실제 관심 수만큼만 쓰이게 하려는 것이다.
 */
export function AISection({ id, type }: { id: string; type: NoticeType }) {
  const { data, error, isFetching, refetch } = useAnalysis(id, type)

  const code = error instanceof Error ? error.message : ''

  // 키가 없으면 섹션째 숨긴다 — 지도·시세가 키 없을 때 타는 경로와 같다(§5).
  if (code === 'ANALYSIS_KEY_MISSING') return null

  if (isFetching) {
    return (
      <Section>
        <p className="py-6 text-center text-sm text-ink-muted">공고를 읽는 중…</p>
      </Section>
    )
  }

  if (error) {
    const message =
      code === 'ANALYSIS_RATE_LIMITED'
        ? '분당 호출 한도에 걸렸습니다. 1분 뒤 다시 시도해 주세요.'
        : code === 'ANALYSIS_UNAVAILABLE'
          ? '모델이 혼잡합니다. 잠시 후 다시 시도해 주세요.'
          : '분석을 만들지 못했습니다.'
    return (
      <Section>
        <div className="py-6 text-center">
          <p className="text-sm text-ink-sub">{message}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-field border border-border px-4 py-2 text-sm font-semibold text-ink-sub hover:bg-field"
          >
            다시 시도
          </button>
        </div>
      </Section>
    )
  }

  if (!data) {
    return (
      <Section>
        <div className="py-6 text-center">
          <p className="text-[15px] text-ink-sub">
            일정·공급·경쟁률·지역 시세를 한 번에 읽어 요약해 드립니다.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-field bg-brand px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
          >
            AI 분석 보기
          </button>
        </div>
      </Section>
    )
  }

  const { analysis, inputs } = data

  return (
    <Section>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-chip px-2 py-1 text-xs font-bold ${VERDICT_STYLE[analysis.verdict]}`}>
          {VERDICT_LABEL[analysis.verdict]}
        </span>
        <p className="text-[17px] font-bold text-ink">{analysis.headline}</p>
      </div>

      <ul className="mt-5 space-y-2">
        {analysis.reasons.map((reason) => (
          <li key={reason} className="flex gap-2 text-[15px] leading-relaxed text-ink-sub">
            <span aria-hidden className="text-ink-muted">
              ·
            </span>
            {reason}
          </li>
        ))}
      </ul>

      <p className="mt-5 border-t border-border pt-5 text-[15px] leading-relaxed text-ink-sub">
        {analysis.priceContext}
      </p>

      {analysis.cautions.length > 0 && (
        <ul className="mt-5 space-y-2 rounded-field bg-urgent-tint p-4">
          {analysis.cautions.map((caution) => (
            <li key={caution} className="text-[14px] leading-relaxed text-urgent">
              {caution}
            </li>
          ))}
        </ul>
      )}

      {/* 어떤 재료로 쓴 글인지 밝힌다 — 경쟁률이 아직 없는 공고의 분석을 발표 후 분석과
          같은 무게로 읽으면 곤란하다. */}
      <p className="mt-5 text-[13px] leading-relaxed text-ink-muted">
        {data.model} 생성 · 입력: 공고 상세{inputs.competition && ' · 경쟁률'}
        {inputs.market && ' · 지역 시세'}
        <br />
        참고용 요약입니다. 청약 자격과 일정은 공고문을 확인하세요.
      </p>
    </Section>
  )
}
