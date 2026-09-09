export type AstNode =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "cell"; row: number; col: number }
  | { type: "referror" }
  | { type: "range"; startRow: number; startCol: number; endRow: number; endCol: number }
  | { type: "unary"; op: "-" | "+"; expr: AstNode }
  | { type: "binop"; op: string; left: AstNode; right: AstNode }
  | { type: "call"; name: string; args: AstNode[] };
