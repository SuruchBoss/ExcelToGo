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
    default: "ExcelToGo — เปิดไฟล์ Excel แล้วคำนวณต่อได้ในเบราว์เซอร์",
    template: "%s · ExcelToGo",
  },
  // This is the line that shows in search results and link previews, so it says what the app does
  // rather than what problem it set out to solve.
  description:
    "เปิดไฟล์ .xlsx ในเบราว์เซอร์แล้วคำนวณต่อได้เลย ไม่ต้องติดตั้ง ไม่ต้องสมัครสมาชิก — หน้าตาไฟล์ยังเหมือนเดิม เลือกสูตรจากรายการแทนการจำ และถาม AI เป็นภาษาคนได้",
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
