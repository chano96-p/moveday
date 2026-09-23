import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "moveday",
  description: "지금 접수 중인 청약 공고와 마감 일정을 한눈에 보는 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <header className="border-b border-border bg-surface">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/" className="font-semibold text-ink">
                moveday
              </Link>
              <Link href="/score" className="text-sm text-ink-muted hover:text-ink">
                가점 계산기
              </Link>
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
