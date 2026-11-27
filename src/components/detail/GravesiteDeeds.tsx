import { useEffect, useState, type FormEvent } from "react";
import { authorizedFetch, jsonResponse, normalizeBaseUrl } from "../../api/apiClient";
import { apiBaseUrl } from "../../config/environment";

type Deed = { id: string; filename: string };

export default function GravesiteDeeds({ cemeteryId, graveId, canUpload, onAvailability, onUploaded }: {
  cemeteryId: string;
  graveId: string;
  canUpload: boolean;
  onUploaded?: () => void;
  onAvailability: (hasDeed: boolean) => void;
}) {
  const [deeds, setDeeds] = useState<Deed[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const url = `${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/grave-spaces/${encodeURIComponent(graveId)}/deeds`;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const list = await jsonResponse<Deed[]>(await authorizedFetch(url, { signal: controller.signal }), "Gravesite deeds");
        if (!controller.signal.aborted) {
          setDeeds(list);
          onAvailability(list.length > 0);
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load deeds.");
      }
    }
    void load();
    return () => controller.abort();
  }, [url, onAvailability]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("deed");
    if (!(file instanceof File) || !file.size) return;
    setBusy(true);
    setError("");
    try {
      const response = await authorizedFetch(`${url}?${new URLSearchParams({ filename: file.name })}`, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      const deed = await jsonResponse<Deed>(response, "Gravesite deed upload");
      setDeeds(current => [deed, ...(current ?? [])]);
      onAvailability(true);
      form.reset();
      onUploaded?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to upload the deed.");
    } finally {
      setBusy(false);
    }
  }

  async function download(deed: Deed) {
    setError("");
    try {
      const response = await authorizedFetch(`${url}/${encodeURIComponent(deed.id)}`);
      if (!response.ok) await jsonResponse(response, "Gravesite deed download");
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = deed.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to download the deed.");
    }
  }

  return <section className="detail-section gravesite-deeds" aria-label="Gravesite deeds">
    <h3>Gravesite deeds</h3>
    {deeds?.length === 0 && <p className="muted">No deed available</p>}
    {!!deeds?.length && <label className="checkbox-row"><input type="checkbox" checked readOnly disabled />Deed on file</label>}
    {!!deeds?.length && <ul className="gravesite-deed-list">{deeds.map(deed => <li key={deed.id}>
      <button className="ui-button ui-button--secondary" type="button" onClick={() => void download(deed)}>Download {deed.filename}</button>
    </li>)}</ul>}
    {canUpload && <form className="gravesite-policy-form" onSubmit={upload}>
      <label className="ui-field">Deed PDF <input type="file" accept=".pdf,application/pdf" name="deed" required disabled={busy} /></label>
      <button className="ui-button" type="submit" disabled={busy || !deeds}>{busy ? "Uploading…" : "Upload deed"}</button>
    </form>}
    {error && <p className="ui-notice ui-notice--error" role="alert">{error}</p>}
  </section>;
}
