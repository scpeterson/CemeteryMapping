import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// Bundle the worker and its sibling imports instead of relying on a relative
// URL next to MapLibre's renamed production chunk.
setWorkerUrl(workerUrl);

export * from "maplibre-gl";
