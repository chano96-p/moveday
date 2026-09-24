import type { Metadata } from "next";
import { Gothic_A1 } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/SiteHeader";

// 디자인이 Gothic A1을 쓴다. 숫자 자리폭이 고르지 않아 표·금액은 `tabular-nums`로 받친다(§7).
const gothicA1 = Gothic_A1({
  variable: "--font-gothic-a1",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
      <body className={`${gothicA1.variable} antialiased`}>
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
