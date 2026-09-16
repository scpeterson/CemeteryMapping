import { useEffect, useState } from "react";
import { authorizedFetch, jsonResponse } from "../api/apiClient";
import { apiBaseUrl } from "../config/environment";

export function useMediaUrl(fileUrl: string) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ source: string; attempt: number; url: string }>();
  const [failure, setFailure] = useState<{ source: string; attempt: number; message: string }>();
  const apiOrigin = new URL(apiBaseUrl, window.location.origin).origin;
  const source = new URL(fileUrl, apiOrigin);
  const protectedMedia = source.origin === apiOrigin && source.pathname.startsWith("/media/");
  const sourceUrl = source.href;

  useEffect(() => {
    if (!protectedMedia) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void authorizedFetch(sourceUrl, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) await jsonResponse(response, "Photo download");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ source: sourceUrl, attempt, url: objectUrl });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFailure({ source: sourceUrl, attempt, message: error instanceof Error ? error.message : "Try loading the photo again." });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sourceUrl, protectedMedia, attempt]);

  const url = protectedMedia ? (loaded?.source === sourceUrl && loaded.attempt === attempt ? loaded.url : undefined) : sourceUrl;
  const error = failure?.source === sourceUrl && failure.attempt === attempt ? failure.message : undefined;
  return {
    url, error, failed: Boolean(error), attempt,
    retry: () => setAttempt((value) => value + 1),
    reportImageFailure: () => setFailure({ source: sourceUrl, attempt, message: "The photo could not be displayed. Try again or contact an administrator if the problem continues." }),
  };
}
