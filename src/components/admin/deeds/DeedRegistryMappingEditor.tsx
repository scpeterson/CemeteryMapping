import type { FormEvent } from "react";
import { useEffect,useState } from "react";
import { updateDeedRegistryMapping } from "../../../api/cemeteryApi";
import type { DeedRegistryReviewEntry } from "../../../types";
export function DeedRegistryMappingEditor({
  entry,
  onSaved,
}: {
  entry: DeedRegistryReviewEntry;
  onSaved: () => Promise<void>;
}) {
  const [modernSection, setModernSection] = useState(entry.modernSection);
  const [correctedLotText, setCorrectedLotText] = useState(entry.correctedLotText);
  const [correctedLastKnownDate, setCorrectedLastKnownDate] = useState(entry.correctedLastKnownDate || entry.lastKnownDate);
  const [correctedRemarks, setCorrectedRemarks] = useState(entry.correctedRemarks || entry.rawRemarks);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    setModernSection(entry.modernSection);
    setCorrectedLotText(entry.correctedLotText);
    setCorrectedLastKnownDate(entry.correctedLastKnownDate || entry.lastKnownDate);
    setCorrectedRemarks(entry.correctedRemarks || entry.rawRemarks);
  }, [entry.correctedLastKnownDate, entry.correctedLotText, entry.correctedRemarks, entry.lastKnownDate, entry.modernSection, entry.rawRemarks]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(undefined);
    try {
      await updateDeedRegistryMapping(entry.id, {
        modernSection,
        correctedLotText,
        correctedLastKnownDate,
        correctedRemarks,
        reason: `Update modern mapping for deed registry row ${entry.sourceRowNumber}`,
      });
      await onSaved();
      setMessage("Mapping saved.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Unable to save mapping.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="deed-mapping-editor" onSubmit={save} aria-label={`Modern mapping for row ${entry.sourceRowNumber}`}>
      <label>
        ModernSection
        <input value={modernSection} onChange={(event) => setModernSection(event.target.value)} maxLength={100} placeholder="Example: C" />
      </label>
      <label>
        Corrected lot number
        <input value={correctedLotText} onChange={(event) => setCorrectedLotText(event.target.value)} maxLength={500} placeholder="Example: 51" />
      </label>
      <label>
        Last known date
        <input value={correctedLastKnownDate} onChange={(event) => setCorrectedLastKnownDate(event.target.value)} maxLength={50} placeholder="Example: 1944 or 1944-05-12" />
        {entry.lastKnownDate ? <small>Imported value: {entry.lastKnownDate}</small> : null}
      </label>
      <label className="deed-mapping-remarks">
        Remarks
        <textarea value={correctedRemarks} onChange={(event) => setCorrectedRemarks(event.target.value)} maxLength={4000} rows={3} />
        {entry.rawRemarks ? <small>Imported value: {entry.rawRemarks}</small> : null}
      </label>
      <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save mapping"}</button>
      {message ? <small role="status">{message}</small> : null}
    </form>
  );
}
