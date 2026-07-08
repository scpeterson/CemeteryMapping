import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw, ShieldAlert } from "lucide-react";
import { fetchDataQualityDashboard } from "../api/cemeteryApi";
import type { DataQualityDashboard, DataQualityMetric, DataQualitySeverity } from "../types";

export type DataQualityReviewTarget = "northHills" | "sourcePeople" | "bulkMarkers" | "bulkMapLinks";

type DataQualityAdminTabProps = {
  onError: (message: string | undefined) => void;
  onOpenReviewTarget?: (target: DataQualityReviewTarget) => void;
};

const severityLabels: Record<DataQualitySeverity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

function formatTimestamp(value: string) {
  if (!value) return "Not loaded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function groupMetrics(metrics: DataQualityMetric[]) {
  return metrics.reduce<Record<string, DataQualityMetric[]>>((groups, metric) => {
    const category = metric.category || "Other";
    return {
      ...groups,
      [category]: [...(groups[category] ?? []), metric],
    };
  }, {});
}

function reviewTargetForMetric(metric: DataQualityMetric): DataQualityReviewTarget | undefined {
  switch (metric.id) {
    case "nhg_review_needed":
    case "nhg_unlinked":
      return "northHills";
    case "source_person_records_unmatched":
      return "sourcePeople";
    case "markers_review_needed":
      return "bulkMarkers";
    case "gravesites_without_markers":
    case "markers_without_gravesites":
      return "bulkMapLinks";
    default:
      return undefined;
  }
}

const reviewTargetLabels: Record<DataQualityReviewTarget, string> = {
  northHills: "Review readings",
  sourcePeople: "Review people",
  bulkMarkers: "Open marker tools",
  bulkMapLinks: "Open bulk tools",
};

export function DataQualityAdminTab({ onError, onOpenReviewTarget }: DataQualityAdminTabProps) {
  const [dashboard, setDashboard] = useState<DataQualityDashboard>();
  const [isLoading, setIsLoading] = useState(false);
  const groupedMetrics = useMemo(() => groupMetrics(dashboard?.metrics ?? []), [dashboard?.metrics]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    onError(undefined);

    try {
      setDashboard(await fetchDataQualityDashboard());
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to load data quality dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <section className="admin-section">
      <div className="section-title">
        <ShieldAlert size={17} aria-hidden="true" />
        <h3>Data Quality</h3>
      </div>

      <article className="data-quality-overview" title="Current data quality summary for the cemeteries available to this user.">
        <div>
          <strong>{dashboard?.totalOpenItems ?? 0}</strong>
          <span>Open cleanup signals</span>
          <small>{dashboard?.scope === "all" ? "All cemeteries" : "Assigned cemetery scope"}</small>
        </div>
        <div>
          <strong>{dashboard?.metrics.filter((metric) => metric.count > 0).length ?? 0}</strong>
          <span>Active categories</span>
          <small>{dashboard ? `Updated ${formatTimestamp(dashboard.generatedAt)}` : "Not loaded"}</small>
        </div>
        <button type="button" className="secondary-button" onClick={() => void loadDashboard()} disabled={isLoading} title="Refresh data quality counts.">
          <RefreshCw size={16} aria-hidden="true" />
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </article>

      {isLoading && !dashboard ? <div className="admin-message" role="status">Loading data quality dashboard...</div> : null}

      <div className="data-quality-group-list">
        {Object.entries(groupedMetrics).map(([category, metrics]) => (
          <section key={category} className="data-quality-group" aria-label={`${category} data quality metrics`}>
            <h4>{category}</h4>
            <div className="data-quality-grid">
              {metrics.map((metric) => {
                const reviewTarget = metric.count > 0 ? reviewTargetForMetric(metric) : undefined;
                return (
                  <article key={metric.id} className={`data-quality-card severity-${metric.severity}`} title={metric.description}>
                    <div>
                      <strong>{metric.count}</strong>
                      <span>{metric.label}</span>
                    </div>
                    <div className="data-quality-card-meta">
                      <small>{severityLabels[metric.severity]}</small>
                      {reviewTarget && onOpenReviewTarget ? (
                        <button
                          type="button"
                          className="secondary-button data-quality-review-button"
                          onClick={() => onOpenReviewTarget(reviewTarget)}
                          title={metric.description}
                        >
                          {reviewTargetLabels[reviewTarget]}
                          <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
