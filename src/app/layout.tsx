import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Geist was here because create-next-app put it here, and it has no Thai glyphs at all — every
// Thai character in this Thai-first app was silently falling back to whatever the OS offered,
// which is why the same page looked different on Windows and macOS. Plex Sans Thai is drawn as one
// family across both scripts, so a Thai sentence and the English beside it finally share a voice.
//
// The two variables are named for the faces, not for the roles: Tailwind's own theme keys are
// --font-sans and --font-mono, and pointing those at themselves (--font-sans: var(--font-sans))
// left the cascade to decide which definition won. globals.css builds the role stacks out of these.
const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});

// Every number, cell address and formula on the site is set in this: a spreadsheet is a grid, and
// figures that don't line up in a column read as decoration rather than as data.
//
// It carries no Thai at all, so it is never the whole story — see the --font-mono stack in
// globals.css, which hands Thai on to Plex Sans Thai rather than to the system's default.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      className={`${plexThai.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
