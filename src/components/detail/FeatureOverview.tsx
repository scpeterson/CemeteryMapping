import { formatDate, fullName, statusColors, statusLabels } from "../../lib/format";
import type { Burial, GraveSpace, Headstone, HeadstoneSummary, Owner } from "../../types";
import { StatusBadge } from "../ui/Feedback";
import { OverviewPhoto } from "./OverviewPhoto";
import { overviewImages } from "./overviewImages";

export function OverviewPeople({ burials, emptyMessage }: { burials: Burial[]; emptyMessage: string }) {
  return burials.length ? <ul className="overview-list">
    {burials.map((burial) => <li key={burial.id}>
      <strong>{fullName(burial.person) || "Name not recorded"}</strong>
      {burial.person.birthDate || burial.person.deathDate ? <span>
        {burial.person.birthDate ? `Born ${formatDate(burial.person.birthDate)}` : "Birth date not recorded"}
        {burial.person.deathDate ? ` · Died ${formatDate(burial.person.deathDate)}` : ""}
      </span> : null}
    </li>)}
  </ul> : <p className="muted">{emptyMessage}</p>;
}

export function OverviewOwners({ owners }: { owners: Owner[] }) {
  return owners.length ? <ul className="overview-list">
    {owners.map((owner) => <li key={owner.id}>{owner.displayName || [owner.firstName, owner.lastName].filter(Boolean).join(" ") || "Name not recorded"}</li>)}
  </ul> : <p className="muted">No current ownership is recorded.</p>;
}

export function GraveOverview({ grave, headstones, owners, canViewOwnership, markerSummaries, onSelectMarker, onShowPeople, onShowMonuments }: {
  grave: GraveSpace;
  headstones: Headstone[];
  owners: Owner[];
  canViewOwnership: boolean;
  markerSummaries: HeadstoneSummary[];
  onSelectMarker: (marker: HeadstoneSummary) => void;
  onShowPeople: () => void;
  onShowMonuments: () => void;
}) {
  return <div className="feature-overview">
    <div className="overview-identity">
      <StatusBadge color={statusColors[grave.status]}>{statusLabels[grave.status]}</StatusBadge>
      <p>Section {grave.section || "not recorded"}{grave.lot ? ` · Lot ${grave.lot}` : ""}</p>
    </div>
    <OverviewPhoto images={overviewImages(grave.mediaAssets ?? [], headstones)} />
    <section aria-label="People buried here">
      <h3>People buried here</h3>
      <OverviewPeople burials={grave.burials} emptyMessage="No burial recorded." />
      {grave.burials.length ? <button type="button" className="overview-link" onClick={onShowPeople}>View burial records</button> : null}
    </section>
    {canViewOwnership ? <section aria-label="Current owners">
      <h3>Current owners</h3>
      <OverviewOwners owners={owners} />
      {owners.length ? <button type="button" className="overview-link" onClick={onShowPeople}>View ownership records</button> : null}
    </section> : null}
    <section aria-label="Associated markers">
      <h3>Associated markers</h3>
      {headstones.length ? <ul className="overview-list">{headstones.map((marker) => {
        const summary = markerSummaries.find((candidate) => candidate.id === marker.id);
        return <li key={marker.id}><button type="button" className="overview-link" onClick={() => summary ? onSelectMarker(summary) : onShowMonuments()}>
          {marker.headstoneId} — {marker.markerType?.label || "Marker"}
        </button></li>;
      })}</ul> : <p className="muted">No marker recorded.</p>}
    </section>
    {grave.notes ? <section><h3>Notes</h3><p className="note-box">{grave.notes}</p></section> : null}
  </div>;
}
