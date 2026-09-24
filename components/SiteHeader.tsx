import Image from 'next/image'
import Link from 'next/link'

/** 전역 헤더(Figma `Header` 8:3). 높이 72px 고정, 좌우 여백 80px. */
export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-6 xl:px-20">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icons/building.svg" alt="" width={24} height={24} aria-hidden />
          <span className="text-xl font-extrabold text-brand">moveday</span>
        </Link>
        <nav className="flex items-center gap-8">
          <Link href="/score" className="flex items-center gap-1.5 text-sm font-semibold text-ink-sub hover:text-ink">
            <Image src="/icons/calculator.svg" alt="" width={16} height={16} aria-hidden />
            가점 계산기
          </Link>
        </nav>
      </div>
    </header>
  )
}
