import { authorizedFetch, jsonResponse, subscribeAuthSession } from "../api/apiClient";

type Download = {
  controller: AbortController;
  promise: Promise<string>;
  users: number;
  url?: string;
  disposed: boolean;
};

type MediaDownloadOptions = {
  fetchBlob?: (source: string, signal: AbortSignal) => Promise<Blob>;
  createUrl?: (blob: Blob) => string;
  revokeUrl?: (url: string) => void;
};

/** Shares only active consumers' downloads; the last release removes the entry. */
export function createMediaDownloads({
  fetchBlob = async (source, signal) => {
    const response = await authorizedFetch(source, { signal, cache: "no-store" });
    if (!response.ok) await jsonResponse(response, "Photo download");
    return response.blob();
  },
  createUrl = (blob) => URL.createObjectURL(blob), revokeUrl = (url) => URL.revokeObjectURL(url),
}: MediaDownloadOptions = {}) {
  const current = new Map<string, Download>();
  const active = new Set<Download>();
  const dispose = (source: string, entry: Download) => {
    if (entry.disposed) return;
    entry.disposed = true;
    entry.controller.abort();
    if (entry.url) revokeUrl(entry.url);
    if (current.get(source) === entry) current.delete(source);
    active.delete(entry);
  };
  return {
    acquire(source: string, fresh = false) {
      let entry = current.get(source);
      if (!entry || fresh) {
        const controller = new AbortController();
        const download: Download = { controller, users: 0, disposed: false, promise: Promise.resolve("") };
        current.set(source, download);
        active.add(download);
        download.promise = Promise.resolve().then(() => {
          controller.signal.throwIfAborted();
          return fetchBlob(source, controller.signal);
        }).then((blob) => {
          controller.signal.throwIfAborted();
          download.url = createUrl(blob);
          return download.url;
        }).catch((error) => {
          if (current.get(source) === download) current.delete(source);
          throw error;
        });
        entry = download;
      }
      const acquired = entry;
      acquired.users++;
      let released = false;
      return {
        promise: acquired.promise,
        release() {
          if (released) return;
          released = true;
          if (--acquired.users === 0) dispose(source, acquired);
        },
      };
    },
    clear() {
      for (const entry of active) {
        entry.disposed = true;
        entry.controller.abort();
        if (entry.url) revokeUrl(entry.url);
      }
      active.clear();
      current.clear();
    },
  };
}

export const sharedMediaDownloads = createMediaDownloads();
subscribeAuthSession(() => sharedMediaDownloads.clear());
