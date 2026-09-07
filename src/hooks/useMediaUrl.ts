import { useEffect, useState } from "react";
import { authorizedFetch } from "../api/apiClient";
import { apiBaseUrl } from "../config/environment";

export function useMediaUrl(fileUrl: string) {
  const [loaded, setLoaded] = useState<{ source: string; url: string }>();
  const [failedSource, setFailedSource] = useState<string>();
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
        if (!response.ok) throw new Error("Unable to load photo");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ source: sourceUrl, url: objectUrl });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedSource(sourceUrl);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sourceUrl, protectedMedia]);

  const url = protectedMedia ? (loaded?.source === sourceUrl ? loaded.url : undefined) : sourceUrl;
  return { url, failed: failedSource === sourceUrl };
}
