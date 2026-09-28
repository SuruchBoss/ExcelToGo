// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { COL_WIDTH } from "@/lib/gridGeometry";

/**
 * How a finger dragging the selection grip grows the range and scrolls the sheet (#127).
 *
 * Kept apart from the grip itself so the two rules can be tested without a finger: on a phone
 * almost every range selection ran on to column J and took the data off the screen with it.
 */

/** How close to an edge a finger has to get before the sheet starts scrolling to meet it. */
const EDGE = 44;
/** Pixels per tick at the edge's inner line and at the edge itself: slow where the zone starts,
 *  faster the deeper the finger goes. A flat 12px was 750px a second — about seven columns — so a
 *  drag that paused near the right edge ran on to column J before the finger could lift (#127). */
const SCROLL_MIN = 2;
const SCROLL_MAX = 10;
export const SCROLL_TICK_MS = 16;
/** Movement before the drag decides which way it is going, and how far toward an edge the finger
 *  must travel before that edge may scroll the sheet. */
const DECIDE_PX = 12;
const ARM_PX = 24;

/** Which way a drag is locked: rows only (a mostly-vertical drag), columns only, or free. */
export type Axis = "rows" | "cols" | null;

/**
 * The direction a drag has shown so far.
 *
 * Mostly vertical — sideways movement under half the vertical — grows rows only, so a thumb that
 * drifts right while pulling down does not widen the range (it went C2:C11 → C2:J11). Sideways
 * movement of more than half a column frees it again, for a drag that really does mean both.
 */
export function dragAxis(current: Axis, dx: number, dy: number): Axis {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (current === "rows") return ax > COL_WIDTH / 2 ? null : "rows";
  if (current === "cols") return ay > COL_WIDTH / 2 ? null : "cols";
  if (Math.max(ax, ay) < DECIDE_PX) return null;
  if (ax < ay / 2) return "rows";
  if (ay < ax / 2) return "cols";
  return null;
}

/**
 * How far to scroll this tick along one axis: toward an edge only when the finger is in that
 * edge's zone *and* has travelled toward it since it went down. A grip on the right-most visible
 * column starts inside the zone, and used to scroll the moment it was touched.
 */
export function edgeStep(at: number, origin: number, low: number, high: number): number {
  const ramp = (depth: number) => Math.round(SCROLL_MIN + (SCROLL_MAX - SCROLL_MIN) * Math.min(1, depth / EDGE));
  if (at > high - EDGE && at - origin >= ARM_PX) return ramp(at - (high - EDGE));
  if (at < low + EDGE && origin - at >= ARM_PX) return -ramp(low + EDGE - at);
  return 0;
}

