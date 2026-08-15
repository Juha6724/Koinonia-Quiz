import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";

import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  weight: ["400", "700", "800", "900"],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-noto-sans-kr",
  fallback: ["Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", "sans-serif"]
});

export const metadata: Metadata = {
  title: "코이노니아 스피드퀴즈",
  description: "교회 현장 이벤트를 위한 빛의 속도 스피드퀴즈 랭킹 게임"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={notoSansKr.variable}>
      <body>{children}</body>
    </html>
  );
}
