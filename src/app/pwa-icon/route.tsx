import { ImageResponse } from "next/og";

/**
 * The home-screen icon, at whatever size the manifest asks for.
 *
 * Drawn in code, like the favicon in `icon.tsx` and for the same reason: it is the wordmark's own
 * mark, and a PNG committed beside it is a copy that goes stale the first time the mark changes.
 * A route rather than two files so 192 and 512 cannot disagree with each other.
 *
 * `purpose: maskable` in the manifest means Android may crop this to a circle or a squircle, so
 * the sheet is drawn inside the middle 60% — the "safe zone" — with the background running to the
 * edges. Without the padding the corner cell, which is the whole point of the mark, is the first
 * thing a circular mask eats.
 */
export const dynamic = "force-static";

const SIZES = new Set([192, 512]);

export function GET(request: Request) {
  const asked = Number(new URL(request.url).searchParams.get("size") ?? 512);
  const size = SIZES.has(asked) ? asked : 512;
  const inner = Math.round(size * 0.6);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#fbfaf7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={inner} height={inner} viewBox="0 0 18 18">
          <rect x="0.5" y="0.5" width="17" height="17" fill="none" stroke="#16181d" strokeOpacity="0.5" />
          <path d="M6.5 0.5V17.5M12 0.5V17.5M0.5 6.5H17.5M0.5 12H17.5" stroke="#16181d" strokeOpacity="0.3" />
          <rect x="12" y="12" width="5.5" height="5.5" fill="#0b6b4f" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
