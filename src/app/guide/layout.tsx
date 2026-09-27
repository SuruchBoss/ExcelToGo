// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";

// The page itself is a client component (it follows the reader's language choice), so its title
// lives here. Thai, like the root layout's, because that is the language a first visit arrives in.
export const metadata: Metadata = {
  title: "คู่มือต่อข้อมูลของคุณเอง",
  description: "ต่อ REST API, CSV, PostgreSQL หรือ MySQL ของคุณเองเข้ากับ ExcelToGo ทีละขั้น พร้อมคำสั่งที่คัดลอกได้",
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
