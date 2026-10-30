import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useCemeteryScope } from "../src/hooks/useCemeteryScope";
import type { CemeteryData, CurrentUser } from "../src/types";

export function Harness() {
  const [data, setData] = useState({
    boundaries: [], sections: [], lots: [], lotRestrictedAreas: [],
    graves: [{ id: "g", cemeteryId: "a", cemeteryName: "A" }],
    headstones: [{ id: "m", cemeteryId: "a" }],
  } as unknown as CemeteryData);
  const { mapData } = useCemeteryScope(data, { role: "admin" } as CurrentUser, "a");
  useEffect(() => {
    Object.assign(window, { scopedCollections: { data: mapData, update: () => setData((current) => ({
      ...current, headstones: current.headstones.map((marker) => ({ ...marker, label: "Updated" })),
    })) } });
  }, [mapData]);
  return <p>Scoped collections ready</p>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
