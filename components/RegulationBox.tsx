import type { NoticeDetailResponse } from '@/hooks/useNoticeDetail'

/**
 * 규제·자격 안내(Figma `section-requirements` 4:125 / `Requirement Item` 8:249).
 *
 * 디자인 원문은 "일반공급 자격 요건"으로 청약통장 가입기간·거주요건·세대주 조건을 적어뒀지만
 * **청약홈 API에 그 필드가 없다.** 공고마다 다른 값이라 하드코딩하면 틀린 정보가 된다(§4.0).
 * 그래서 우리가 실제로 가진 규제 플래그(APT Detail의 Y/N 8종)를 같은 칩+줄 형식으로 보여주고,
 * 나머지 자격 요건은 공고문에서 확인하도록 링크로 넘긴다 — 규제 정보가 이미 쓰던 방식이다(§9).
 */
export function RegulationBox({
  regulation,
  noticeUrl,
}: {
  regulation: NoticeDetailResponse['regulation']
  noticeUrl: string | null
}) {
  // APT 외 유형은 Detail에 규제 필드가 전무해 available이 false다(§9) — 섹션째 숨긴다.
  if (!regulation.available) return null

  return (
    <section aria-label="규제 및 자격 요건">
      <h2 className="mb-5 text-xl font-bold text-ink">규제 및 자격 요건</h2>
      <div className="rounded-card border border-border bg-surface px-6 py-2">
        {regulation.flags.length > 0 ? (
          <ul>
            {regulation.flags.map((flag, index) => (
              <li
                key={flag.key}
                className={`flex flex-wrap items-center gap-3 py-4 ${index > 0 ? 'border-t border-border' : ''}`}
              >
                <span className="rounded-chip bg-brand-tint px-2 py-1 text-xs font-bold text-brand">적용</span>
                <span className="text-[15px] font-medium text-ink">{flag.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-[15px] text-ink-sub">해당하는 규제가 없습니다.</p>
        )}
        <p className="border-t border-border py-4 text-[13px] text-ink-muted">
          {regulation.note}
          {noticeUrl && (
            <>
              {' '}
              <a
                href={noticeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand hover:underline"
              >
                공고문 원문 보기 ↗
              </a>
            </>
          )}
        </p>
      </div>
    </section>
  )
}
