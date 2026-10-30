import { useEffect, useState, useSyncExternalStore } from "react";
import { getAuthSessionVersion, subscribeAuthSession } from "../api/apiClient";
import { sharedMediaDownloads } from "../lib/sharedMediaDownloads";
import { apiBaseUrl } from "../config/environment";

export function useMediaUrl(fileUrl: string, enabled = true) {
  const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionVersion);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ source: string; attempt: number; session: number; url: string }>();
  const [failure, setFailure] = useState<{ source: string; attempt: number; session: number; message: string }>();
  const apiOrigin = new URL(apiBaseUrl, window.location.origin).origin;
  const source = new URL(fileUrl, apiOrigin);
  const protectedMedia = source.origin === apiOrigin && source.pathname.startsWith("/media/");
  const sourceUrl = source.href;

  useEffect(() => {
    if (!protectedMedia || !enabled) return;
    let subscribed = true;
    const download = sharedMediaDownloads.acquire(sourceUrl, attempt > 0);
    void download.promise.then((url) => {
      if (subscribed) setLoaded({ source: sourceUrl, attempt, session, url });
    }).catch((error: unknown) => {
      if (subscribed) setFailure({ source: sourceUrl, attempt, session, message: error instanceof Error ? error.message : "Try loading the photo again." });
    });
    return () => { subscribed = false; download.release(); };
  }, [sourceUrl, protectedMedia, attempt, enabled, session]);

  const url = protectedMedia ? (loaded?.source === sourceUrl && loaded.attempt === attempt && loaded.session === session && enabled ? loaded.url : undefined) : sourceUrl;
  const error = failure?.source === sourceUrl && failure.attempt === attempt && failure.session === session ? failure.message : undefined;
  return {
    url, error, failed: Boolean(error), attempt,
    retry: () => setAttempt((value) => value + 1),
    reportImageFailure: () => setFailure({ source: sourceUrl, attempt, session, message: "The photo could not be displayed. Try again or contact an administrator if the problem continues." }),
  };
}
