import { Map, type GeoJSONSource } from "maplibre-gl";

// Instrument actual sources only in the browser fixture; production has no test hooks.
const calls: Record<string, number> = {};
const original = Map.prototype.addSource;
Map.prototype.addSource = function (...args: Parameters<Map["addSource"]>) {
  const result = original.apply(this, args);
  const [id, specification] = args;
  if (specification.type === "geojson") {
    const source = this.getSource(id) as GeoJSONSource;
    const setData = source.setData.bind(source);
    source.setData = (...data: Parameters<GeoJSONSource["setData"]>) => {
      calls[id] = (calls[id] ?? 0) + 1;
      return setData(...data);
    };
  }
  Object.assign(window, { mapHighlightTest: { map: this, calls } });
  return result;
};
await import("../src/main");
