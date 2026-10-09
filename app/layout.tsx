import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avanti OS · Lễ tân",
  description: "Hệ thống quản lý khách sạn Avanti: đặt phòng, check-in/out, folio, sơ đồ phòng, giao ca",
};

export const viewport: Viewport = {
  themeColor: "#171512",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
