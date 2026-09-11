import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ExcelToGo — ตารางแบบ Excel ที่ไม่ต้องจำสูตร",
    template: "%s · ExcelToGo",
  },
  description:
    "ตารางกรอกข้อมูลแบบ Excel พร้อมสูตรลากวางแทนการจำ syntax, ผู้ช่วย AI แนะนำสูตรจากคำถามภาษาคน และข้อมูลสดจาก API/CSV ที่อัปเดตเองในเซลล์",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
