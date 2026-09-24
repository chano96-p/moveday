'use client'

import { useEffect, useState } from 'react'
import { useScore } from '@/hooks/useScore'
import { SCORE_MAX, calcScore, type ScoreInput } from '@/lib/score'

const DEFAULT_INPUT: ScoreInput = { noHouseYears: 0, dependents: 0, accountMonths: 0 }

/** 입력 한 줄(Figma `Input Row` 8:192) — 라벨 + 산정 기준 힌트 + 값·점수. */
function InputRow({
  label,
  hint,
  unit,
  score,
  value,
  onChange,
}: {
  label: string
  hint: string
  unit: string
  score: number
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-[15px] font-bold text-ink">{label}</span>
        <span className="text-[13px] font-medium text-ink-muted">{hint}</span>
      </span>
      <span className="mt-2 flex items-center justify-between gap-3 rounded-field border border-border bg-field px-4 py-3">
        <input
          type="number"
          min={0}
          value={value}
          // HTML5 `min`은 타이핑된 값을 막지 못한다 — 여기서 걸러야 음수 입력이 점수로 안 간다.
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="w-full min-w-0 bg-transparent text-[15px] font-semibold tabular-nums text-ink focus:outline-none"
        />
        <span className="shrink-0 text-sm font-medium tabular-nums text-ink-sub">
          {unit} ({score}점)
        </span>
      </span>
    </label>
  )
}

export default function ScorePage() {
  const { input, save, loaded } = useScore()
  const [form, setForm] = useState<ScoreInput>(DEFAULT_INPUT)

  // useFavorites()와 같은 이유로 저장된 값은 마운트 후에만 읽는다(하이드레이션 불일치 방지) —
  // loaded가 true가 되는 시점에 한 번만 폼을 채운다.
  useEffect(() => {
    if (loaded && input) setForm(input)
  }, [loaded, input])

  function update(next: Partial<ScoreInput>) {
    const merged = { ...form, ...next }
    setForm(merged)
    save(merged)
  }

  const result = calcScore(form)
  const percent = Math.round((result.total / SCORE_MAX.total) * 100)

  const breakdown: { label: string; score: number; max: number }[] = [
    { label: '무주택기간', score: result.breakdown.noHouse, max: SCORE_MAX.noHouse },
    { label: '부양가족수', score: result.breakdown.dependents, max: SCORE_MAX.dependents },
    { label: '청약통장 가입기간', score: result.breakdown.account, max: SCORE_MAX.account },
  ]

  return (
    <main className="mx-auto max-w-[480px] space-y-8 px-6 py-16">
      <header className="text-center">
        <h1 className="text-[28px] font-extrabold text-ink">가점 계산기</h1>
        <p className="mt-2 text-[15px] text-ink-sub">청약 가점 항목별 점수를 확인하세요</p>
      </header>

      <div className="space-y-6 rounded-hero border border-border bg-surface p-8">
        <InputRow
          label="무주택기간"
          hint="만 30세 이후부터 산정"
          unit="년"
          score={result.breakdown.noHouse}
          value={form.noHouseYears}
          onChange={(v) => update({ noHouseYears: v })}
        />
        <InputRow
          label="부양가족수"
          hint="본인 제외"
          unit="명"
          score={result.breakdown.dependents}
          value={form.dependents}
          onChange={(v) => update({ dependents: v })}
        />
        <InputRow
          label="청약통장 가입기간"
          hint="가입일부터 산정"
          unit="개월"
          score={result.breakdown.account}
          value={form.accountMonths}
          onChange={(v) => update({ accountMonths: v })}
        />
      </div>

      <section
        aria-label="가점 계산 결과"
        className="space-y-6 rounded-hero border border-brand bg-brand-tint p-8"
      >
        <div className="text-center text-brand">
          <p className="text-sm font-bold">나의 청약 가점</p>
          <p className="text-4xl font-extrabold tabular-nums">총점 {result.total}점</p>
        </div>

        <div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-surface"
            role="progressbar"
            aria-valuenow={result.total}
            aria-valuemin={0}
            aria-valuemax={SCORE_MAX.total}
            aria-label="가점 총점"
          >
            <div className="h-full bg-brand transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs tabular-nums text-brand">
            <span className="font-medium">0점</span>
            <span className="font-bold">
              {result.total} / {SCORE_MAX.total}점
            </span>
            <span className="font-medium">{SCORE_MAX.total}점</span>
          </div>
        </div>

        <div className="h-px bg-brand/20" />

        <dl className="space-y-3 text-sm">
          {breakdown.map((item) => (
            <div key={item.label} className="flex justify-between">
              <dt className="font-medium text-ink-sub">{item.label}</dt>
              <dd className="font-bold tabular-nums text-ink">
                {item.score} 점 / {item.max}점 만점
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-center text-[13px] leading-relaxed text-ink-muted">
        산정 기준은 주택공급에 관한 규칙을 따릅니다.
        <br />
        <strong className="font-semibold">실제 가점은 청약홈 기준으로 확인하세요.</strong>
      </p>
    </main>
  )
}
