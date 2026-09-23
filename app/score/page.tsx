'use client'

import { useEffect, useState } from 'react'
import { useScore } from '@/hooks/useScore'
import { calcScore, type ScoreInput } from '@/lib/score'

const DEFAULT_INPUT: ScoreInput = { noHouseYears: 0, dependents: 0, accountMonths: 0 }

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm text-ink">
      <span className="text-ink-muted">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        className="w-24 rounded border border-border bg-surface px-2 py-1 text-right tabular-nums"
      />
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

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <h1 className="text-lg font-semibold text-ink">가점 계산기</h1>

      <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <NumberField label="무주택기간(년)" value={form.noHouseYears} onChange={(v) => update({ noHouseYears: v })} />
        <NumberField label="부양가족수(명)" value={form.dependents} onChange={(v) => update({ dependents: v })} />
        <NumberField
          label="청약통장 가입기간(개월)"
          value={form.accountMonths}
          onChange={(v) => update({ accountMonths: v })}
        />
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-muted">총점</span>
          <span className="text-2xl font-semibold tabular-nums text-ink">{result.total}점</span>
        </div>
        <dl className="space-y-1 text-sm text-ink-muted">
          <div className="flex justify-between">
            <dt>무주택기간</dt>
            <dd className="tabular-nums">{result.breakdown.noHouse}점</dd>
          </div>
          <div className="flex justify-between">
            <dt>부양가족수</dt>
            <dd className="tabular-nums">{result.breakdown.dependents}점</dd>
          </div>
          <div className="flex justify-between">
            <dt>청약통장 가입기간</dt>
            <dd className="tabular-nums">{result.breakdown.account}점</dd>
          </div>
        </dl>
      </div>

      <p className="text-xs text-ink-muted">
        산정 기준은 주택공급에 관한 규칙을 따릅니다.
        <br />
        <strong>실제 가점은 청약홈 기준으로 확인하세요.</strong>
      </p>
    </main>
  )
}
