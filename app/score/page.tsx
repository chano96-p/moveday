'use client'

import { useEffect, useRef, useState } from 'react'
import { useScore } from '@/hooks/useScore'
import { SCORE_MAX, calcScore, type ScoreInput } from '@/lib/score'

type ScoreForm = Record<keyof ScoreInput, string>

const EMPTY_FORM: ScoreForm = { noHouseYears: '', dependents: '', accountMonths: '' }

/**
 * 표시용 정규화. 숫자만 남기고 **앞자리 0을 지운다** — 값을 문자열로 들고 있어서 "0"이 있는
 * 칸에 이어 치면 "03"이 된다(사용자 신고). 값이 0 하나뿐이면 그대로 둔다.
 */
function normalizeDigits(raw: string): string {
  return raw.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '')
}

// 빈 칸·음수·비숫자는 0으로 본다 — HTML5 `min`은 타이핑된 값을 막지 못한다.
function toNumber(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function toInput(form: ScoreForm): ScoreInput {
  return {
    noHouseYears: toNumber(form.noHouseYears),
    dependents: toNumber(form.dependents),
    accountMonths: toNumber(form.accountMonths),
  }
}

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
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-[15px] font-bold text-ink">{label}</span>
        <span className="text-[13px] font-medium text-ink-muted">{hint}</span>
      </span>
      <span className="mt-2 flex items-center justify-between gap-3 rounded-field border border-border bg-field px-4 py-3">
        {/* 값을 문자열로 들고 있다 — 숫자 state를 그대로 value로 쓰면 빈 칸이 0으로 되돌아가
            "0을 지우고 입력"이 안 된다. 숫자로 바꾸는 것은 점수 계산 직전에만 한다. */}
        <input
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(normalizeDigits(e.target.value))}
          className="w-full min-w-0 bg-transparent text-[15px] font-semibold tabular-nums text-ink placeholder:text-ink-muted focus:outline-none"
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
  const [form, setForm] = useState<ScoreForm>(EMPTY_FORM)

  // useFavorites()와 같은 이유로 저장된 값은 마운트 후에만 읽는다(하이드레이션 불일치 방지) —
  // loaded가 true가 되는 시점에 한 번만 폼을 채운다.
  // 저장된 값은 **최초 1회만** 폼에 채운다. 매번 동기화하면 한 칸을 고칠 때마다 save가
  // input을 바꿔 effect가 다시 돌고, 방금 비운 칸이 "0"으로 되살아난다(사용자 신고).
  const hydrated = useRef(false)
  useEffect(() => {
    if (hydrated.current || !loaded) return
    hydrated.current = true
    if (!input) return
    // 0은 빈 칸으로 되살린다 — "0"을 찍어두면 그 칸에 이어 칠 때마다 같은 문제가 돌아온다.
    // 빈 칸은 placeholder "0"으로 보이고 점수도 0으로 쳐서 의미가 달라지지 않는다.
    const show = (value: number) => (value === 0 ? '' : String(value))
    setForm({
      noHouseYears: show(input.noHouseYears),
      dependents: show(input.dependents),
      accountMonths: show(input.accountMonths),
    })
  }, [loaded, input])

  function update(next: Partial<ScoreForm>) {
    const merged = { ...form, ...next }
    setForm(merged)
    save(toInput(merged))
  }

  const result = calcScore(toInput(form))
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
          {/* 눈금 양 끝만 둔다 — 가운데에 "8 / 84점"을 또 쓰면 위의 "총점 8점"과 오른쪽
              "84점"을 합쳐 같은 숫자가 두 번씩 보인다. */}
          <div className="mt-2 flex justify-between text-xs font-medium tabular-nums text-brand">
            <span>0점</span>
            <span>{SCORE_MAX.total}점</span>
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
