import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Download, Image as ImageIcon, MapPinned, Maximize2, MousePointer2, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
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

type ImagePanStart = {
  clientX: number;
  clientY: number;
  scrollLeft: number;
  scrollTop: number;
  hasMoved: boolean;
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
const sourceFileOptions = ["TIFF2042-01.tif", "TIFF2043-01.tif", "Other source"] as const;
const minImageZoom = 0.5;
const maxImageZoom = 4;
const imageZoomStep = 0.25;

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
  const [sourceImageName, setSourceImageName] = useState<(typeof sourceFileOptions)[number]>("TIFF2042-01.tif");
  const [customSourceImageName, setCustomSourceImageName] = useState("");
  const [displayImageName, setDisplayImageName] = useState("");
  const [imageError, setImageError] = useState<string>();
  const [pendingImagePoint, setPendingImagePoint] = useState<PendingImagePoint>();
  const [pendingMapPoint, setPendingMapPoint] = useState<PendingMapPoint>();
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions>();
  const [imageZoom, setImageZoom] = useState(1);
  const [defaultDescription, setDefaultDescription] = useState("");
  const [defaultConfidence, setDefaultConfidence] = useState<ControlPointConfidence>("medium");
  const [points, setPoints] = useState<ControlPoint[]>(loadStoredControlPoints);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const imageFrameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const imagePanStartRef = useRef<ImagePanStart | undefined>(undefined);
  const pendingImagePointRef = useRef<PendingImagePoint | undefined>(undefined);
  const pendingMapPointRef = useRef<PendingMapPoint | undefined>(undefined);
  const defaultDescriptionRef = useRef(defaultDescription);
  const defaultConfidenceRef = useRef(defaultConfidence);
  const exportSourceName = sourceImageName === "Other source" ? customSourceImageName.trim() : sourceImageName;
  const sourceImageNameRef = useRef(exportSourceName);

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
    sourceImageNameRef.current = exportSourceName;
  }, [defaultConfidence, defaultDescription, exportSourceName, pendingImagePoint, pendingMapPoint]);

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
    setImageZoom(1);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    if (!file) {
      setImageUrl(undefined);
      setDisplayImageName("");
      return;
    }
    setDisplayImageName(file.name);
    if (file.name === "TIFF2042-01.tif" || file.name === "TIFF2043-01.tif") setSourceImageName(file.name);
    setImageUrl(URL.createObjectURL(file));
  };

  const recordImagePoint = (event: PointerEvent<HTMLElement>) => {
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

  const onImagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const frame = imageFrameRef.current;
    if (!frame || event.button !== 0) return;
    imagePanStartRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: frame.scrollLeft,
      scrollTop: frame.scrollTop,
      hasMoved: false,
    };
    frame.setPointerCapture(event.pointerId);
  };

  const onImagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const frame = imageFrameRef.current;
    const start = imagePanStartRef.current;
    if (!frame || !start) return;

    const deltaX = event.clientX - start.clientX;
    const deltaY = event.clientY - start.clientY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) start.hasMoved = true;
    if (!start.hasMoved) return;

    frame.scrollLeft = start.scrollLeft - deltaX;
    frame.scrollTop = start.scrollTop - deltaY;
  };

  const onImagePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const frame = imageFrameRef.current;
    const start = imagePanStartRef.current;
    imagePanStartRef.current = undefined;
    if (frame?.hasPointerCapture(event.pointerId)) frame.releasePointerCapture(event.pointerId);

    if (!start?.hasMoved && imageUrl) recordImagePoint(event);
  };

  const setImageZoomWithCenter = (nextZoom: number) => {
    const frame = imageFrameRef.current;
    if (!frame) {
      setImageZoom(nextZoom);
      return;
    }

    const centerXRatio = frame.scrollWidth > 0 ? (frame.scrollLeft + frame.clientWidth / 2) / frame.scrollWidth : 0.5;
    const centerYRatio = frame.scrollHeight > 0 ? (frame.scrollTop + frame.clientHeight / 2) / frame.scrollHeight : 0.5;
    setImageZoom(nextZoom);

    window.requestAnimationFrame(() => {
      frame.scrollLeft = Math.max(0, centerXRatio * frame.scrollWidth - frame.clientWidth / 2);
      frame.scrollTop = Math.max(0, centerYRatio * frame.scrollHeight - frame.clientHeight / 2);
    });
  };

  const updatePoint = (id: string, patch: Partial<Pick<ControlPoint, "description" | "confidence">>) => {
    setPoints((current) => current.map((point) => (point.id === id ? { ...point, ...patch } : point)));
  };

  const deletePoint = (id: string) => {
    setPoints((current) => current.filter((point) => point.id !== id));
  };

  const zoomImageIn = () => {
    setImageZoomWithCenter(Math.min(maxImageZoom, imageZoom + imageZoomStep));
  };

  const zoomImageOut = () => {
    setImageZoomWithCenter(Math.max(minImageZoom, imageZoom - imageZoomStep));
  };

  const resetImageZoom = () => {
    setImageZoomWithCenter(1);
  };

  const zoomMapIn = () => {
    mapRef.current?.zoomIn({ duration: 220 });
  };

  const zoomMapOut = () => {
    mapRef.current?.zoomOut({ duration: 220 });
  };

  const fitMap = () => {
    const map = mapRef.current;
    if (map) fitMapToData(map, data);
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
            <span>Display image</span>
            <input type="file" accept="image/*,.tif,.tiff" onChange={(event) => onImageFileChange(event.target.files?.[0])} />
          </label>
          <label className="control-point-field">
            <span>Georeferencing file</span>
            <select value={sourceImageName} onChange={(event) => setSourceImageName(event.target.value as (typeof sourceFileOptions)[number])}>
              {sourceFileOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {sourceImageName === "Other source" ? (
            <label className="control-point-field">
              <span>Other source filename</span>
              <input value={customSourceImageName} onChange={(event) => setCustomSourceImageName(event.target.value)} placeholder="Historic lot map filename" />
            </label>
          ) : null}
          <div className="control-point-toolbar" aria-label="Source image zoom controls">
            <button type="button" onClick={zoomImageOut} aria-label="Zoom source image out" title="Zoom source image out">
              <ZoomOut size={16} aria-hidden="true" />
            </button>
            <span>{Math.round(imageZoom * 100)}%</span>
            <button type="button" onClick={zoomImageIn} aria-label="Zoom source image in" title="Zoom source image in">
              <ZoomIn size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={resetImageZoom} aria-label="Reset source image zoom" title="Reset source image zoom">
              <Maximize2 size={16} aria-hidden="true" />
            </button>
          </div>
          {displayImageName && exportSourceName && displayImageName !== exportSourceName ? (
            <p className="control-point-source-note">
              Displaying {displayImageName}; exporting points for {exportSourceName}.
            </p>
          ) : null}
          <div
            ref={imageFrameRef}
            className="control-point-image-frame"
            onPointerDown={onImagePointerDown}
            onPointerMove={onImagePointerMove}
            onPointerUp={onImagePointerUp}
            onPointerCancel={() => {
              imagePanStartRef.current = undefined;
            }}
          >
            {imageUrl ? (
              <div className="control-point-image-layer" style={{ width: `${Math.round(imageZoom * 100)}%` }}>
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Source scan for control point collection"
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
                  .filter((point) => point.sourceImageName === exportSourceName)
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
              </div>
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
          <div className="control-point-toolbar" aria-label="Map zoom controls">
            <button type="button" onClick={zoomMapOut} aria-label="Zoom map out" title="Zoom map out">
              <ZoomOut size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={zoomMapIn} aria-label="Zoom map in" title="Zoom map in">
              <ZoomIn size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={fitMap} aria-label="Fit map to cemetery data" title="Fit map to cemetery data">
              <Maximize2 size={16} aria-hidden="true" />
            </button>
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
