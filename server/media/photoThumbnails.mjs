import { stat } from "node:fs/promises";
import sharp from "sharp";

const maxCacheBytes = 32 * 1024 * 1024;
const maxConcurrent = 2;
const maxPending = 32;

export function createPhotoThumbnails() {
  const cache = new Map();
  const pending = new Map();
  const waiting = [];
  let cacheBytes = 0;
  let active = 0;

  async function generate(path) {
    if (active >= maxConcurrent) await new Promise(resolve => waiting.push(resolve));
    else active++;
    try {
      return await sharp(path, { limitInputPixels: 40_000_000 })
        .autoOrient()
        .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 70 })
        .toBuffer();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  }

  return async function thumbnail(path) {
    const file = await stat(path).catch(() => undefined);
    if (!file?.isFile()) return undefined;
    const key = JSON.stringify([path, file.size, file.mtimeMs, file.ctimeMs]);
    if (cache.has(key)) {
      const bytes = cache.get(key);
      cache.delete(key);
      cache.set(key, bytes);
      return bytes;
    }
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= maxPending) return undefined;
    const result = generate(path).then(bytes => {
      if (bytes.length <= maxCacheBytes) {
        while (cacheBytes + bytes.length > maxCacheBytes) {
          const oldest = cache.keys().next().value;
          cacheBytes -= cache.get(oldest).length;
          cache.delete(oldest);
        }
        cache.set(key, bytes);
        cacheBytes += bytes.length;
      }
      return bytes;
    }).catch(() => undefined).finally(() => pending.delete(key));
    pending.set(key, result);
    return result;
  };
}
