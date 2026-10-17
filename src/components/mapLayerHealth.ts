export const externalMapLayers = {
  "pasda-imagery-2017": "Aerial imagery (PASDA)",
  "allegheny-parcels": "Parcel boundaries (Allegheny County)",
} as const;
export type ExternalMapLayer = keyof typeof externalMapLayers;

type LayerEvent = {
  sourceId?: string;
  sourceDataType?: string;
  isSourceLoaded?: boolean;
  tile?: { state?: string; tileID?: { key: string } };
};

// A successful tile must not hide failures in other tiles of the same layer.
export function createMapLayerHealth(onChange: (failed: ExternalMapLayer[]) => void) {
  const failures = new Map<ExternalMapLayer, Set<string>>();
  const visible = new Set<ExternalMapLayer>();
  const publish = () => onChange([...visible]);
  const identify = (event: LayerEvent) => Object.hasOwn(externalMapLayers, event.sourceId ?? "") ? event.sourceId as ExternalMapLayer : undefined;
  return {
    error(event: LayerEvent) {
      const id = identify(event);
      if (!id) return;
      const keys = failures.get(id) ?? new Set<string>();
      keys.add(event.tile?.tileID?.key ?? "source");
      failures.set(id, keys);
      if (!visible.has(id)) { visible.add(id); publish(); }
    },
    data(event: LayerEvent) {
      const id = identify(event);
      if (!id || !visible.has(id)) return;
      const keys = failures.get(id);
      if (id === "pasda-imagery-2017") {
        // ImageSource emits metadata after a newly requested image decodes successfully.
        if (event.sourceDataType !== "metadata") return;
        keys?.clear();
      } else {
        if (event.tile?.state !== "loaded") return;
        keys?.delete(event.tile.tileID?.key ?? "source");
        keys?.delete("source");
        if (!event.isSourceLoaded) return;
      }
      if (keys?.size) return;
      visible.delete(id);
      publish();
    },
    retry(id: ExternalMapLayer) {
      // Keep the notice until a fresh request succeeds.
      failures.set(id, new Set());
    },
  };
}
