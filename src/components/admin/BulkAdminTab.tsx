import type { FormEvent } from "react";
import { ListChecks } from "lucide-react";
import type { CemeteryAdminRecords, HeadstoneLookups } from "../../types";

type BulkAdminTabProps = {
  reason: string;
  setReason: (value: string) => void;
  markerIdentifiers: string;
  setMarkerIdentifiers: (value: string) => void;
  markerTypeId: string;
  setMarkerTypeId: (value: string) => void;
  markerMaterialId: string;
  setMarkerMaterialId: (value: string) => void;
  markerConditionId: string;
  setMarkerConditionId: (value: string) => void;
  gravesiteIdentifiers: string;
  setGravesiteIdentifiers: (value: string) => void;
  lotId: string;
  setLotId: (value: string) => void;
  northHillsNote: string;
  setNorthHillsNote: (value: string) => void;
  selectedNorthHillsCount: number;
  savingKey?: string;
  lookups: HeadstoneLookups;
  cemeteryRecords: CemeteryAdminRecords;
  onSaveMarkers: (event: FormEvent<HTMLFormElement>) => void;
  onAssignLot: (event: FormEvent<HTMLFormElement>) => void;
  onMarkReadingsReviewed: () => void;
  onAddReadingNote: () => void;
  onOpenReadings: () => void;
};

export function BulkAdminTab({
  reason, setReason, markerIdentifiers, setMarkerIdentifiers, markerTypeId, setMarkerTypeId,
  markerMaterialId, setMarkerMaterialId, markerConditionId, setMarkerConditionId,
  gravesiteIdentifiers, setGravesiteIdentifiers, lotId, setLotId, northHillsNote,
  setNorthHillsNote, selectedNorthHillsCount, savingKey, lookups, cemeteryRecords,
  onSaveMarkers, onAssignLot, onMarkReadingsReviewed, onAddReadingNote, onOpenReadings,
}: BulkAdminTabProps) {
  return <>
    <section className="admin-section">
      <div className="section-title"><ListChecks size={17} aria-hidden="true" /><h3>Bulk Edit Tools</h3></div>
      <label>Change reason<input value={reason} onChange={(event) => setReason(event.target.value)} title="Required audit reason used for all bulk edits from this tab." /></label>
    </section>
    <section className="admin-section bulk-tool-grid">
      <form className="admin-form bulk-tool-card" onSubmit={onSaveMarkers}>
        <h4>Markers</h4>
        <label className="wide-field">Marker IDs<textarea value={markerIdentifiers} onChange={(event) => setMarkerIdentifiers(event.target.value)} rows={5} placeholder={"TLC-HS-0179\nTLC-HS-0180"} title="Enter marker public IDs or UUIDs separated by lines, commas, semicolons, or spaces." /></label>
        <label>Marker type<select value={markerTypeId} onChange={(event) => setMarkerTypeId(event.target.value)}><option value="">No change</option>{lookups.markerTypes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label>Material<select value={markerMaterialId} onChange={(event) => setMarkerMaterialId(event.target.value)}><option value="">No change</option>{lookups.materials.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label>Condition<select value={markerConditionId} onChange={(event) => setMarkerConditionId(event.target.value)}><option value="">No change</option>{lookups.conditions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <div className="admin-form-actions"><button type="submit" disabled={savingKey === "headstones" || !reason.trim()}>{savingKey === "headstones" ? "Saving..." : "Update markers"}</button></div>
      </form>
      <form className="admin-form bulk-tool-card" onSubmit={onAssignLot}>
        <h4>Gravesites</h4>
        <label className="wide-field">Gravesite IDs<textarea value={gravesiteIdentifiers} onChange={(event) => setGravesiteIdentifiers(event.target.value)} rows={5} placeholder={"C-0198A\nC-0198B"} title="Enter gravesite public IDs or UUIDs separated by lines, commas, semicolons, or spaces." /></label>
        <label className="wide-field">Assign to lot<select value={lotId} onChange={(event) => setLotId(event.target.value)}><option value="">Select lot</option>{cemeteryRecords.lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.sectionId ? `${lot.sectionId}-` : ""}{lot.lotId}{lot.name ? `: ${lot.name}` : ""}</option>)}</select></label>
        <div className="admin-form-actions"><button type="submit" disabled={savingKey === "gravesites" || !reason.trim()}>{savingKey === "gravesites" ? "Saving..." : "Assign lot"}</button></div>
      </form>
      <section className="admin-form bulk-tool-card">
        <h4>NHG Readings</h4><p className="bulk-tool-help">Select NHG readings on the Readings tab, then apply one of these actions.</p>
        <dl className="bulk-tool-summary"><div><dt>Selected</dt><dd>{selectedNorthHillsCount}</dd></div></dl>
        <label className="wide-field">Shared note<textarea value={northHillsNote} onChange={(event) => setNorthHillsNote(event.target.value)} rows={4} placeholder="Apply this source note to selected readings" /></label>
        <div className="admin-form-actions">
          <button type="button" onClick={onMarkReadingsReviewed} disabled={savingKey === "northHillsReviewed" || !selectedNorthHillsCount || !reason.trim()}>{savingKey === "northHillsReviewed" ? "Saving..." : "Mark reviewed"}</button>
          <button type="button" className="secondary-button" onClick={onAddReadingNote} disabled={savingKey === "northHillsNote" || !selectedNorthHillsCount || !northHillsNote.trim() || !reason.trim()}>{savingKey === "northHillsNote" ? "Saving..." : "Apply note"}</button>
          <button type="button" className="secondary-button" onClick={onOpenReadings}>Go to Readings</button>
        </div>
      </section>
    </section>
  </>;
}
