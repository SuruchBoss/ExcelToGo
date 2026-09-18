/**
 * Every keyboard shortcut the app has, in one list, so there is somewhere to show them.
 *
 * The Excel keys — `Ctrl+↓` to the edge of the data, `Ctrl+A`'s two-step, `Home`/`End`, the `Page`
 * keys — all work, and nothing on screen said they existed. A blind run of the public build found
 * no help button, no shortcut list, and no mention of `Ctrl+` anywhere outside the undo and redo
 * tooltips. A feature only the person who wrote it knows about is not a feature.
 *
 * This is a second copy of what the handlers do, which is the shape of every stale claim this
 * project has shipped — so `keyboardShortcuts.test.ts` reads the handlers' source and fails if a
 * key is handled and not listed here, or listed here and handled nowhere. `handles` is what makes
 * that checkable: the `event.key` values each row is claiming to describe.
 */

/**
 * A key as it is pressed, not as it is drawn. `Mod` is Ctrl on a PC and ⌘ on a Mac — the handlers
 * accept either (`e.ctrlKey || e.metaKey`), so the list must say whichever one the reader has.
 */
export type KeyToken = string;

export interface Shortcut {
  /** Names the description in `t.shortcuts.items`. */
  id: string;
  /** Ways to do the same thing: undo is `Mod+Z`, redo is `Mod+Y` *or* `Mod+Shift+Z`. */
  combos: KeyToken[][];
  /** The `event.key` values this row documents. Empty when the row describes a modifier applied to
   *  keys another row already covers — `Shift+↓` extends the selection the arrows already move. */
  handles: string[];
}

export interface ShortcutGroup {
  /** Names the heading in `t.shortcuts.groups`. */
  id: string;
  shortcuts: Shortcut[];
}

/**
 * Ordered for a two-column grid, which is why "editing" comes before "selecting".
 *
 * The groups are laid out row by row into two columns, so the pairing decides the shape: move (7
 * rows) beside edit (7), select (3) beside clipboard (5), other (3) alone. Left in reading order
 * they paired 7-with-3 and 7-with-5 and the left column ran out a third of the way up the sheet.
 * On a phone there is one column and this is simply the order you read them in.
 */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: "move",
    shortcuts: [
      // `Arrows` is the four of them as one key, because they are four answers to the same
      // question and not a chord. Listed as four combos they read as "Ctrl+↑ / Ctrl+↓ / Ctrl+← /
      // Ctrl+→", which is both wider than the column and harder to take in than "Ctrl + ↑↓←→".
      { id: "arrows", combos: [["Arrows"]], handles: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] },
      { id: "jump", combos: [["Mod", "Arrows"]], handles: [] },
      { id: "rowStart", combos: [["Home"]], handles: ["Home"] },
      { id: "rowEnd", combos: [["End"]], handles: ["End"] },
      { id: "sheetStart", combos: [["Mod", "Home"]], handles: [] },
      { id: "sheetEnd", combos: [["Mod", "End"]], handles: [] },
      { id: "page", combos: [["PageUp"], ["PageDown"]], handles: ["PageUp", "PageDown"] },
    ],
  },
  {
    id: "edit",
    shortcuts: [
      // `AnyKey` is a phrase, not a key — the component swaps in the translated wording.
      { id: "typeToEdit", combos: [["AnyKey"]], handles: [] },
      { id: "editInPlace", combos: [["F2"]], handles: ["F2"] },
      { id: "commit", combos: [["Enter"]], handles: ["Enter"] },
      { id: "commitUp", combos: [["Shift", "Enter"]], handles: [] },
      { id: "nextCell", combos: [["Tab"]], handles: ["Tab"] },
      { id: "prevCell", combos: [["Shift", "Tab"]], handles: [] },
      { id: "clear", combos: [["Delete"], ["Backspace"]], handles: ["Delete", "Backspace"] },
      { id: "fillDown", combos: [["Mod", "D"]], handles: ["d", "D"] },
      { id: "fillRight", combos: [["Mod", "R"]], handles: ["r", "R"] },
    ],
  },
  {
    id: "select",
    shortcuts: [
      { id: "extend", combos: [["Shift", "Arrows"]], handles: [] },
      { id: "extendJump", combos: [["Mod", "Shift", "Arrows"]], handles: [] },
      { id: "selectBlock", combos: [["Mod", "A"]], handles: ["a", "A"] },
    ],
  },
  {
    id: "clipboard",
    shortcuts: [
      { id: "copy", combos: [["Mod", "C"]], handles: [] },
      { id: "cut", combos: [["Mod", "X"]], handles: [] },
      { id: "paste", combos: [["Mod", "V"]], handles: [] },
      { id: "undo", combos: [["Mod", "Z"]], handles: [] },
      { id: "redo", combos: [["Mod", "Y"], ["Mod", "Shift", "Z"]], handles: [] },
    ],
  },
  {
    id: "other",
    shortcuts: [
      { id: "escape", combos: [["Escape"]], handles: ["Escape"] },
      { id: "saveComment", combos: [["Mod", "Enter"]], handles: [] },
      { id: "find", combos: [["Mod", "F"], ["Mod", "H"]], handles: [] },
      { id: "help", combos: [["Mod", "/"], ["F1"]], handles: [] },
    ],
  },
];

/** The store's global handlers compare a lower-cased `event.key`; these are the letters they use. */
export const GLOBAL_SHORTCUT_KEYS = ["z", "y", "c", "x"];

/**
 * ⌘ or Ctrl, ↓ or "ArrowDown".
 *
 * Drawing the token rather than storing the drawing keeps one list for two platforms — the
 * handlers already treat Ctrl and ⌘ as the same key, so a list that only said "Ctrl" would be
 * wrong for half its readers and there would be no way to tell from the data which half.
 */
export function formatKey(token: KeyToken, apple: boolean): string {
  switch (token) {
    case "Mod":
      return apple ? "⌘" : "Ctrl";
    case "Shift":
      return apple ? "⇧" : "Shift";
    case "Arrows":
      return "↑↓←→";
    case "ArrowUp":
      return "↑";
    case "ArrowDown":
      return "↓";
    case "ArrowLeft":
      return "←";
    case "ArrowRight":
      return "→";
    case "Enter":
      return apple ? "↩" : "Enter";
    case "Backspace":
      return apple ? "⌫" : "Backspace";
    default:
      return token;
  }
}

/**
 * Whether to draw ⌘ rather than Ctrl.
 *
 * Read at render time in the browser and never during the server render — the dialog only exists
 * once someone opens it, so there is no first paint for this to disagree with.
 */
export function isAppleKeyboard(platform: string, userAgent = ""): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X|iPhone|iPad/i.test(userAgent);
}
