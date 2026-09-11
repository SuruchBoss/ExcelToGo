/**
 * Whether this instance is a public demo, where the live-data feature is switched off.
 *
 * Everything else in the app runs in the browser and is safe to expose: the grid, the formula
 * engine, import/export, conditional formatting. Live data is the exception, and `SECURITY.md`
 * says why — its API has no authentication, and it will make the *server* fetch any URL a visitor
 * gives it, which on a cloud host reaches instance metadata and internal services.
 *
 * Turning it off is what makes a public deployment reasonable. It also avoids a second problem:
 * sources are persisted to `data/sources.json` on disk, and a serverless host's filesystem is
 * read-only, so the feature could not work there anyway — better a clear "off" than a confusing
 * write error.
 *
 * `NEXT_PUBLIC_` so one setting covers both sides: the server routes refuse, and the UI stops
 * offering a button that would only fail.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

/** The refusal returned by every live-data route while the demo switch is on. */
export function demoModeResponse(): Response {
  return Response.json(
    {
      error: "demo_mode",
      message:
        "Live data sources are disabled on this public demo. Run ExcelToGo locally to use them — see the README.",
    },
    { status: 403 }
  );
}
