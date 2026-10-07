import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";

test("scratch files are ignored while maintained sources remain linted", async () => {
  const eslint = new ESLint();
  assert.equal(await eslint.isPathIgnored("tmp/investigation.mjs"), true);
  assert.equal(await eslint.isPathIgnored("tmp/nested/one-off.ts"), true);
  for (const path of ["scripts/maintained.mjs", "server/maintained.mjs", "src/lib/maintained.ts", "tests/maintained.spec.ts"]) {
    assert.equal(await eslint.isPathIgnored(path), false, path);
  }
});
test("maintained server and script errors are still reported with Node globals", async () => {
  const eslint = new ESLint();
  for (const filePath of ["server/maintained.mjs", "scripts/maintained.mjs"]) {
    const [result] = await eslint.lintText("console.log(process.version, undeclaredValue);", { filePath });
    assert.equal(result.errorCount, 1);
    assert.equal(result.messages[0].ruleId, "no-undef");
    assert.match(result.messages[0].message, /undeclaredValue/u);
  }
});
