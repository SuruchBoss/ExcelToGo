export type TokenType =
  | "NUMBER"
  | "STRING"
  | "BOOL"
  | "RANGE"
  | "CELL"
  | "FUNC"
  | "OP"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
}

const RANGE_RE = /^\$?[A-Za-z]{1,3}\$?\d+:\$?[A-Za-z]{1,3}\$?\d+/;
const CELL_RE = /^\$?[A-Za-z]{1,3}\$?\d+/;
const NUMBER_RE = /^\d+(\.\d+)?/;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_.]*/;
const MULTI_OP_RE = /^(<>|<=|>=)/;

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let s = input;
  while (s.length > 0) {
    const ch = s[0];
    if (/\s/.test(ch)) {
      s = s.slice(1);
      continue;
    }
    if (ch === '"') {
      let i = 1;
      let out = "";
      while (i < s.length) {
        if (s[i] === '"' && s[i + 1] === '"') {
          out += '"';
          i += 2;
          continue;
        }
        if (s[i] === '"') {
          i += 1;
          break;
        }
        out += s[i];
        i += 1;
      }
      tokens.push({ type: "STRING", value: out });
      s = s.slice(i);
      continue;
    }

    const rangeMatch = RANGE_RE.exec(s);
    if (rangeMatch) {
      tokens.push({ type: "RANGE", value: rangeMatch[0].toUpperCase() });
      s = s.slice(rangeMatch[0].length);
      continue;
    }
    const cellMatch = CELL_RE.exec(s);
    if (cellMatch) {
      tokens.push({ type: "CELL", value: cellMatch[0].toUpperCase() });
      s = s.slice(cellMatch[0].length);
      continue;
    }
    const numMatch = NUMBER_RE.exec(s);
    if (numMatch) {
      tokens.push({ type: "NUMBER", value: numMatch[0] });
      s = s.slice(numMatch[0].length);
      continue;
    }
    const identMatch = IDENT_RE.exec(s);
    if (identMatch) {
      const word = identMatch[0];
      const upper = word.toUpperCase();
      if (upper === "TRUE" || upper === "FALSE") {
        tokens.push({ type: "BOOL", value: upper });
      } else {
        tokens.push({ type: "FUNC", value: upper });
      }
      s = s.slice(word.length);
      continue;
    }
    const multiOp = MULTI_OP_RE.exec(s);
    if (multiOp) {
      tokens.push({ type: "OP", value: multiOp[0] });
      s = s.slice(multiOp[0].length);
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: ch });
      s = s.slice(1);
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ch });
      s = s.slice(1);
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "COMMA", value: ch });
      s = s.slice(1);
      continue;
    }
    if ("+-*/^&=<>%".includes(ch)) {
      tokens.push({ type: "OP", value: ch });
      s = s.slice(1);
      continue;
    }
    // Unknown character: skip it rather than throwing, so a partially
    // typed formula doesn't crash the editor while the user is still typing.
    s = s.slice(1);
  }
  tokens.push({ type: "EOF", value: "" });
  return tokens;
}
