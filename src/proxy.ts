import { NextRequest, NextResponse } from "next/server";

/**
 * A fresh nonce per request, so `script-src` can drop `'unsafe-inline'`.
 *
 * This file is the reason the policy in `next.config.ts` is now only a fallback. The story is
 * worth keeping because the obvious answer was tried first and measured:
 *
 * **Attempt one — Subresource Integrity.** Next 16 can hash every emitted bundle and add an
 * `integrity` attribute (`experimental.sri`, still on below because it costs nothing and is a real
 * check on what a CDN serves). The appeal is that it keeps every page statically rendered. It does
 * not work here, and the browser says why: six scripts got integrity attributes and **two inline
 * scripts did not**, because the React payload is inlined into the document. Chrome refused both
 * and React threw #412 — hydration never happened. SRI hashes files; it cannot hash a script that
 * is part of the HTML.
 *
 * **Attempt two — this.** A nonce is generated here, goes into the CSP header and into the request
 * so Next can stamp it onto its own inline scripts. The cost is real and is the reason the first
 * version of this project did not do it: a nonce must differ per request, so pages that were
 * prerendered at build time are now rendered per request. Measured on this app, that is worth
 * paying for. The numbers are in the README.
 *
 * `'strict-dynamic'` is what makes it strict rather than decorative: without it an attacker who can
 * inject a `<script src>` pointing at our own origin is still allowed by `'self'`. With it, only
 * the nonce'd scripts and what *they* load may run, and a plain `'self'` source is ignored.
 */
const SUPABASE_ORIGIN = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
})();

function policy(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    // 'unsafe-eval' in development only: React rebuilds server stacks with eval to say where an
    // error came from. Production neither needs nor gets it.
    `script-src 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Styles keep 'unsafe-inline', and this is a much smaller thing than it sounds. React writes
    // `style` attributes for chart geometry and for the crash screen, which has no stylesheet to
    // reach for by design. A style attribute cannot execute script; the directive that could,
    // script-src, is the one now free of it.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // The exfiltration control, and the original reason this policy exists: the visitor's own
    // Anthropic key lives in sessionStorage, so the places this page may talk to are named.
    ["connect-src 'self' https://api.anthropic.com", SUPABASE_ORIGIN].filter(Boolean).join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  // `crypto.randomUUID` rather than Math.random: a guessable nonce is no nonce at all.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = policy(nonce, process.env.NODE_ENV === "development");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  // Next reads the nonce back out of this header to stamp its own scripts. Setting it only on the
  // response would leave the document's inline scripts unsigned and the page blank.
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Static assets are immutable files with no inline script in them, and a prefetch is not a
      // document — giving either a nonce buys nothing and costs a render.
      source: "/((?!_next/static|_next/image|favicon.ico|screenshots).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
