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

const SITE_URL = "https://moveday-one.vercel.app";
const DESCRIPTION = "지금 접수 중인 청약 공고와 마감 일정을 한눈에 보는 대시보드";

// metadataBase가 없으면 Next가 og:image를 상대 경로로 내보내고, 링크를 푼 쪽에서 이미지를
// 받지 못한다. 아이콘·OG 이미지 자체는 app/ 아래 파일(icon.svg, apple-icon.png,
// opengraph-image.png, twitter-image.png)을 Next가 규약으로 잡아간다.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "moveday",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "moveday",
    title: "moveday — 청약 공고 대시보드",
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "moveday — 청약 공고 대시보드",
    description: DESCRIPTION,
  },
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
