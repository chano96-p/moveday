/** 청약홈 접수 버튼(Figma `apply-cta` 4:170). 공고문 URL이 없으면 렌더하지 않는다. */
export function ApplyCta({ noticeUrl }: { noticeUrl: string | null }) {
  if (!noticeUrl) return null

  return (
    <a
      href={noticeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 rounded-cell bg-brand px-6 py-4 text-base font-bold text-white transition-opacity hover:opacity-90"
    >
      청약홈에서 접수하기
      <span aria-hidden>↗</span>
    </a>
  )
}
