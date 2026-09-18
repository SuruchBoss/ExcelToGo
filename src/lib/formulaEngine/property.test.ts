import { describe, expect, it } from "vitest";
import { parseFormula } from "./parser";
import { evaluate } from "./evaluator";
import { gridContext } from "./testUtils";
import { shiftFormulaRefs } from "./shift";
import { adjustFormulaForStructuralOp } from "./structuralShift";
import { FormulaValue, isError } from "./types";

/**
 * Properties, rather than examples.
 *
 * The other engine tests say what specific formulas do. They were written by the same person who
 * wrote the engine, from the same understanding of it, which means both share the same blind spots:
 * a precedence bug survives an example suite by being consistently wrong in the test and in the
 * code. Nothing here names a formula. Each test states something that must hold for *every*
 * formula, then throws thousands of generated ones at it.
 *
 * Written by hand rather than with fast-check, for the same reason the engine has no formula
 * library: the generator and the shrinker are about 80 lines, they are the interesting part, and a
 * project whose point is a hand-written engine should not outsource the thing that checks it. The
 * tradeoff is real — fast-check's shrinking is far better than the one below — and the one place
 * it hurts is noted where it applies.
 *
 * Every run is seeded and prints the seed on failure, so a red CI is reproducible exactly:
 * `SEED=12345 npx vitest run property` replays the same formulas.
 */

/** mulberry32: small, fast, and identical across machines — which is the only requirement here. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_SEED = Number(process.env.SEED) || 20260918;
/** Enough to find a precedence bug in seconds; small enough that the whole file runs in well under one. */
const CASES = 300;

type Rand = () => number;
const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

/**
 * An arithmetic expression over integers, kept as a tree so the same structure can be rendered two
 * ways: as a formula for the engine, and as a number by plain JavaScript. The engine is then
 * checked against an oracle that shares none of its code.
 *
 * Only `+ - *` and parentheses, and only integers small enough that every intermediate result is
 * exact in a double. Division would make the comparison about float formatting rather than about
 * precedence, which is the thing under test.
 */
type Expr = { kind: "num"; value: number } | { kind: "op"; op: "+" | "-" | "*"; left: Expr; right: Expr };

function genExpr(r: Rand, depth = 0): Expr {
  if (depth >= 3 || r() < 0.3) return { kind: "num", value: int(r, -20, 20) };
  return { kind: "op", op: pick(r, ["+", "-", "*"] as const), left: genExpr(r, depth + 1), right: genExpr(r, depth + 1) };
}

/** Parenthesised at every branch: this test is about evaluation, not about precedence *printing*. */
function render(e: Expr): string {
  if (e.kind === "num") return e.value < 0 ? `(${e.value})` : String(e.value);
  return `(${render(e.left)}${e.op}${render(e.right)})`;
}

function expected(e: Expr): number {
  if (e.kind === "num") return e.value;
  const [l, r] = [expected(e.left), expected(e.right)];
  return e.op === "+" ? l + r : e.op === "-" ? l - r : l * r;
}

/** A negative number written inline would put two operators side by side, so it gets brackets. */
const term = (n: number) => (n < 0 ? `(${n})` : String(n));

const calcValue = (body: string, grid: FormulaValue[][] = []): FormulaValue => {
  const result = evaluate(parseFormula(body), gridContext(grid));
  return result.kind === "scalar" ? result.value : (result.rows[0]?.[0] ?? null);
};

/**
 * Shrinking, the cheap version: replace a subtree with a literal of its own value and keep the
 * result if it still fails. It reduces a 30-node expression to a handful of nodes, which is the
 * difference between a readable failure and an unreadable one — but unlike a real shrinker it
 * never re-generates smaller *operands*, so `7*3+1` will not shrink to `2*2+1`. Good enough to
 * point at the operator that is wrong, which is what the failure is about.
 */
function shrink(e: Expr, stillFails: (candidate: Expr) => boolean): Expr {
  let best = e;
  for (let pass = 0; pass < 8; pass++) {
    let improved = false;
    const tryReplace = (node: Expr): Expr => {
      if (node.kind === "num") return node;
      for (const side of [node.left, node.right]) {
        const candidate = replace(best, node, side);
        if (candidate !== best && stillFails(candidate)) {
          best = candidate;
          improved = true;
          return side;
        }
      }
      return { ...node, left: tryReplace(node.left), right: tryReplace(node.right) };
    };
    tryReplace(best);
    if (!improved) break;
  }
  return best;
}

function replace(tree: Expr, target: Expr, withNode: Expr): Expr {
  if (tree === target) return withNode;
  if (tree.kind === "num") return tree;
  const left = replace(tree.left, target, withNode);
  const right = replace(tree.right, target, withNode);
  return left === tree.left && right === tree.right ? tree : { ...tree, left, right };
}

describe("arithmetic, against an oracle that shares no code with the engine", () => {
  it("evaluates a fully parenthesised expression to what JavaScript makes of the same tree", () => {
    for (let i = 0; i < CASES; i++) {
      const r = rng(BASE_SEED + i);
      const tree = genExpr(r);
      const fails = (e: Expr) => calcValue(render(e)) !== expected(e);
      if (fails(tree)) {
        const small = shrink(tree, fails);
        expect.fail(
          `seed ${BASE_SEED + i}: ${render(small)} gave ${String(calcValue(render(small)))}, expected ${expected(small)}`
        );
      }
    }
  });

  it("applies precedence and left-associativity to an expression with no parentheses at all", () => {
    // `*` binds tighter than `+` and `-`, and `a-b-c` is `(a-b)-c`. Stated as a rule and checked
    // against a flat list of numbers and operators reduced by hand: multiplications first,
    // left to right, then the additions and subtractions, left to right. An example suite tests
    // the cases someone thought of; this tests the rule.
    //
    // The expression is generated *flat* rather than as a tree, because a tree carries a shape
    // that the printed text does not: dropping the parentheses off a random tree changes what the
    // expression means, and comparing the two then fails on a correct engine. (It did, first
    // time round — the property was wrong, not the parser.)
    for (let i = 0; i < CASES; i++) {
      const r = rng(BASE_SEED + 100_000 + i);
      const nums: number[] = [int(r, -20, 20)];
      const ops: ("+" | "-" | "*")[] = [];
      for (let n = 0; n < int(r, 1, 6); n++) {
        ops.push(pick(r, ["+", "-", "*"] as const));
        nums.push(int(r, -20, 20));
      }

      const text = nums.map((n, k) => (k === 0 ? term(n) : `${ops[k - 1]}${term(n)}`)).join("");

      // The oracle, in two passes, sharing nothing with the parser.
      const values = [...nums];
      const rest = [...ops];
      for (let k = 0; k < rest.length; ) {
        if (rest[k] === "*") {
          values.splice(k, 2, values[k] * values[k + 1]);
          rest.splice(k, 1);
        } else k++;
      }
      let oracle = values[0];
      for (let k = 0; k < rest.length; k++) oracle = rest[k] === "+" ? oracle + values[k + 1] : oracle - values[k + 1];

      const got = calcValue(text);
      if (got !== oracle) expect.fail(`seed ${BASE_SEED + 100_000 + i}: ${text} gave ${String(got)}, expected ${oracle}`);
    }
  });
});

/** A formula that reaches into cells, so evaluation covers refs, ranges, functions and errors. */
function genFormula(r: Rand, depth = 0): string {
  const leaf = () =>
    pick(r, [
      String(int(r, -50, 50)),
      `${pick(r, ["A", "B", "C", "D"])}${int(r, 1, 6)}`,
      `$${pick(r, ["A", "B", "C"])}$${int(r, 1, 6)}`,
      `"${pick(r, ["ก", "ข", "", "a b", 'quote""inside'])}"`,
      pick(r, ["TRUE()", "FALSE()"]),
    ]);
  if (depth >= 2 || r() < 0.35) return leaf();

  const range = `${pick(r, ["A", "B"])}${int(r, 1, 3)}:${pick(r, ["C", "D"])}${int(r, 4, 6)}`;
  return pick(r, [
    `(${genFormula(r, depth + 1)}${pick(r, ["+", "-", "*", "/", "&", "=", "<", ">=", "<>"])}${genFormula(r, depth + 1)})`,
    `SUM(${range})`,
    `AVERAGE(${range})`,
    `COUNT(${range})`,
    `IF(${genFormula(r, depth + 1)},${genFormula(r, depth + 1)},${genFormula(r, depth + 1)})`,
    `ROUND(${genFormula(r, depth + 1)},${int(r, 0, 3)})`,
    `CONCATENATE(${genFormula(r, depth + 1)},${genFormula(r, depth + 1)})`,
    `VLOOKUP(${genFormula(r, depth + 1)},${range},${int(r, 1, 3)},FALSE())`,
  ]);
}

function genGrid(r: Rand): FormulaValue[][] {
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 4 }, () => pick(r, [int(r, -30, 30), "", "ข้อความ", true, null, 0] as FormulaValue[]))
  );
}

describe("evaluation is total", () => {
  it("returns a value or a typed error for any formula the parser accepts — it never throws", () => {
    // The contract the whole app leans on: a bad formula shows #VALUE! in a cell. An exception
    // instead takes out the render, which is exactly the crash the error boundary was built for
    // and the one no user should ever meet.
    for (let i = 0; i < CASES * 2; i++) {
      const r = rng(BASE_SEED + 200_000 + i);
      const body = genFormula(r);
      const grid = genGrid(r);
      let value: FormulaValue;
      try {
        value = calcValue(body, grid);
      } catch (err) {
        expect.fail(`seed ${BASE_SEED + 200_000 + i}: ${body} threw ${String(err)}`);
      }
      const ok = value === null || isError(value) || ["number", "string", "boolean"].includes(typeof value);
      if (!ok) expect.fail(`seed ${BASE_SEED + 200_000 + i}: ${body} returned ${String(value)}`);
    }
  });
});

describe("shifting references", () => {
  it("shifting by nothing changes nothing", () => {
    for (let i = 0; i < CASES; i++) {
      const r = rng(BASE_SEED + 300_000 + i);
      const body = genFormula(r);
      expect(shiftFormulaRefs(body, 0, 0), `seed ${BASE_SEED + 300_000 + i}`).toBe(body);
    }
  });

  it("two shifts in a row are the one shift of their sum", () => {
    // Filling right by two columns has to land where filling right one and then one more does.
    // The references are generated far enough from A1 that no shift clamps at the edge, which is
    // the one place the property legitimately does not hold.
    for (let i = 0; i < CASES; i++) {
      const r = rng(BASE_SEED + 400_000 + i);
      const body = `SUM(F${int(r, 10, 20)}:H${int(r, 21, 30)})+E${int(r, 10, 20)}*$C$${int(r, 1, 9)}`;
      const [a, b] = [int(r, -3, 3), int(r, -3, 3)];
      const twice = shiftFormulaRefs(shiftFormulaRefs(body, a, 0), b, 0);
      const once = shiftFormulaRefs(body, a + b, 0);
      expect(twice, `seed ${BASE_SEED + 400_000 + i}: rows ${a} then ${b}`).toBe(once);
    }
  });
});

describe("inserting and deleting a row", () => {
  it("inserting a row and deleting the same row leaves every reference where it started", () => {
    // Insert at i pushes everything at or below i down by one; deleting i pulls it back. Nothing
    // can land *on* i in between — the insert moved it away — so no reference has an excuse to
    // come back as #REF!. This is the invariant that a user's undo depends on.
    for (let i = 0; i < CASES; i++) {
      const r = rng(BASE_SEED + 500_000 + i);
      const body = genFormula(r);
      const at = int(r, 0, 5);
      const there = adjustFormulaForStructuralOp(body, "row", at, 1);
      const back = adjustFormulaForStructuralOp(there, "row", at, -1);
      if (back !== body) {
        expect.fail(`seed ${BASE_SEED + 500_000 + i}: "${body}" → insert row ${at} → "${there}" → delete → "${back}"`);
      }
    }
  });

  it("does the same for a column", () => {
    for (let i = 0; i < CASES; i++) {
      const r = rng(BASE_SEED + 600_000 + i);
      const body = genFormula(r);
      const at = int(r, 0, 3);
      const back = adjustFormulaForStructuralOp(adjustFormulaForStructuralOp(body, "col", at, 1), "col", at, -1);
      expect(back, `seed ${BASE_SEED + 600_000 + i}`).toBe(body);
    }
  });
});

describe("SUM against the obvious oracle", () => {
  it("adds up exactly the numbers in the range and ignores everything else", () => {
    for (let i = 0; i < CASES; i++) {
      const r = rng(BASE_SEED + 700_000 + i);
      const grid = genGrid(r);
      const [r0, r1] = [int(r, 0, 2), int(r, 3, 5)];
      const [c0, c1] = [int(r, 0, 1), int(r, 2, 3)];
      const range = `${String.fromCharCode(65 + c0)}${r0 + 1}:${String.fromCharCode(65 + c1)}${r1 + 1}`;

      let oracle = 0;
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const v = grid[row][col];
          if (typeof v === "number") oracle += v;
        }
      }

      expect(calcValue(`SUM(${range})`, grid), `seed ${BASE_SEED + 700_000 + i}: SUM(${range})`).toBe(oracle);
    }
  });
});
