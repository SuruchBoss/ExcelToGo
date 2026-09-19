export type AstNode =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "bool"; value: boolean }
  /** `sheet` is the name written before the `!`, or undefined for a same-sheet reference. It is
   *  the *name* rather than an id because that is what the formula text holds, and renaming a
   *  sheet has to rewrite the formulas that name it either way. */
  | { type: "cell"; row: number; col: number; sheet?: string }
  | { type: "referror" }
  /** An argument the user left out, as in XLOOKUP(a,b,c,,-1) — Excel's way of skipping to a later
   *  optional argument. Distinct from an empty string so a function can fall back to its default. */
  | { type: "missing" }
  | { type: "range"; startRow: number; startCol: number; endRow: number; endCol: number; sheet?: string }
  | { type: "unary"; op: "-" | "+"; expr: AstNode }
  | { type: "binop"; op: string; left: AstNode; right: AstNode }
  | { type: "call"; name: string; args: AstNode[] }
  /** A name somebody gave a range. Resolved at compile time against the sheet's name table; one
   *  that survives to evaluation is a name nothing defines, which is `#NAME?`. */
  | { type: "name"; name: string };
