import { Info, MapPinned } from "lucide-react";
import type {
  CemeteryLot,
  GraveSpaceSummary,
  LotRestrictedArea
} from "../../types";
import { GeometryMetadataList } from "./DetailGeometry";
import { AssociatedGravesiteList } from "./MarkerGravesiteRecords";

const lotBurialUseLabels = {
  standard: "Standard lot",
  non_burial: "Gravesites and markers prohibited",
  partially_restricted: "Partially restricted",
} satisfies Record<NonNullable<CemeteryLot["burialUseStatus"]>, string>;

export function LotDetailPanel({
  lot,
  graves,
  restrictedAreas,
  onSelectGrave,
}: {
  lot: CemeteryLot;
  graves: GraveSpaceSummary[];
  restrictedAreas: LotRestrictedArea[];
  onSelectGrave: (grave: GraveSpaceSummary) => void;
}) {
  const burialUseStatus = lot.burialUseStatus ?? "standard";
  return (
    <aside className="detail-panel">
      <div className="grave-title-row">
        <div>
          <p className="eyebrow">Lot</p>
          <h2>
            {lot.section ? `${lot.section}-` : ""}
            {lot.id}
          </h2>
          <p className="grave-cemetery">{lot.name}</p>
        </div>
      </div>

      <section className="detail-section">
        <div className="section-title">
          <MapPinned size={17} aria-hidden="true" />
          <h3>Lot</h3>
        </div>
        <article className="grave-record">
          <dl>
            <div>
              <dt>Section</dt>
              <dd>{lot.section || "Unknown"}</dd>
            </div>
            <div>
              <dt>Lot</dt>
              <dd>{lot.id || "Unknown"}</dd>
            </div>
            {lot.block ? (
              <div>
                <dt>Block</dt>
                <dd>{lot.block}</dd>
              </div>
            ) : null}
            <div>
              <dt>Name</dt>
              <dd>{lot.name || "Unknown"}</dd>
            </div>
            <div>
              <dt>Burial use</dt>
              <dd>{lotBurialUseLabels[burialUseStatus]}</dd>
            </div>
          </dl>
          {lot.burialUseNotes ? <p className="lot-use-note">{lot.burialUseNotes}</p> : null}
        </article>
      </section>

      {burialUseStatus !== "standard" || restrictedAreas.length ? (
        <section className="detail-section">
          <div className="section-title">
            <Info size={17} aria-hidden="true" />
            <h3>Lot Restrictions</h3>
          </div>
          <article className="grave-record">
            {restrictedAreas.length ? (
              <div className="lot-restriction-list">
                {restrictedAreas.map((area) => (
                  <div key={area.id} className="lot-restriction-row">
                    <strong>{area.name}</strong>
                    <span>{area.notes || "This area cannot contain gravesites or markers."}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="lot-use-note">This lot cannot contain gravesites or markers.</p>
            )}
          </article>
        </section>
      ) : null}

      <section className="detail-section">
        <div className="section-title">
          <MapPinned size={17} aria-hidden="true" />
          <h3>Gravesites</h3>
        </div>
        <AssociatedGravesiteList graves={graves} emptyMessage="No gravesites are associated with this lot." onSelectGrave={onSelectGrave} />
      </section>

      <section className="detail-section">
        <div className="section-title">
          <MapPinned size={17} aria-hidden="true" />
          <h3>Lot Geometry</h3>
        </div>
        <article className="grave-record">
          <section className="geometry-metadata-group" aria-label="Lot geometry metadata">
            <GeometryMetadataList type={lot.geometryType} source={lot.geometrySource} confidence={lot.geometryConfidence} notes={lot.geometryNotes} />
          </section>
        </article>
      </section>
    </aside>
  );
}
