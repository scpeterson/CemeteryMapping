import { formatGraveLabel, statusColors, statusLabels } from "../../lib/format";
import type { GraveSpaceSummary, Headstone } from "../../types";
import { StatusBadge } from "../ui/Feedback";
import { OverviewPeople, OverviewOwners } from "./FeatureOverview";
import { OverviewPhoto } from "./OverviewPhoto";
import { overviewImages } from "./overviewImages";
import { useMarkerOverview } from "./useMarkerOverview";

export function MarkerOverview({ marker, graves, canViewOwnership, onSelectGrave, onShowDetails }: {
  marker: Headstone;
  graves: GraveSpaceSummary[];
  canViewOwnership: boolean;
  onSelectGrave: (grave: GraveSpaceSummary) => void;
  onShowDetails: () => void;
}) {
  const { records, loading, retry } = useMarkerOverview(graves);
  const images = overviewImages(marker.mediaAssets ?? [], [marker]).map((image) => ({ ...image, linkedMarker: undefined }));
  const burialIds = new Set(marker.burialIds ?? []);
  const associated = records.flatMap(({ detail }) => detail?.burials.filter((burial) => !burialIds.size || burialIds.has(burial.id)) ?? []);
  const burials = [...new Map(associated.map((burial) => [burial.id, burial])).values()];
  const failed = records.some((record) => record.failed);
  return <div className="feature-overview">
    <p>{marker.markerType?.label || "Marker"}{marker.markerScope?.label ? ` · ${marker.markerScope.label}` : ""}</p>
    <OverviewPhoto images={images} />
    <section aria-label="Associated people">
      <h3>{burialIds.size ? "Associated people" : "People in linked gravesites"}</h3>
      {loading ? <p role="status">Loading associated people…</p> : burials.length ? records.map(({ summary, detail }) => {
        const people = detail?.burials.filter((burial) => !burialIds.size || burialIds.has(burial.id)) ?? [];
        return people.length ? <div key={`${summary.cemeteryId}:${summary.id}`} className="overview-related-grave">
          {graves.length > 1 ? <button type="button" className="overview-link" onClick={() => onSelectGrave(summary)}>{formatGraveLabel(summary)}</button> : null}
          <OverviewPeople burials={people} emptyMessage="No associated person recorded." />
        </div> : null;
      }) : <p className="muted">{failed || burialIds.size ? "Associated names are unavailable in the loaded records." : "No associated person recorded."}</p>}
    </section>
    {failed ? <p role="alert">Some linked gravesite details could not be loaded. <button type="button" className="overview-link" onClick={retry}>Retry linked records</button></p> : null}
    {canViewOwnership ? <section aria-label="Owners of linked gravesites">
      <h3>Owners of linked gravesites</h3>
      {loading ? <p role="status">Loading ownership records…</p> : records.length ? records.map(({ summary, detail, failed }) => <div key={`${summary.cemeteryId}:${summary.id}`} className="overview-related-grave">
        <button type="button" className="overview-link" onClick={() => onSelectGrave(summary)}>{formatGraveLabel(summary)}</button>
        {failed ? <p>Ownership information unavailable.</p> : <OverviewOwners owners={(detail?.owners ?? []).filter((owner) => detail?.currentOwnerIds.includes(owner.id))} />}
      </div>) : <p className="muted">No linked gravesite ownership is recorded.</p>}
    </section> : null}
    <section aria-label="Linked gravesites">
      <h3>Linked gravesites</h3>
      {graves.length ? <ul className="overview-list">{graves.map((grave) => <li key={`${grave.cemeteryId}:${grave.id}`}>
        <button type="button" className="overview-link" onClick={() => onSelectGrave(grave)}>{formatGraveLabel(grave)}</button>
        <StatusBadge color={statusColors[grave.status]}>{statusLabels[grave.status]}</StatusBadge>
      </li>)}</ul> : <p className="muted">No linked gravesite recorded.</p>}
    </section>
    <button type="button" className="overview-link" onClick={onShowDetails}>View marker details and related records</button>
  </div>;
}
