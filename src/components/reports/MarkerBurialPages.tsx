import { formatReportValue } from "./reportFormatting";
import { useMediaUrl } from "../../hooks/useMediaUrl";

function reportText(row: Record<string, unknown>, key: string) {
  return formatReportValue(row[key]);
}

function isVeteranReportValue(value: unknown) {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  return ["yes", "y", "true", "1", "veteran"].includes(value.trim().toLowerCase());
}

function reportDecorations(value: unknown): Array<{ code: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { code: string; label: string } => (
    typeof item === "object" && item !== null && typeof (item as { code?: unknown }).code === "string" && typeof (item as { label?: unknown }).label === "string"
  ));
}

function DetailItem({
  label,
  value,
  className = "",
  showEmpty = false,
  emptyValue = "—",
}: {
  label: string;
  value: unknown;
  className?: string;
  showEmpty?: boolean;
  emptyValue?: string;
}) {
  const isEmpty = value === null || value === undefined || value === "";
  if (isEmpty && !showEmpty) return null;
  return (
    <div className={`marker-burial-detail ${className}`.trim()}>
      <dt>{label}</dt>
      <dd>{isEmpty ? emptyValue : formatReportValue(value)}</dd>
    </div>
  );
}

function groupMarkerBurials(rows: Record<string, unknown>[]) {
  const groups = new Map<string, Record<string, unknown>[]>();
  rows.forEach((row) => {
    const markerKey = String(row.marker_uuid ?? row.marker_id);
    groups.set(markerKey, [...(groups.get(markerKey) ?? []), row]);
  });
  return [...groups.values()];
}

type ReportMarkerFeature = {
  id?: string;
  type?: string;
  subtype?: string;
  placement?: string;
  material?: string;
  symbolText?: string;
  notes?: string;
  status?: string;
};

function reportMarkerFeatures(value: unknown): ReportMarkerFeature[] {
  return Array.isArray(value) ? value.filter((feature): feature is ReportMarkerFeature => typeof feature === "object" && feature !== null) : [];
}

function ReportPhoto({ fileUrl, markerId }: { fileUrl: string; markerId: string }) {
  const { url, failed, error, retry, reportImageFailure, attempt } = useMediaUrl(fileUrl);
  return failed ? <div className="marker-burial-photo-placeholder" role="alert"><p>Photo couldn't be loaded. {error}</p><button type="button" onClick={retry}>Retry photo</button></div>
    : url ? <img key={`${fileUrl}-${attempt}`} className="marker-burial-photo" src={url} onError={reportImageFailure} alt={`Marker ${markerId}`} />
    : <div className="marker-burial-photo-placeholder" role="status">Loading photo…</div>;
}

export function MarkerBurialPages({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <div className="report-empty">No linked marker burials matched these filters.</div>;
  const markerGroups = groupMarkerBurials(rows);

  return (
    <div className="marker-burial-pages">
      {markerGroups.map((burials, markerIndex) => {
        const marker = burials[0];
        const locations = [...new Set(burials.map((burial) =>
          [burial.section ? `Section ${String(burial.section)}` : "", burial.grave].filter(Boolean).join(" · "),
        ).filter(Boolean))];
        const markerFeatures = reportMarkerFeatures(marker.marker_features);

        return (
        <article className="marker-burial-page" key={String(marker.marker_uuid ?? marker.marker_id)}>
          <header className="marker-burial-marker-header">
            <div>
              <p className="marker-burial-kicker">Marker burial records</p>
              <h1>{reportText(marker, "marker_id")}</h1>
              <p>{[marker.cemetery, ...locations].filter(Boolean).join(" · ")}</p>
            </div>
            <span>Marker {markerIndex + 1} of {markerGroups.length}</span>
          </header>
          {marker.photo_url ? <ReportPhoto fileUrl={String(marker.photo_url)} markerId={String(marker.marker_id)} /> : <div className="marker-burial-photo-placeholder">No marker photo available</div>}
          <section>
            <h2>Marker information</h2>
            <dl className="marker-burial-details">
              <DetailItem label="Marker ID" value={marker.marker_id} />
              <DetailItem label="Type" value={marker.marker_type} />
              <DetailItem label="Scope" value={marker.marker_scope} />
              <DetailItem label="Material" value={marker.marker_material} />
              <DetailItem label="Condition" value={marker.marker_condition} />
              <DetailItem label="Inscription" value={marker.inscription} className="marker-burial-detail--inscription" />
              <DetailItem label="Design" value={marker.design_notes} />
              <DetailItem label="Back" value={marker.back_description} />
              <DetailItem label="Condition notes" value={marker.condition_notes} />
            </dl>
            {markerFeatures.length ? (
              <div className="marker-burial-features">
                <h3>Associated features</h3>
                <ul>
                  {markerFeatures.map((feature) => {
                    const attributes = [feature.subtype, feature.placement, feature.material, feature.symbolText].filter(Boolean);
                    return (
                      <li key={feature.id ?? `${feature.type}:${attributes.join(":")}`}>
                        <strong>{feature.type ?? "Feature"}</strong>
                        {attributes.length ? <span>{attributes.join(" · ")}</span> : null}
                        {feature.notes ? <span>{feature.notes}</span> : null}
                        {feature.status && feature.status !== "active" ? <span>Status: {feature.status.replaceAll("_", " ")}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
          {burials.map((burial, burialIndex) => (
            <section className="marker-burial-person" key={String(burial.burial_uuid)}>
              <h2>Burial {burialIndex + 1} of {burials.length}</h2>
              <h3 className="marker-burial-person-name">
                <span>{reportText(burial, "person")}</span>
                {isVeteranReportValue(burial.veteran) ? <span className="burial-veteran-badge">Veteran</span> : null}
                {reportDecorations(burial.military_decorations).map((decoration) => (
                  <span key={decoration.code} className={decoration.code === "purple_heart" ? "burial-decoration-badge is-purple-heart" : "burial-decoration-badge"}>
                    {decoration.label}
                  </span>
                ))}
              </h3>
              <dl className="marker-burial-details">
                <DetailItem label="Gravesite" value={burial.grave} showEmpty />
                <DetailItem label="Record ID" value={burial.gravesite_id} showEmpty />
                <DetailItem label="Birth" value={burial.birth_date} showEmpty />
                <DetailItem label="Death" value={burial.death_date} showEmpty emptyValue="Still living" />
                <DetailItem label="Burial" value={burial.burial_date} showEmpty />
                <DetailItem label="Interment" value={burial.interment_type} showEmpty />
                <DetailItem label="Record status" value={burial.record_status} showEmpty />
                <DetailItem label="Funeral home" value={burial.funeral_home} showEmpty />
                <DetailItem label="Branch" value={burial.military_branch} showEmpty />
                <DetailItem label="Rank" value={burial.military_rank} showEmpty />
                <DetailItem label="War/service" value={burial.military_war_service} showEmpty />
                <DetailItem label="Notes" value={burial.burial_notes} className="marker-burial-detail--notes" showEmpty />
              </dl>
              <div className="marker-burial-nhg">
                <h3>North Hills Genealogists text</h3>
                <p>{burial.nhg_text ? String(burial.nhg_text) : "No linked NHG text."}</p>
              </div>
            </section>
          ))}
        </article>
        );
      })}
    </div>
  );
}

