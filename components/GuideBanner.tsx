import Link from 'next/link'

/**
 * 우측 컬럼 하단 배너(Figma `banner-guide` 3:243). 디자인 원문은 "청약 가이드"를 가리키지만
 * 그 화면이 없으므로 실제로 있는 가점 계산기로 보낸다 — 없는 곳으로 링크하지 않는다.
 * 문구도 계산기가 실제로 하는 일로 맞췄다.
 */
export function GuideBanner() {
  return (
    <section aria-label="가점 계산기 안내" className="rounded-card bg-brand p-6">
      <p className="text-base font-bold text-white">내 청약 가점은 몇 점일까요?</p>
      <p className="mt-3 text-[13px] leading-relaxed text-white/80">
        무주택기간·부양가족수·청약통장 가입기간만 넣으면 84점 만점 기준으로 바로 계산해 드립니다.
      </p>
      <Link
        href="/score"
        className="mt-3 inline-flex items-center rounded-field bg-white px-4 py-2 text-xs font-bold text-brand"
      >
        가점 계산하기
      </Link>
    </section>
  )
}
