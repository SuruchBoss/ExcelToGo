/**
 * The Thai font the PDF export embeds.
 *
 * jsPDF ships only the fourteen standard PDF fonts, and not one of them contains a Thai vowel or
 * tone mark. Every Thai label in an exported sheet therefore came out as unrelated Latin glyphs —
 * in an app whose whole point is Thai spreadsheets. Nothing short of embedding a font fixes it.
 *
 * Fetched at export time from `public/`, not imported: a 45KB font base64-encoded into the bundle
 * is 60KB every visitor downloads to open a spreadsheet, against nothing at all for the ones who
 * never press Export PDF.
 *
 * Noto Sans Thai, SIL Open Font License 1.1 — the licence travels with it in
 * `public/fonts/OFL.txt`, which is what the OFL asks for.
 */

export const THAI_FONT_NAME = "NotoSansThai";
const FONT_URL = "/fonts/NotoSansThai-Regular.ttf";
const FONT_FILE = "NotoSansThai-Regular.ttf";

/** Fetched once per page load: exporting twice shouldn't download it twice. */
let cached: Promise<string> | null = null;

function toBase64(bytes: Uint8Array): string {
  // Chunked rather than one spread over 45,000 arguments, which overflows the call stack in
  // Safari long before it does in Chrome.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function loadFontBase64(): Promise<string> {
  const response = await fetch(FONT_URL);
  if (!response.ok) throw new Error(`font ${response.status}`);
  return toBase64(new Uint8Array(await response.arrayBuffer()));
}

export interface FontTarget {
  addFileToVFS: (name: string, data: string) => void;
  addFont: (file: string, name: string, style: string) => void;
  setFont: (name: string, style?: string) => void;
}

/**
 * Registers the font on a jsPDF document and returns whether it took.
 *
 * Named `register`, not `use`: React's lint rules read a `use` prefix as a hook and refuse to see
 * it called from an ordinary async function.
 *
 * A failure — offline, the asset missing from a bad deploy — falls back to the built-in font rather
 * than throwing: a PDF whose Thai is wrong is worse than one whose Thai is right, but far better
 * than no PDF and an error the user can do nothing about.
 */
export async function registerThaiFont(doc: FontTarget): Promise<boolean> {
  try {
    cached ??= loadFontBase64();
    const base64 = await cached;
    doc.addFileToVFS(FONT_FILE, base64);
    doc.addFont(FONT_FILE, THAI_FONT_NAME, "normal");
    doc.setFont(THAI_FONT_NAME, "normal");
    return true;
  } catch {
    // Don't keep a rejected promise around; the next export should try again.
    cached = null;
    return false;
  }
}
