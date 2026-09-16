/**
 * "Bring your own key": the visitor pastes an Anthropic API key and the browser talks to Anthropic
 * directly, so the assistant gives real answers on a deployment whose operator pays for nothing.
 *
 * Two decisions worth stating, because both are security ones.
 *
 * **The key never reaches this app's server.** The request goes from the browser to
 * `api.anthropic.com`, which is what `dangerouslyAllowBrowser` in the SDK unlocks (it adds the
 * `anthropic-dangerous-direct-browser-access` header Anthropic requires for CORS). A key posted to
 * our route would sit in that process's memory and in whatever the host logs — this way there is
 * nothing to leak, because there is nothing to leak *here*.
 *
 * **`sessionStorage`, not `localStorage`.** Closing the tab discards it. A key left in
 * `localStorage` on a shared or library machine outlives the person who typed it, and this is a
 * tool people are told to open without signing up — assuming the machine is theirs alone would be
 * the wrong default. The cost is retyping it in a new tab, which is the right trade for a secret.
 */
const STORAGE_KEY = "exceltogo.anthropic_key";

/**
 * A one-value store so the panel can read the key with `useSyncExternalStore`.
 *
 * The obvious `useEffect(() => setKey(read()), [])` is what this replaces: React's compiler lint
 * rejects setting state from an effect, and it is right to — that shape renders once with the wrong
 * value and then again with the right one. `getServerSnapshot` returns "" so the server render and
 * the first client render agree, and the subscription then delivers the real value.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let cached: string | null = null;

function emit() {
  cached = null;
  for (const l of listeners) l();
}

export function subscribeToKey(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Cached because `useSyncExternalStore` compares snapshots by identity on every render. */
export function keySnapshot(): string {
  if (cached === null) cached = readKey();
  return cached;
}

export function keyServerSnapshot(): string {
  return "";
}

/** Anthropic keys start `sk-ant-`. Checked so an obvious paste error fails here, not at Anthropic. */
export function looksLikeAnthropicKey(value: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{16,}$/.test(value.trim());
}

export function readKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // Private mode and blocked site data both throw on access rather than returning null.
    return "";
  }
}

export function saveKey(value: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, value.trim());
    emit();
  } catch {
    /* Nothing useful to do: the panel reflects `readKey()`, so it will show the key as unset. */
  }
}

export function clearKey(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    emit();
  } catch {
    /* As above. */
  }
}

/** Never render a key in full — enough to recognise which one is in use, not enough to reuse. */
export function maskKey(value: string): string {
  const v = value.trim();
  if (v.length <= 12) return "•".repeat(v.length);
  return `${v.slice(0, 10)}…${v.slice(-4)}`;
}
