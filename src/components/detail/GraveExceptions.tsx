import { useState } from "react";
import { findGravesiteExceptions, type GravesiteExceptions } from "../../api/policyApi";
import type { GraveSpace } from "../../types";
import { ExceptionForm } from "../admin/GravesiteExceptions";
import "../admin/policies.css";

export default function GraveExceptions({ grave, onSaved: refresh }: { grave: GraveSpace; onSaved: () => void }) {
  const [plot, setPlot] = useState<GravesiteExceptions>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const burial = plot?.burial
    ? { ashesOnly: plot.burial.max_ashes_without_casket, ashesWithCasket: plot.burial.max_ashes_with_casket }
    : grave.approvedExceptions?.burial;
  const width = plot?.marker?.max_width_inches ?? grave.approvedExceptions?.markerWidth;

  async function openEditor() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const matches = await findGravesiteExceptions(grave.cemeteryId, grave.id);
      const exact = matches.find(match => match.id === grave.uuid);
      if (!exact) throw new Error("This plot could not be loaded. Refresh the gravesite and try again.");
      setPlot(exact);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load approved exceptions.");
    } finally {
      setLoading(false);
    }
  }

  function onSaved(id: string, patch: Partial<Pick<GravesiteExceptions, "burial" | "marker">>) {
    setPlot(current => current?.id === id ? { ...current, ...patch } : current);
    setMessage("Approved exception saved.");
    refresh();
  }

  if (!burial && width == null && !grave.canManageExceptions) return null;
  return <section className="detail-section policies-admin" aria-label="Approved exceptions">
    <h3>Approved exceptions</h3>
    {burial && <p>Burial capacity: Up to {burial.ashesOnly} sets of ashes without a casket, or one casket with {burial.ashesWithCasket} sets of ashes.
      {!grave.locationPolicies?.casket_or_two_urns && " Burial capacity enforcement is inactive for this plot."}</p>}
    {width != null && <p>Maximum flush marker width: {width} inches.</p>}
    {!burial && width == null && <p>No approved exceptions recorded.</p>}
    {grave.canManageExceptions && !plot && <button type="button" disabled={loading} onClick={() => void openEditor()}>
      {burial || width != null ? "Edit approved exceptions" : "Add approved exception"}
    </button>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {grave.canManageExceptions && plot && <>
      <ExceptionForm cemeteryId={grave.cemeteryId} plot={plot} rule="burial" onSaved={onSaved} />
      <ExceptionForm cemeteryId={grave.cemeteryId} plot={plot} rule="marker" onSaved={onSaved} />
    </>}
  </section>;
}
