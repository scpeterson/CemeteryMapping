import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useSelectedRecordDetails } from "../src/hooks/useSelectedRecordDetails";
import type { GraveSpaceSummary, HeadstoneSummary } from "../src/types";

export function Harness() {
  const [selectedGrave, setGrave] = useState<GraveSpaceSummary>();
  const [selectedHeadstone, setMarker] = useState<HeadstoneSummary>();
  const details = useSelectedRecordDetails({ selectedGrave, selectedHeadstone });
  return <>
    <button onClick={() => { setMarker(undefined); setGrave({ id: "A", cemeteryId: "one" } as GraveSpaceSummary); }}>Grave A</button>
    <button onClick={() => { setMarker(undefined); setGrave({ id: "B", cemeteryId: "one" } as GraveSpaceSummary); }}>Grave B</button>
    <button onClick={() => setGrave({ id: "A", cemeteryId: "two" } as GraveSpaceSummary)}>Other cemetery</button>
    <button onClick={() => setMarker({ id: "marker" } as HeadstoneSummary)}>Marker</button>
    <button onClick={() => { setGrave(current => current && { ...current, lot: "updated" }); setMarker(current => current && { ...current, label: "updated" }); }}>Replace summaries</button>
    <button onClick={() => details.refreshDetails()}>Refresh</button>
    <button onClick={() => details.refreshDetails({ preserveCurrent: true })}>Preserve refresh</button>
    <button onClick={() => { setGrave(undefined); setMarker(undefined); }}>Clear</button>
    <output data-testid="details">{JSON.stringify({ grave: details.selectedGraveDetails, marker: details.selectedHeadstoneDetails, owners: details.selectedGraveOwners, loading: details.isDetailLoading, error: details.detailError })}</output>
  </>;
}

createRoot(document.getElementById("root")!).render(<Harness />);
