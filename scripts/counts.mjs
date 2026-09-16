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
  "src/app/api/sources/validate.test.ts",
  "src/app/api/ai/formula/route.test.ts",
  "src/lib/byok.test.ts",
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
    if (name.endsWith(".test.ts")) n += (fs.readFileSync(full, "utf8").match(/^\s*it\(/gm) ?? []).length;
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
