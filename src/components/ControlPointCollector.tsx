import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Download, Image as ImageIcon, MapPinned, MousePointer2, Trash2, X } from "lucide-react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import type { CemeteryData } from "../types";
import { fitMapToData } from "./cemeteryMapBounds";
import {
  addBoundaryLayers,
  addGraveLayers,
  addHeadstoneLayers,
  addLotLayers,
  addRasterLayers,
  addSectionLabelLayer,
  addSectionLayers,
  enforceMapLayerOrder,
} from "./cemeteryMapLayers";

type ControlPointCollectorProps = {
  data: CemeteryData;
  onClose: () => void;
};

type PendingImagePoint = {
  x: number;
  y: number;
};

type PendingMapPoint = {
  longitude: number;
  latitude: number;
};

type ImageDimensions = {
  width: number;
  height: number;
};

type ControlPointConfidence = "high" | "medium" | "low";

type ControlPoint = PendingImagePoint &
  PendingMapPoint & {
    id: string;
    sourceImageName: string;
    description: string;
    confidence: ControlPointConfidence;
    createdAt: string;
  };

const center: [number, number] = [-76.70431, 39.19604];
const storageKey = "cemetery-mapping-control-points-v1";

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadStoredControlPoints() {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as ControlPoint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function controlPointFeatureCollection(points: ControlPoint[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: points.map((point, index) => ({
      type: "Feature",
      properties: {
        label: String(index + 1),
        confidence: point.confidence,
      },
      geometry: {
        type: "Point",
        coordinates: [point.longitude, point.latitude],
      },
    })),
  };
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function downloadText(filename: string, contentType: string, text: string) {
  const blob = new Blob([text], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ControlPointCollector({ data, onClose }: ControlPointCollectorProps) {
  const [imageUrl, setImageUrl] = useState<string>();
  const [sourceImageName, setSourceImageName] = useState("");
  const [imageError, setImageError] = useState<string>();
  const [pendingImagePoint, setPendingImagePoint] = useState<PendingImagePoint>();
  const [pendingMapPoint, setPendingMapPoint] = useState<PendingMapPoint>();
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions>();
  const [defaultDescription, setDefaultDescription] = useState("");
  const [defaultConfidence, setDefaultConfidence] = useState<ControlPointConfidence>("medium");
  const [points, setPoints] = useState<ControlPoint[]>(loadStoredControlPoints);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pendingImagePointRef = useRef<PendingImagePoint | undefined>(undefined);
  const pendingMapPointRef = useRef<PendingMapPoint | undefined>(undefined);
  const defaultDescriptionRef = useRef(defaultDescription);
  const defaultConfidenceRef = useRef(defaultConfidence);
  const sourceImageNameRef = useRef(sourceImageName);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    pendingImagePointRef.current = pendingImagePoint;
    pendingMapPointRef.current = pendingMapPoint;
    defaultDescriptionRef.current = defaultDescription;
    defaultConfidenceRef.current = defaultConfidence;
    sourceImageNameRef.current = sourceImageName;
  }, [defaultConfidence, defaultDescription, pendingImagePoint, pendingMapPoint, sourceImageName]);

  const addPoint = useCallback((imagePoint: PendingImagePoint, mapPoint: PendingMapPoint) => {
    setPoints((current) => [
      ...current,
      {
        id: newId(),
        sourceImageName: sourceImageNameRef.current || "Unspecified source image",
        x: Math.round(imagePoint.x * 100) / 100,
        y: Math.round(imagePoint.y * 100) / 100,
        longitude: Number(mapPoint.longitude.toFixed(8)),
        latitude: Number(mapPoint.latitude.toFixed(8)),
        description: defaultDescriptionRef.current,
        confidence: defaultConfidenceRef.current,
        createdAt: new Date().toISOString(),
      },
    ]);
    setPendingImagePoint(undefined);
    setPendingMapPoint(undefined);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(points));
    const source = mapRef.current?.getSource("control-points") as GeoJSONSource | undefined;
    source?.setData(controlPointFeatureCollection(points));
  }, [points]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center,
      zoom: 18.5,
      minZoom: 5,
      maxZoom: 22,
      scrollZoom: true,
      attributionControl: false,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#e7ece5" },
          },
        ],
      },
    });

    map.on("load", () => {
      addRasterLayers(map);
      addBoundaryLayers(map, data);
      fitMapToData(map, data, 0);
      addSectionLayers(map, data);
      addLotLayers(map, data);
      addGraveLayers(map, data.graves, undefined, new Set());
      addHeadstoneLayers(map, data.headstones ?? [], undefined, new Set());
      addSectionLabelLayer(map);

      map.addSource("control-points", { type: "geojson", data: controlPointFeatureCollection(points) });
      map.addLayer({
        id: "control-points-circle",
        type: "circle",
        source: "control-points",
        paint: {
          "circle-color": "#ff1493",
          "circle-radius": 6,
          "circle-stroke-color": "#fffdf5",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "control-points-label",
        type: "symbol",
        source: "control-points",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 12,
          "text-offset": [0, 1.2],
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        },
        paint: {
          "text-color": "#5c1238",
          "text-halo-color": "#fffdf5",
          "text-halo-width": 1.4,
        },
      });
      enforceMapLayerOrder(map);
      map.moveLayer("control-points-circle");
      map.moveLayer("control-points-label");
    });

    const onMapClick = (event: maplibregl.MapMouseEvent) => {
      const mapPoint = {
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
      };
      const imagePoint = pendingImagePointRef.current;
      if (imagePoint) addPoint(imagePoint, mapPoint);
      else setPendingMapPoint(mapPoint);
    };

    map.on("click", onMapClick);
    mapRef.current = map;

    return () => {
      map.off("click", onMapClick);
      map.remove();
      mapRef.current = null;
    };
  }, [addPoint, data, points]);

  const pointJson = useMemo(() => JSON.stringify({ generatedAt: new Date().toISOString(), points }, null, 2), [points]);
  const pointCsv = useMemo(() => {
    const header = ["source_image_name", "image_x", "image_y", "longitude", "latitude", "confidence", "description", "created_at"];
    const rows = points.map((point) => [
      point.sourceImageName,
      point.x,
      point.y,
      point.longitude,
      point.latitude,
      point.confidence,
      point.description,
      point.createdAt,
    ]);
    return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  }, [points]);

  const onImageFileChange = (file: File | undefined) => {
    setImageError(undefined);
    setPendingImagePoint(undefined);
    setImageDimensions(undefined);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    if (!file) {
      setImageUrl(undefined);
      return;
    }
    setSourceImageName(file.name);
    setImageUrl(URL.createObjectURL(file));
  };

  const onImageClick = (event: MouseEvent<HTMLImageElement>) => {
    const image = imageRef.current;
    if (!image || image.naturalWidth === 0 || image.naturalHeight === 0) return;

    const rect = image.getBoundingClientRect();
    const imagePoint = {
      x: ((event.clientX - rect.left) / rect.width) * image.naturalWidth,
      y: ((event.clientY - rect.top) / rect.height) * image.naturalHeight,
    };
    const mapPoint = pendingMapPointRef.current;
    if (mapPoint) addPoint(imagePoint, mapPoint);
    else setPendingImagePoint(imagePoint);
  };

  const updatePoint = (id: string, patch: Partial<Pick<ControlPoint, "description" | "confidence">>) => {
    setPoints((current) => current.map((point) => (point.id === id ? { ...point, ...patch } : point)));
  };

  const deletePoint = (id: string) => {
    setPoints((current) => current.filter((point) => point.id !== id));
  };

  return (
    <aside className="control-point-panel" aria-label="Control point collector">
      <div className="control-point-header">
        <div>
          <p className="eyebrow">Georeferencing</p>
          <h2>Control Point Collector</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close control point collector" title="Close">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="control-point-workspace">
        <section className="control-point-card control-point-image-card" aria-label="Source image control points">
          <div className="control-point-card-header">
            <h3>
              <ImageIcon size={18} aria-hidden="true" />
              Source Image
            </h3>
            {pendingImagePoint ? <span className="control-point-pending">Image point pending</span> : null}
          </div>
          <label className="control-point-field">
            <span>Image file</span>
            <input type="file" accept="image/*,.tif,.tiff" onChange={(event) => onImageFileChange(event.target.files?.[0])} />
          </label>
          <label className="control-point-field">
            <span>Source name</span>
            <input value={sourceImageName} onChange={(event) => setSourceImageName(event.target.value)} placeholder="TIFF2042-01.tif" />
          </label>
          <div className="control-point-image-frame">
            {imageUrl ? (
              <>
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Source scan for control point collection"
                  onClick={onImageClick}
                  onLoad={(event) => setImageDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                  onError={() => setImageError("This browser could not display the selected image. Convert TIFF scans to PNG or JPEG and try again.")}
                  draggable={false}
                />
                {pendingImagePoint && imageDimensions ? (
                  <span
                    className="control-point-image-pending-dot"
                    style={{
                      left: `${(pendingImagePoint.x / imageDimensions.width) * 100}%`,
                      top: `${(pendingImagePoint.y / imageDimensions.height) * 100}%`,
                    }}
                  />
                ) : null}
                {imageDimensions ? points
                  .filter((point) => point.sourceImageName === sourceImageName)
                  .map((point, index) => (
                    <span
                      key={point.id}
                      className="control-point-image-dot"
                      style={{
                        left: `${(point.x / imageDimensions.width) * 100}%`,
                        top: `${(point.y / imageDimensions.height) * 100}%`,
                      }}
                    >
                      {index + 1}
                    </span>
                  )) : null}
              </>
            ) : (
              <div className="control-point-empty">
                <MousePointer2 size={24} aria-hidden="true" />
                Select a scan or converted image, then click a recognizable feature.
              </div>
            )}
          </div>
          {imageError ? <p className="control-point-error">{imageError}</p> : null}
        </section>

        <section className="control-point-card control-point-map-card" aria-label="Map control points">
          <div className="control-point-card-header">
            <h3>
              <MapPinned size={18} aria-hidden="true" />
              Map
            </h3>
            {pendingMapPoint ? <span className="control-point-pending">Map point pending</span> : null}
          </div>
          <div ref={containerRef} className="control-point-map" />
        </section>

        <section className="control-point-card control-point-list-card" aria-label="Collected control points">
          <div className="control-point-card-header">
            <h3>Collected Points</h3>
            <span>{points.length} points</span>
          </div>
          <div className="control-point-defaults">
            <label className="control-point-field">
              <span>Default note</span>
              <input value={defaultDescription} onChange={(event) => setDefaultDescription(event.target.value)} placeholder="Lot 42 southwest corner" />
            </label>
            <label className="control-point-field">
              <span>Default confidence</span>
              <select value={defaultConfidence} onChange={(event) => setDefaultConfidence(event.target.value as ControlPointConfidence)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
          </div>
          <div className="control-point-actions">
            <button type="button" onClick={() => downloadText("cemetery-control-points.json", "application/json", pointJson)}>
              <Download size={16} aria-hidden="true" />
              JSON
            </button>
            <button type="button" onClick={() => downloadText("cemetery-control-points.csv", "text/csv", pointCsv)}>
              <Download size={16} aria-hidden="true" />
              CSV
            </button>
            <button type="button" onClick={() => setPoints([])} disabled={points.length === 0}>
              <Trash2 size={16} aria-hidden="true" />
              Clear
            </button>
          </div>
          <ol className="control-point-list">
            {points.map((point, index) => (
              <li key={point.id}>
                <div className="control-point-row-heading">
                  <strong>Point {index + 1}</strong>
                  <button type="button" onClick={() => deletePoint(point.id)} aria-label={`Delete point ${index + 1}`} title="Delete point">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
                <dl>
                  <dt>Image</dt>
                  <dd>
                    {point.x}, {point.y}
                  </dd>
                  <dt>Map</dt>
                  <dd>
                    {point.longitude}, {point.latitude}
                  </dd>
                </dl>
                <label className="control-point-field">
                  <span>Note</span>
                  <input value={point.description} onChange={(event) => updatePoint(point.id, { description: event.target.value })} />
                </label>
                <label className="control-point-field">
                  <span>Confidence</span>
                  <select value={point.confidence} onChange={(event) => updatePoint(point.id, { confidence: event.target.value as ControlPointConfidence })}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </aside>
  );
}
