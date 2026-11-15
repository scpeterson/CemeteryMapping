import { isCombinedInspectionReading } from "../../lib/inspectionReadings";
import type { InspectionFace } from "../../types";
import { normalizeInscriptionPlaceholder, inscriptionStatus } from "../../../shared/inscriptionStatus.mjs";
import { currentLegibility, legibilityLabels } from "../../../shared/inscriptionHistory.mjs";
import { HistoricalTranscriptions } from "./HistoricalTranscriptions";

export function InspectionFaceReading({ face }: { face: InspectionFace }) {
  const reading = normalizeInscriptionPlaceholder(face);
  const status = inscriptionStatus(reading.inscriptionStatus, reading.inscription);
  return <>
    <p className="muted">Inscription status: {({ blank: "Blank", illegible: "Illegible", transcribed: "Transcribed", not_recorded: "Not recorded" })[status]}</p>
    <p className="muted">Current legibility: {legibilityLabels[currentLegibility(reading.currentLegibility, status)]}</p>
    {reading.inscription ? <p className="note-box inscription-box">{reading.inscription}</p> : null}
    {reading.historicalTranscriptions?.length ? <HistoricalTranscriptions entries={reading.historicalTranscriptions} /> : null}
  </>;
}

export function InspectionReading({ inscription, faces = [] }: { inscription: string; faces?: InspectionFace[] }) {
  return <>
    {faces.map(face => <div key={face.id}>
      <h5>{face.label}</h5><InspectionFaceReading face={face} />
      {face.designNotes ? <p className="note-box"><strong>Flourishes or designs:</strong> {face.designNotes}</p> : null}
    </div>)}
    {!isCombinedInspectionReading(inscription, faces) ? <>
      <h5>{faces.length ? "Additional / unassigned inscription" : "Inscription"}</h5>
      {inscription ? <p className="note-box inscription-box">{inscription}</p> : <p className="muted">No inscription recorded for this inspection.</p>}
    </> : null}
  </>;
}
