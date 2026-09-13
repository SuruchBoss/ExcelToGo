export type AstNode =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "cell"; row: number; col: number }
  | { type: "referror" }
  /** An argument the user left out, as in XLOOKUP(a,b,c,,-1) — Excel's way of skipping to a later
   *  optional argument. Distinct from an empty string so a function can fall back to its default. */
  | { type: "missing" }
  | { type: "range"; startRow: number; startCol: number; endRow: number; endCol: number }
  | { type: "unary"; op: "-" | "+"; expr: AstNode }
  | { type: "binop"; op: string; left: AstNode; right: AstNode }
  | { type: "call"; name: string; args: AstNode[] };
