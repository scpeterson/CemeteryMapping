import { FileText, History, Landmark, MapPinned, UserRound } from "lucide-react";
import type { GraveSpace, GraveSpaceSummary, Owner } from "../types";
import { formatDate, fullName, statusColors, statusLabels } from "../lib/format";

type DetailPanelProps = {
  owners: Owner[];
  summary?: GraveSpaceSummary;
  grave?: GraveSpace;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
};

const ownerName = (owners: Owner[], ownerId: string) => owners.find((owner) => owner.id === ownerId)?.displayName ?? "Unknown owner";

export function DetailPanel({ owners, summary, grave, isLoading = false, error, onRetry }: DetailPanelProps) {
  if (!summary) {
    return (
      <aside className="detail-panel empty-state">
        <MapPinned size={28} aria-hidden="true" />
        <h2>Select a grave site</h2>
        <p>Click a mapped grave space or choose a search result to view ownership, burial status, and record history.</p>
      </aside>
    );
  }

  const title = `${summary.section}-${summary.lot}-${summary.space}`;
  const status = grave?.status ?? summary.status;

  return (
    <aside className="detail-panel">
      <div className="grave-title-row">
        <div>
          <p className="eyebrow">Grave site</p>
          <h2>{title}</h2>
        </div>
        <span className="status-badge" style={{ borderColor: statusColors[status], color: statusColors[status] }}>
          {statusLabels[status]}
        </span>
      </div>

      {isLoading ? (
        <div className="detail-message" role="status">
          Loading grave details...
        </div>
      ) : null}

      {error ? (
        <div className="detail-message is-error" role="alert">
          <p>Unable to load grave details: {error}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {!grave || isLoading || error ? null : (
        <>

      <section className="detail-section">
        <div className="section-title">
          <Landmark size={17} aria-hidden="true" />
          <h3>Current Owner</h3>
        </div>
        <div className="owner-list">
          {grave.currentOwnerIds.map((id) => {
            const owner = owners.find((item) => item.id === id);
            return (
              <div key={id} className="owner-row">
                <strong>{owner?.displayName ?? "Unknown owner"}</strong>
                {owner?.contactNote ? <span>{owner.contactNote}</span> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="detail-section">
        <div className="section-title">
          <UserRound size={17} aria-hidden="true" />
          <h3>Burials</h3>
        </div>
        {grave.burials.length ? (
          <div className="burial-list">
            {grave.burials.map((burial) => (
              <article key={burial.id} className="burial-record">
                <strong>{fullName(burial.person)}</strong>
                <dl>
                  <div>
                    <dt>Born</dt>
                    <dd>{formatDate(burial.person.birthDate)}</dd>
                  </div>
                  <div>
                    <dt>Died</dt>
                    <dd>{formatDate(burial.person.deathDate)}</dd>
                  </div>
                  <div>
                    <dt>Buried</dt>
                    <dd>{formatDate(burial.burialDate)}</dd>
                  </div>
                </dl>
                {burial.notes ? <p>{burial.notes}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No burials are recorded for this grave site.</p>
        )}
      </section>

      <section className="detail-section">
        <div className="section-title">
          <History size={17} aria-hidden="true" />
          <h3>Ownership Timeline</h3>
        </div>
        <ol className="timeline">
          {[...grave.ownershipHistory]
            .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
            .map((event) => (
              <li key={event.id}>
                <time>{formatDate(event.effectiveDate)}</time>
                <strong>{event.eventType}</strong>
                <span>{event.ownerIds.map((id) => ownerName(owners, id)).join(", ")}</span>
                <small>{event.recordedBy}</small>
                {event.documentReference ? (
                  <span className="document-ref">
                    <FileText size={13} aria-hidden="true" />
                    {event.documentReference}
                  </span>
                ) : null}
                {event.notes ? <p>{event.notes}</p> : null}
              </li>
            ))}
        </ol>
      </section>

      {grave.notes ? (
        <section className="detail-section">
          <div className="section-title">
            <FileText size={17} aria-hidden="true" />
            <h3>Notes</h3>
          </div>
          <p className="note-box">{grave.notes}</p>
        </section>
      ) : null}
        </>
      )}
    </aside>
  );
}
