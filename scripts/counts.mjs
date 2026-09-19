/**
 * The figures the project claims about itself, counted from source — in one place because they
 * were in two.
 *
 * `check-readme.mjs` and `make-social-preview.mjs` each held their own copy of the security-test
 * file list. Adding `byok.test.ts` to one and not the other shipped a social preview card reading
 * "91 security tests" while every other surface said 103, and no gate could catch it: the card is
 * a PNG, and `check:readme` can only verify its dimensions. Two lists that must agree, with
 * nothing making them agree, is the bug — not the day somebody forgot.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
export const countMatches = (p, re) => (read(p).match(re) ?? []).length;

/** Every file whose cases are counted as security tests. Add new ones here and nowhere else. */
export const SECURITY_TEST_FILES = [
  "src/lib/server/urlGuard.test.ts",
  "src/lib/server/executeSource.test.ts",
  "src/lib/server/secretBox.test.ts",
  "src/lib/server/rateLimiter.test.ts",
  "src/lib/server/sourcesAuth.test.ts",
  "src/lib/server/demoSources.test.ts",
  "src/app/api/sources/validate.test.ts",
  "src/app/api/ai/formula/route.test.ts",
  "src/lib/byok.test.ts",
  "src/lib/csvInjection.test.ts",
  "src/lib/cloud/liveMessage.test.ts",
  "src/lib/cloud/policies.test.ts",
  "src/lib/errorReport.test.ts",
];

function walk(dir, onFile) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, onFile);
    else onFile(full, entry.name);
  }
}

export function countTests(dir = path.join(ROOT, "src")) {
  let n = 0;
  walk(dir, (full, name) => {
    if (!name.endsWith(".test.ts")) return;
    const source = fs.readFileSync(full, "utf8");
    // A table-driven block contributes one `it(` to this count and one case *per row* to the run,
    // so the moment one is written the number in the README stops being true — silently, because
    // both sides still agree with themselves. Counting the rows here would mean parsing them; this
    // suite is small enough that writing the cases out is the cheaper answer, and a loud failure
    // is better than a quiet drift either way. (Caught for real: six rows, docs said 917, vitest
    // ran 923, every gate green.)
    if (/^\s*(it|test)\.each/m.test(source)) {
      throw new Error(
        `${name}: it.each/test.each is not counted by check:readme, so the test count in the docs ` +
          `would drift. Write the cases out as plain it(...) blocks.`
      );
    }
    n += (source.match(/^\s*it\(/gm) ?? []).length;
  });
  return n;
}

export function countTestFiles(dir = path.join(ROOT, "src")) {
  let n = 0;
  walk(dir, (_full, name) => {
    if (name.endsWith(".test.ts")) n++;
  });
  return n;
}

export const counts = () => ({
  engineFunctions: countMatches("src/lib/formulaEngine/functions.ts", /^  [A-Z][A-Z0-9.]*:/gm),
  paletteFormulas: countMatches("src/lib/formulaCatalog.ts", /^    id: "[A-Z][A-Z0-9.]*",/gm),
  tests: countTests(),
  testFiles: countTestFiles(),
  securityTests: SECURITY_TEST_FILES.reduce((n, f) => n + countMatches(f, /^\s*it\(/gm), 0),
});
