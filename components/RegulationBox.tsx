import type { NoticeDetailResponse } from '@/hooks/useNoticeDetail'

export function RegulationBox({ regulation }: { regulation: NoticeDetailResponse['regulation'] }) {
  // APT 외 유형은 Detail에 규제 필드가 전무해 available이 false다(§9) — 섹션째 숨긴다.
  if (!regulation.available) return null

  return (
    <section aria-label="규제 정보">
      <h2 className="mb-3 text-sm font-medium text-ink-muted">규제 정보</h2>
      {regulation.flags.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {regulation.flags.map((flag) => (
            <li key={flag.key} className="rounded-full border border-border bg-canvas px-3 py-1 text-xs text-ink">
              {flag.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">해당하는 규제가 없습니다.</p>
      )}
      <p className="mt-2 text-xs text-ink-muted">{regulation.note}</p>
    </section>
  )
}
