/**
 * Whether this deployment has a cloud backend attached — and it is off unless someone attaches one.
 *
 * ExcelToGo is open source, not a hosted service. Running a database for everyone who uses the app
 * would make the maintainer a data controller with the obligations that brings, and would reverse
 * the one property the rest of the app is built on: your spreadsheet never leaves your browser.
 *
 * So cloud save is bring-your-own. Point these two variables at *your* Supabase project and the
 * feature appears; leave them unset — which is the default, and what the public demo does — and
 * every cloud code path stays unreachable, the button never renders, and the client library is
 * never even downloaded.
 */

export const CLOUD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const CLOUD_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Both halves, or nothing.
 *
 * A URL without a key (or the reverse) is a half-finished deployment, and showing the feature then
 * would hand the user a sign-in box that cannot work. Treating it as "not configured" makes the
 * failure visible where it belongs — in the deployment — instead of in front of whoever tries it.
 */
export function isCloudConfigured(url = CLOUD_URL, key = CLOUD_ANON_KEY): boolean {
  return url.trim().length > 0 && key.trim().length > 0;
}
