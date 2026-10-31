import { useEffect, useState, type FormEvent } from "react";
import type { CreateGraveSpaceInput, GraveSpace, HeadstoneSummary } from "../types";
import { Modal } from "./ui/Modal";

export function CreateGraveSpaceForm({ cemeteryId, cemeteries, monuments, selectedMonumentId, isPickingMonument = false, canChooseCemetery, onCemeteryChange, onPickMonument, point, onPickPoint, onCancel, onSaved, onSave }: {
  cemeteryId: string;
  cemeteries?: { id: string; name: string }[];
  monuments?: HeadstoneSummary[];
  selectedMonumentId?: string;
  isPickingMonument?: boolean;
  canChooseCemetery?: boolean;
  onCemeteryChange?: (id: string) => void;
  onPickMonument?: () => void;
  point?: { latitude: number; longitude: number };
  onPickPoint: () => void;
  onCancel: () => void;
  onSaved: (grave: GraveSpace, monumentChoice: string, coordinates: { latitude: number; longitude: number }) => Promise<void> | void;
  onSave: (cemeteryId: string, input: CreateGraveSpaceInput) => Promise<GraveSpace>;
}) {
  const [form, setForm] = useState({ status: "unknown", cost: "" });
  const [monumentChoice, setMonumentChoice] = useState("");
  useEffect(() => { if (selectedMonumentId) setMonumentChoice(selectedMonumentId); }, [selectedMonumentId]);
  const selectedMonument = (monuments ?? []).find((monument) => monument.id === monumentChoice);
  const cemeterySelected = Boolean(cemeteryId);
  const [coordinates, setCoordinates] = useState({ latitude: "", longitude: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    if (point) setCoordinates({ latitude: point.latitude.toFixed(7), longitude: point.longitude.toFixed(7) });
  }, [point]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const latitude = Number(coordinates.latitude);
    const longitude = Number(coordinates.longitude);
    const hasExistingMonument = Boolean(monumentChoice && monumentChoice !== "__new__");
    if (!hasExistingMonument && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
      setError("Enter valid latitude and longitude coordinates, or pick a location on the map."); return;
    }
    setSaving(true); setError("");
    try {
      const saved = await onSave(cemeteryId, { ...form, status: form.status as CreateGraveSpaceInput["status"], latitude: hasExistingMonument ? 0 : latitude, longitude: hasExistingMonument ? 0 : longitude, anchorMode: monumentChoice ? "monument" : "gravesite", ...(hasExistingMonument ? { monumentId: monumentChoice } : {}) });
      await onSaved(saved, monumentChoice, { latitude, longitude });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create gravesite."); }
    finally { setSaving(false); }
  }
  return <Modal open={!isPickingMonument} className="create-gravesite-modal" label="Add gravesite" onClose={onCancel}>
    <header className="create-gravesite-header"><div><p className="eyebrow">Cemetery records</p><h2>Add gravesite</h2><p>Place a new gravesite on the map, then add its identifying details.</p></div><button type="button" className="ui-button ui-button--secondary" onClick={onCancel} aria-label="Close">Close</button></header>
    <form className="create-gravesite-form" onSubmit={submit}>
      {canChooseCemetery ? <label>Cemetery<select required value={cemeteryId} onChange={(event) => onCemeteryChange?.(event.target.value)}><option value="">Select a cemetery</option>{(cemeteries ?? []).map((cemetery) => <option key={cemetery.id} value={cemetery.id}>{cemetery.name}</option>)}</select></label> : null}
      <div className="create-gravesite-context"><strong>Section, lot, and gravesite ID</strong><span>Determined automatically from the selected map location.</span></div>
      <label className="create-gravesite-wide">Monument<select disabled={!cemeterySelected} aria-describedby="monument-help" value={monumentChoice} onChange={(event) => { setMonumentChoice(event.target.value); if (event.target.value && event.target.value !== "__new__") setCoordinates({ latitude: "", longitude: "" }); }}><option value="">{cemeterySelected ? "No monument for this gravesite" : "Select a cemetery first"}</option>{(monuments ?? []).length ? <option disabled value="__existing__">Select an existing monument:</option> : null}{(monuments ?? []).map((monument) => <option key={monument.id} value={monument.id}>{monument.headstoneId}</option>)}{cemeterySelected ? <option value="__new__">Create a new monument</option> : null}</select></label>
      {onPickMonument ? <button disabled={!cemeterySelected} type="button" className="ui-button ui-button--secondary create-gravesite-wide" onClick={onPickMonument}>Choose an existing monument on the map</button> : null}
      {monumentChoice && monumentChoice !== "__new__" ? <div className="create-gravesite-selected-monument create-gravesite-wide"><strong>Selected monument: {selectedMonument?.headstoneId ?? "Monument selected from map"}</strong><span>This monument supplies the gravesite’s coordinates, section, and lot.</span></div> : null}
      <p id="monument-help" className="create-gravesite-help create-gravesite-wide">Choose an existing monument if this gravesite belongs with it. Otherwise leave this as “No monument” or create a new monument.</p>
      <label>Status<select disabled={!cemeterySelected} value={form.status} onChange={(e) => update("status", e.target.value)}>{["unknown", "available", "reserved", "occupied", "sold", "needs_review"].map((status) => <option key={status}>{status}</option>)}</select></label>
      {monumentChoice && monumentChoice !== "__new__" ? <div className="create-gravesite-location"><strong>Existing monument selected</strong><span>The monument’s stored coordinates, section, and lot will be used.</span></div> : <fieldset className="create-gravesite-location"><legend>Location</legend><p>Enter GPS coordinates or choose the point on the map.</p><div className="create-gravesite-coordinate-grid"><label>Latitude<input disabled={!cemeterySelected} required inputMode="decimal" placeholder="40.6012345" value={coordinates.latitude} onChange={(event) => setCoordinates((current) => ({ ...current, latitude: event.target.value }))} /></label><label>Longitude<input disabled={!cemeterySelected} required inputMode="decimal" placeholder="-80.0801234" value={coordinates.longitude} onChange={(event) => setCoordinates((current) => ({ ...current, longitude: event.target.value }))} /></label></div><div className="create-gravesite-or"><span>or</span></div><div className="create-gravesite-placement"><div><strong>{point ? "Map location selected" : "No map location selected"}</strong><span>{point ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` : "Use the map to place the gravesite."}</span></div><button disabled={!cemeterySelected} type="button" className="ui-button ui-button--secondary" onClick={onPickPoint}>{point ? "Change map location" : "Pick on map"}</button></div></fieldset>}
      {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
      <div className="ui-actions"><button type="button" className="ui-button ui-button--secondary" onClick={onCancel} disabled={saving}>Cancel</button><button type="submit" className="ui-button" disabled={saving || !cemeteryId}>{saving ? "Saving…" : "Create gravesite"}</button></div>
    </form>
  </Modal>;
}
