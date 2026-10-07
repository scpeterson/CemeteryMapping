import { useMediaUrl } from "../../hooks/useMediaUrl";

export function FullPhoto({ fileUrl, label }: { fileUrl: string; label: string }) {
  const { url, failed, error, retry, reportImageFailure } = useMediaUrl(fileUrl);
  if (failed) return <div role="alert"><p>Photo couldn't be loaded. {error}</p><button type="button" onClick={retry}>Retry photo</button></div>;
  return url ? <img src={url} alt={label} onError={reportImageFailure} /> : <p role="status">Loading photo…</p>;
}
