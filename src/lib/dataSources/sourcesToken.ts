/**
 * The token the browser sends to reach the data-source API.
 *
 * Kept in `sessionStorage`, not `localStorage`: it is an operator credential that lets the server
 * be told to fetch URLs, and leaving it on disk for the next person to open the browser on a shared
 * machine is worse than asking for it again after a restart.
 *
 * Every read and write is guarded — a private window, blocked site data or a preview can make the
 * accessor throw rather than simply return nothing, and an unlock box that crashes the panel is a
 * worse failure than one that forgets.
 */
export const SOURCES_TOKEN_HEADER = "x-sources-token";
const KEY = "exceltogo.sources-token";
/** Fired so every component reading the token re-renders when it is set or cleared. */
export const TOKEN_CHANGED_EVENT = "exceltogo:sources-token";

export function readSourcesToken(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeSourcesToken(token: string): void {
  try {
    const trimmed = token.trim();
    if (trimmed) sessionStorage.setItem(KEY, trimmed);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to do: the caller will find out because the next request comes back unauthorized.
  }
  window.dispatchEvent(new Event(TOKEN_CHANGED_EVENT));
}

/** Request headers with the token attached, for whichever call is being made. */
export function withSourcesToken(headers: HeadersInit = {}): HeadersInit {
  const token = readSourcesToken();
  return token ? { ...headers, [SOURCES_TOKEN_HEADER]: token } : headers;
}
