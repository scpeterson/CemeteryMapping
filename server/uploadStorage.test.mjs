import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, readdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reconcileMediaStorage } from "./media/uploadStorage.mjs";

test("reconciliation previews orphans and preserves referenced and recent files", async () => {
  const root = await mkdtemp(join(tmpdir(), "reconcile-media-"));
  const names = [1, 2, 3].map((n) => `00000000-0000-4000-8000-00000000000${n}.jpg`);
  const pool = { query: async (_sql, [key]) => ({ rows: key === names[0] ? [{ id: key }] : [] }) };
  try {
    for (const name of names) await writeFile(join(root, name), "photo");
    for (const name of names.slice(0, 2)) await utimes(join(root, name), new Date(0), new Date(0));
    assert.deepEqual((await reconcileMediaStorage(pool, root)).candidates, [names[1]]);
    assert.equal((await readdir(root)).length, 3);
    await reconcileMediaStorage(pool, root, { apply: true });
    assert.deepEqual((await readdir(root)).sort(), [names[0], names[2]]);
  } finally { await rm(root, { recursive: true }); }
});
