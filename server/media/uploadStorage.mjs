import { mkdir, writeFile, rename, unlink, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export async function stageMediaFile(root, storageKey, bytes) {
  await mkdir(root, { recursive: true });
  const finalPath = join(root, storageKey);
  const pendingPath = `${finalPath}.pending`;
  try {
    await writeFile(pendingPath, bytes, { flag: "wx" });
  } catch (error) {
    await unlink(pendingPath).catch(() => {});
    throw error;
  }
  return {
    publish: () => rename(pendingPath, finalPath),
    async discard() {
      for (const path of [pendingPath, finalPath]) {
        await unlink(path).catch((error) => {
          if (error.code !== "ENOENT") console.error("Unable to clean failed media upload", error);
        });
      }
    },
  };
}

// Run against quiescent storage (uploads stopped). Keep referenced files,
// including soft-deleted evidence. A grace period also protects recent files.
export async function reconcileMediaStorage(pool, root, { apply = false, now = Date.now(), graceMs = 86_400_000 } = {}) {
  const candidates = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isFile() || !/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic|heif)(\.pending)?$/iu.test(entry.name)) continue;
    const path = join(root, entry.name);
    if (now - (await stat(path)).mtimeMs < graceMs) continue;
    const storageKey = entry.name.replace(/\.pending$/u, "");
    const result = await pool.query("SELECT id FROM media_assets WHERE storage_key = $1 LIMIT 1", [storageKey]);
    if (result.rows.length) continue;
    candidates.push(entry.name);
    if (apply) await unlink(path);
  }
  return { apply, candidates };
}
