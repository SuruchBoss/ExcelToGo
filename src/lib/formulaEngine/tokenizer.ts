export type TokenType =
  | "NUMBER"
  | "STRING"
  | "BOOL"
  | "RANGE"
  | "CELL"
  | "FUNC"
  | "REFERR"
  | "OP"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
}

const REF_ERROR_RE = /^#REF!/i;
/**
 * A sheet name followed by `!`, tried before anything else that could swallow it.
 *
 * Order is the whole trick: `Sheet2` on its own matches `IDENT_RE` and would be tokenised as a
 * function name, and `A1` in `A1!B2` matches `CELL_RE`. Both would be wrong, and neither would
 * fail loudly — the formula would simply mean something else. So the qualified form is matched
 * first and emitted as *one* token, prefix included, which also keeps `structuralShift.ts` able to
 * see which sheet a reference belongs to while it rewrites the text.
 */
const SHEET_QUALIFIED_RE =
  /^(?:'(?:[^']|'')+'|[^\s'!,()+\-*/^&=<>%:]+)!\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?/;
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

    const refErrMatch = REF_ERROR_RE.exec(s);
    if (refErrMatch) {
      tokens.push({ type: "REFERR", value: "#REF!" });
      s = s.slice(refErrMatch[0].length);
      continue;
    }
    const qualified = SHEET_QUALIFIED_RE.exec(s);
    if (qualified) {
      // Upper-cased only past the `!`: sheet names are the user's own words and `ยอดขาย` has no
      // upper case, while `sheet2` and `Sheet2` must still be the same sheet — matched by name
      // case-insensitively where the lookup happens, not by mangling it here.
      const bang = qualified[0].lastIndexOf("!");
      const name = qualified[0].slice(0, bang);
      const ref = qualified[0].slice(bang + 1).toUpperCase();
      tokens.push({ type: ref.includes(":") ? "RANGE" : "CELL", value: `${name}!${ref}` });
      s = s.slice(qualified[0].length);
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
