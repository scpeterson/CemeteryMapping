import { geometryConfidenceLabels, geometryTypeLabels } from "../../lib/format";
import type {
  GeometryConfidence,
  GeometryType,
  GraveSpace
} from "../../types";

export function GeometryMetadataList({
  type,
  source,
  confidence,
  notes,
}: {
  type?: GeometryType;
  source?: string;
  confidence?: GeometryConfidence;
  notes?: string;
}) {
  const geometryType = type ?? "operational";
  const geometryConfidence = confidence ?? "estimated";

  return (
    <dl className="geometry-metadata">
      <div>
        <dt>Geometry type</dt>
        <dd>{geometryTypeLabels[geometryType]}</dd>
      </div>
      <div>
        <dt>Confidence</dt>
        <dd>{geometryConfidenceLabels[geometryConfidence]}</dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd>{source || "Not recorded"}</dd>
      </div>
      <div>
        <dt>Review notes</dt>
        <dd>{notes || "None"}</dd>
      </div>
    </dl>
  );
}

export function GraveGeometryMetadata({ grave }: { grave: GraveSpace }) {
  return (
    <div className="grave-record">
      <section className="geometry-metadata-group" aria-label="Gravesite geometry metadata">
        <h4>Gravesite geometry</h4>
        <GeometryMetadataList type={grave.geometryType} source={grave.geometrySource} confidence={grave.geometryConfidence} notes={grave.geometryNotes} />
      </section>
      {grave.lot ? (
        <section className="geometry-metadata-group" aria-label="Lot geometry metadata">
          <h4>Lot geometry</h4>
          <GeometryMetadataList type={grave.lotGeometryType} source={grave.lotGeometrySource} confidence={grave.lotGeometryConfidence} notes={grave.lotGeometryNotes} />
        </section>
      ) : null}
    </div>
  );
}
