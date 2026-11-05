import type { CSSProperties } from "react";
import type { GraveSpaceSummary } from "../../types";
import { formatGraveLabel, statusColors, statusLabels } from "../../lib/format";

export function AssociatedGravesiteList({ graves, emptyMessage, onSelectGrave }: { graves: GraveSpaceSummary[]; emptyMessage: string; onSelectGrave: (grave: GraveSpaceSummary) => void }) {
  if (!graves.length) return <p className="muted">{emptyMessage}</p>;
  return <div className="associated-gravesite-list">{graves.map((grave) => <button key={`${grave.cemeteryId}:${grave.id}`} type="button" className="associated-gravesite-row" onClick={() => onSelectGrave(grave)}><strong>{formatGraveLabel(grave)}</strong><span className="associated-gravesite-status" style={{ "--status-color": statusColors[grave.status] } as CSSProperties}>{statusLabels[grave.status]}</span></button>)}</div>;
}
