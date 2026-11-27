import { useState, type FormEvent } from "react";
import { findGravesiteExceptions, saveGravesiteException, type GravesiteExceptions } from "../../api/policyApi";
import GravesiteDeeds from "../detail/GravesiteDeeds";

const noDeedReference = "No deed available";

export function ExceptionForm({ cemeteryId, plot, rule, onSaved, noDeed }: {
  cemeteryId: string;
  plot: GravesiteExceptions;
  rule: "burial" | "marker";
  noDeed?: boolean;
  onSaved: (plotId: string, patch: Partial<Pick<GravesiteExceptions, "marker" | "burial">>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saved = plot[rule];
  const defaultApproval = !saved && noDeed ? noDeedReference : "";
  const title = rule === "burial" ? "Burial capacity exception" : "Flush marker width exception";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const common = { cemeteryId, graveId: plot.id, approval: String(form.get("approval") ?? "").trim() || defaultApproval };
    setBusy(true);
    setError("");
    try {
      if (rule === "burial") {
        const burial = await saveGravesiteException({
          ...common, rule, expected: plot.burial, ashesOnly: Number(form.get("ashesOnly")),
          ashesWithCasket: Number(form.get("ashesWithCasket")),
        });
        if ("max_ashes_without_casket" in burial) onSaved(plot.id, { burial });
      } else {
        const marker = await saveGravesiteException({
          ...common, rule, expected: plot.marker, markerWidth: Number(form.get("markerWidth")),
        });
        if ("max_width_inches" in marker) onSaved(plot.id, { marker });
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save the exception.");
    } finally {
      setBusy(false);
    }
  }

  return <form aria-label={title} onSubmit={submit}>
    <fieldset className="gravesite-policy-card" disabled={busy || (rule === "burial" && !plot.capacityEnforced)}>
      <legend>{title}</legend>
      {rule === "burial" && !plot.capacityEnforced && <p>Burial capacity enforcement is inactive for this plot.</p>}
      <div className="policies-fields">
        {rule === "burial" ? <>
          <label className="ui-field">Maximum sets of ashes without a casket
            <input type="number" name="ashesOnly" min="0" max="2147483647" required defaultValue={plot.burial?.max_ashes_without_casket ?? 2} />
          </label>
          <label className="ui-field">Maximum sets of ashes with one casket
            <input type="number" name="ashesWithCasket" min="0" max="2147483647" required defaultValue={plot.burial?.max_ashes_with_casket ?? 1} />
          </label>
        </> : <label className="ui-field">Maximum width (inches)
          <input type="number" name="markerWidth" min="0" max="10000" step="any" required defaultValue={plot.marker?.max_width_inches ?? 28} />
        </label>}
        <label className="ui-field">Written approval reference
          <input name="approval" required={!defaultApproval} maxLength={500} defaultValue={saved?.approval_reference ?? ""} placeholder={defaultApproval || undefined} />
        </label>
      </div>
      {defaultApproval && <p className="muted">Use the written decision if one is available. An exception still requires approval.</p>}
      <button className="ui-button ui-button--primary" type="submit">{saved ? "Update" : "Add"} {rule === "burial" ? "burial exception" : "marker width exception"}</button>
    </fieldset>
    {error && <p className="ui-notice ui-notice--error" role="alert">{error}</p>}
  </form>;
}

export function GravesiteExceptionsPanel({ cemeteryId }: { cemeteryId: string }) {
  const [hasDeed, setHasDeed] = useState<boolean>();
  const [plot, setPlot] = useState<GravesiteExceptions>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("plotId") ?? "").trim();
    setBusy(true);
    setError("");
    setMessage("");
    setPlot(undefined);
    setHasDeed(undefined);
    try {
      const matches = await findGravesiteExceptions(cemeteryId, query);
      if (matches.length === 1) setPlot(matches[0]);
      else setMessage(matches.length ? "Multiple matches. Enter the exact gravesite ID." : "No matching gravesite.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to find the gravesite.");
    } finally {
      setBusy(false);
    }
  }

  function onSaved(plotId: string, patch: Partial<Pick<GravesiteExceptions, "marker" | "burial">>) {
    setPlot(current => current?.id === plotId ? { ...current, ...patch } : current);
    setMessage("Approved exception saved.");
  }

  return <details>
    <summary>Gravesite exceptions</summary>
    <p>Use the approved deed or written decision.</p>
    <form className="gravesite-policy-form" onSubmit={search}>
      <label className="ui-field">Gravesite ID <input name="plotId" placeholder="G-72" required maxLength={50} /></label>
      <button className="ui-button ui-button--secondary" type="submit" disabled={busy}>{busy ? "Finding…" : "Find gravesite"}</button>
    </form>
    {error && <p className="ui-notice ui-notice--error" role="alert">{error}</p>}
    {message && <p className="ui-notice" role="status">{message}</p>}
    {plot && <>
      <h3>Approved exceptions for {plot.plotId}</h3>
      <GravesiteDeeds key={plot.id} cemeteryId={cemeteryId} graveId={plot.id} canUpload onAvailability={setHasDeed} />
      <ExceptionForm noDeed={hasDeed === false} key={`${plot.id}-burial`} cemeteryId={cemeteryId} plot={plot} rule="burial" onSaved={onSaved} />
      <ExceptionForm noDeed={hasDeed === false} key={`${plot.id}-marker`} cemeteryId={cemeteryId} plot={plot} rule="marker" onSaved={onSaved} />
    </>}
  </details>;
}
