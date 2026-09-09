import { th } from "./th";
import { en } from "./en";
import { Locale, Messages } from "./types";

/** Plain locale -> messages map, safe to import from server code (API routes) since it has no
 *  dependency on the client-only locale store or browser APIs — unlike `useT`/`useLocale`/
 *  `getMessages` in `./index.ts`, which read the current locale from Zustand + localStorage. */
export const MESSAGES: Record<Locale, Messages> = { th, en };
