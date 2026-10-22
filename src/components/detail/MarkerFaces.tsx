import { HistoricalTranscriptions } from "./HistoricalTranscriptions";
import { currentLegibility, legibilityLabels } from "../../../shared/inscriptionHistory.mjs";
import { InscriptionFields } from "./InscriptionFields";
import { inscriptionStatus } from "../../../shared/inscriptionStatus.mjs";
import { useId, useState, type ComponentProps } from "react";
import type { Headstone, MarkerFace } from "../../types";
import { MediaGallery } from "./MediaRecords";
import { isEmptyNewMarkerFace } from "../../lib/markerFaces";

const statusLabels = { not_recorded: "Not recorded", transcribed: "Transcribed", blank: "Blank", illegible: "Illegible" };

export function MarkerFacesEditor({ headstone, faces, disabled, onChange }: {
  headstone: Headstone; faces: MarkerFace[]; disabled: boolean; onChange: (faces: MarkerFace[]) => void;
}) {
  const labelListId = useId();
  const [manageFaces, setManageFaces] = useState(() => faces.length > 1 || faces.some((face) => face.label !== "Unspecified face"));
  if (!manageFaces) return <div className="headstone-wide-field marker-inscription-editor">
    <InscriptionFields text={faces[0]?.inscription ?? ""} status={faces[0]?.inscriptionStatus ?? headstone.inscriptionStatus} currentLegibility={faces[0]?.currentLegibility ?? headstone.currentLegibility} historicalTranscriptions={faces[0]?.historicalTranscriptions ?? headstone.historicalTranscriptions} disabled={disabled}
      onChange={(value) => onChange([{ ...(faces[0] ?? { id: crypto.randomUUID(), label: "Unspecified face", notes: "", burialIds: [], mediaAssetIds: [] }), ...value }])} />
    <button type="button" className="icon-text-button" disabled={disabled} onClick={() => setManageFaces(true)}>Manage faces</button>
    <p className="muted">For separate inscriptions on multiple sides, use Manage faces.</p>
  </div>;

  const update = (id: string, changes: Partial<MarkerFace>) => onChange(faces.map((face) => face.id === id ? { ...face, ...changes } : face));
  const toggle = (face: MarkerFace, field: "burialIds" | "mediaAssetIds", id: string, checked: boolean) =>
    update(face.id, { [field]: checked ? [...face[field], id] : face[field].filter((item) => item !== id) });
  const people = headstone.facePeople ?? [];
  const photos = (headstone.mediaAssets ?? []).filter((asset) => asset.assetType === "photo");
  return <fieldset className="headstone-wide-field marker-faces-editor" disabled={disabled}>
    <legend>Faces / Inscriptions</legend>
    <p className="muted">Label each side or surface, such as North, Front, or Base. Keep line breaks in the transcription. Leave orientation unspecified when unknown.</p>
    <datalist id={labelListId}>{["Unspecified face", "North", "East", "South", "West", "Front", "Back", "Base"].map((label) => <option key={label} value={label} />)}</datalist>
    {faces.map((face, index) => <fieldset key={face.id} className="headstone-form marker-face-editor">
      <legend>Face {index + 1}</legend>
      <label className="headstone-wide-field">Face label
        <input value={face.label} list={labelListId} maxLength={100} required={!isEmptyNewMarkerFace(face, headstone)} onChange={(event) => update(face.id, { label: event.target.value })} />
      </label>
      <InscriptionFields text={face.inscription} status={face.inscriptionStatus} currentLegibility={face.currentLegibility} historicalTranscriptions={face.historicalTranscriptions} onChange={(value) => update(face.id, value)} />
      <label className="headstone-wide-field">Flourishes or designs
        <textarea value={face.designNotes ?? ""} rows={3} maxLength={20000} onChange={(event) => update(face.id, { designNotes: event.target.value })} />
      </label>
      <label className="headstone-wide-field">Face notes
        <textarea value={face.notes} rows={2} maxLength={4000} onChange={(event) => update(face.id, { notes: event.target.value })} />
      </label>
      <fieldset className="headstone-wide-field"><legend>Associated people</legend>
        {people.length === 0 ? <p className="muted">No people are linked to this marker yet.</p> : people.map((person) => <label key={person.id} className="headstone-checkbox-field">
          <input type="checkbox" checked={face.burialIds.includes(person.id)} onChange={(event) => toggle(face, "burialIds", person.id, event.target.checked)} />{person.fullName}
        </label>)}
        {face.burialIds.filter((id) => !people.some((p) => p.id === id)).map((id) => <label key={id} className="headstone-checkbox-field">
          <input type="checkbox" checked onChange={() => toggle(face, "burialIds", id, false)} />Person no longer linked — uncheck to remove
        </label>)}
      </fieldset>
      <fieldset className="headstone-wide-field"><legend>Face photos</legend>
        <p className="muted">Choose from this marker’s photos. To add a new photo, save the marker, upload it below, then assign it to a face.</p>
        {photos.map((asset) => <label key={asset.id} className="headstone-checkbox-field">
          <input type="checkbox" checked={face.mediaAssetIds.includes(asset.id)} onChange={(event) => toggle(face, "mediaAssetIds", asset.id, event.target.checked)} />{asset.originalFilename || asset.notes || "Marker photo"}
        </label>)}
        {face.mediaAssetIds.filter((id) => !photos.some((p) => p.id === id)).map((id) => <label key={id} className="headstone-checkbox-field">
          <input type="checkbox" checked onChange={() => toggle(face, "mediaAssetIds", id, false)} />Photo no longer linked — uncheck to remove
        </label>)}
      </fieldset>
      <button type="button" className="secondary-button" onClick={() => {
        if (window.confirm(`Remove face “${face.label || index + 1}” and its transcription? The people and photos will remain on the marker.`)) onChange(faces.filter((item) => item.id !== face.id));
      }}>Remove face</button>
    </fieldset>)}
    <button type="button" className="secondary-button" disabled={faces.length >= 32} onClick={() => onChange([...faces, {
      id: crypto.randomUUID(), label: "", inscription: "", notes: "", burialIds: [], mediaAssetIds: [],
    }])}>Add face</button>
    <p className="muted">Add face starts another face. Save marker saves your changes; empty new faces are ignored.</p>
  </fieldset>;
}

export function MarkerFacesView({ headstone, ...photoControls }: { headstone: Headstone } & Pick<ComponentProps<typeof MediaGallery>, "canDelete" | "onDelete" | "onMove">) {
  const faces: MarkerFace[] = headstone.faces ?? (headstone.inscription ? [{ id: "legacy", label: "Unspecified face", inscription: headstone.inscription, notes: "", burialIds: [], mediaAssetIds: [] }] : []);
  const faceHistoryIds = new Set(faces.flatMap((face) => (face.historicalTranscriptions ?? []).map((entry) => entry.id)));
  const monumentHistory = headstone.historicalTranscriptions?.filter((entry) => !faceHistoryIds.has(entry.id));
  return <section aria-label="Faces / Inscriptions">
    <h4>Faces / Inscriptions</h4>
    {!faces.length ? <div>
      <p className="muted">Current legibility: {legibilityLabels[currentLegibility(headstone.currentLegibility, headstone.inscriptionStatus)]}</p>
      <p className="muted">Inscription status: {statusLabels[inscriptionStatus(headstone.inscriptionStatus, headstone.inscription)]}</p>
      {headstone.inscription ? <p className="note-box inscription-box">{headstone.inscription}</p> : null}
    </div> : faces.map((face) => <section key={face.id} className="marker-face-view" aria-label={face.label}>
      <h5>{face.label}</h5>
      <p className="muted">Current legibility: {legibilityLabels[currentLegibility(face.currentLegibility, face.inscriptionStatus)]}</p>
      <p className="muted">Inscription status: {statusLabels[inscriptionStatus(face.inscriptionStatus, face.inscription)]}</p>
      {face.inscription ? <p className="note-box inscription-box">{face.inscription}</p> : null}
      <HistoricalTranscriptions entries={face.historicalTranscriptions} />
      {face.designNotes ? <p className="note-box">Designs: {face.designNotes}</p> : null}
      {face.notes ? <p className="note-box">{face.notes}</p> : null}
      {face.burialIds.length ? <p>Associated people: {face.burialIds.map((id) => headstone.facePeople?.find((p) => p.id === id)?.fullName ?? "Person no longer linked").join("; ")}</p> : null}
      {face.mediaAssetIds.length ? <MediaGallery {...photoControls} assets={headstone.mediaAssets.filter((asset) => face.mediaAssetIds.includes(asset.id))} emptyMessage="These face photos are no longer available." /> : null}
    </section>)}
    {monumentHistory?.length ? <HistoricalTranscriptions entries={monumentHistory} /> : null}
  </section>;
}
