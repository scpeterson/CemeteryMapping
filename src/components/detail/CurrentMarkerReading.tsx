import type { Headstone } from "../../types";
import { sortedMonumentInspections, inspectionTypeLabels } from "../../lib/monumentInspections";
import { formatDate } from "../../lib/format";
import { MarkerFacesView } from "./MarkerFaces";
import { InspectionReading } from "./InspectionFaceReading";

export function CurrentMarkerReading({ headstone }: { headstone: Headstone }) {
  const latest = sortedMonumentInspections(headstone.inspections)[0];
  return <section aria-label="Current marker reading">
    <h4>Current marker reading</h4>
    {latest ? <p><strong>Source inspection:</strong> {latest.inspectedAt ? formatDate(latest.inspectedAt) : `${latest.inspectionYear} (exact date unknown)`} · {inspectionTypeLabels[latest.sourceType]} · {latest.source}</p>
      : <p className="muted">Marker summary — no source inspection recorded.</p>}
    {latest ? <InspectionReading {...latest} /> : <MarkerFacesView headstone={headstone} canDelete={false} />}
  </section>;
}
