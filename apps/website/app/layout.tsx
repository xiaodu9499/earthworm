import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://temporary-prompt-hawthorn-4wlj974.vercel.app"),
  title: "Earthworm Web｜英语句子肌肉训练",
  description: "无需安装的 Earthworm 独立网页版：课程、发音、音标、打字练习和本地学习进度。",
  icons: { icon: "/logo.png" },
  openGraph: {
    title: "Earthworm Web｜英语句子肌肉训练",
    description: "无需安装，打开即学。内置 126 节课程和 17,384 条英语练习。",
    images: ["/og.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Earthworm Web｜英语句子肌肉训练",
    description: "无需安装，打开即学。内置 126 节课程和 17,384 条英语练习。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
