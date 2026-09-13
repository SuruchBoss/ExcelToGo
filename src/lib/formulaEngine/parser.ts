import { tokenize, Token } from "./tokenizer";
import { AstNode } from "./ast";
import { parseCellRef, parseRangeRef } from "./address";

export class FormulaSyntaxError extends Error {}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: Token["type"]): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw new FormulaSyntaxError(`Expected ${type} but got ${t.type} (${t.value})`);
    }
    return this.next();
  }

  parse(): AstNode {
    const node = this.parseComparison();
    this.expect("EOF");
    return node;
  }

  private parseComparison(): AstNode {
    let left = this.parseConcat();
    while (
      this.peek().type === "OP" &&
      ["=", "<>", "<", ">", "<=", ">="].includes(this.peek().value)
    ) {
      const op = this.next().value;
      const right = this.parseConcat();
      left = { type: "binop", op, left, right };
    }
    return left;
  }

  private parseConcat(): AstNode {
    let left = this.parseAdditive();
    while (this.peek().type === "OP" && this.peek().value === "&") {
      this.next();
      const right = this.parseAdditive();
      left = { type: "binop", op: "&", left, right };
    }
    return left;
  }

  private parseAdditive(): AstNode {
    let left = this.parseTerm();
    while (this.peek().type === "OP" && (this.peek().value === "+" || this.peek().value === "-")) {
      const op = this.next().value;
      const right = this.parseTerm();
      left = { type: "binop", op, left, right };
    }
    return left;
  }

  private parseTerm(): AstNode {
    let left = this.parseUnary();
    while (this.peek().type === "OP" && (this.peek().value === "*" || this.peek().value === "/")) {
      const op = this.next().value;
      const right = this.parseUnary();
      left = { type: "binop", op, left, right };
    }
    return left;
  }

  private parseUnary(): AstNode {
    if (this.peek().type === "OP" && (this.peek().value === "-" || this.peek().value === "+")) {
      const op = this.next().value as "-" | "+";
      const expr = this.parseUnary();
      return { type: "unary", op, expr };
    }
    return this.parsePower();
  }

  private parsePower(): AstNode {
    const base = this.parsePrimary();
    if (this.peek().type === "OP" && this.peek().value === "^") {
      this.next();
      const exp = this.parseUnary();
      return { type: "binop", op: "^", left: base, right: exp };
    }
    return base;
  }

  private parsePrimary(): AstNode {
    const t = this.peek();
    if (t.type === "NUMBER") {
      this.next();
      return { type: "number", value: parseFloat(t.value) };
    }
    if (t.type === "STRING") {
      this.next();
      return { type: "string", value: t.value };
    }
    if (t.type === "BOOL") {
      this.next();
      return { type: "bool", value: t.value === "TRUE" };
    }
    if (t.type === "REFERR") {
      this.next();
      return { type: "referror" };
    }
    if (t.type === "RANGE") {
      this.next();
      const r = parseRangeRef(t.value);
      if (!r) throw new FormulaSyntaxError(`Invalid range: ${t.value}`);
      return { type: "range", startRow: r.startRow, startCol: r.startCol, endRow: r.endRow, endCol: r.endCol };
    }
    if (t.type === "CELL") {
      this.next();
      const c = parseCellRef(t.value);
      if (!c) throw new FormulaSyntaxError(`Invalid cell reference: ${t.value}`);
      return { type: "cell", row: c.row, col: c.col };
    }
    if (t.type === "FUNC") {
      this.next();
      const name = t.value;
      if (this.peek().type === "LPAREN") {
        this.next();
        const args: AstNode[] = [];
        // An empty slot is an argument, not a syntax error: XLOOKUP(a,b,c,,-1) is how Excel skips
        // an optional argument to reach a later one, and refusing it made the later ones unusable
        // without typing a value the user did not mean.
        const argument = (): AstNode => {
          const next = this.peek().type;
          return next === "COMMA" || next === "RPAREN" ? { type: "missing" } : this.parseComparison();
        };
        if (this.peek().type !== "RPAREN") {
          args.push(argument());
          while (this.peek().type === "COMMA") {
            this.next();
            args.push(argument());
          }
        }
        this.expect("RPAREN");
        return { type: "call", name, args };
      }
      // A bare identifier with no parens (e.g. a stray function name) is
      // treated as an unrecognized reference rather than a hard parse error.
      return { type: "string", value: name };
    }
    if (t.type === "LPAREN") {
      this.next();
      const inner = this.parseComparison();
      this.expect("RPAREN");
      return inner;
    }
    throw new FormulaSyntaxError(`Unexpected token: ${t.type} (${t.value})`);
  }
}

export function parseFormula(source: string): AstNode {
  const tokens = tokenize(source);
  return new Parser(tokens).parse();
}
