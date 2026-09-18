/**
 * Handing a Blob to the browser as a file.
 *
 * Its own module, and not three lines inside `excelIO.ts`, because the crash boundary needs it too
 * and must not import anything that drags ExcelJS — or the model, or the engine — into the one code
 * path that has to work when those are what broke.
 *
 * The two easy-to-miss steps are the whole reason this exists once rather than twice:
 *
 * - **The anchor has to be in the document.** A detached `<a>` still fires its click handler, so
 *   the download appears to work — but Chromium ignores the `download` attribute on it, and the
 *   file arrives named `download` with no extension. This was measured, not assumed: the first
 *   version of the rescue path did exactly that.
 * - **Revoke after the click, not before.** The object URL has to outlive the navigation the click
 *   starts.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
