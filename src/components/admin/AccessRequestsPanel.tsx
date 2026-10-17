import { useCallback, useEffect, useState } from "react";
import { fetchAccessRequestStats, type AccessRequestStats, fetchAccessRequests, rejectAccessRequest, type AccessRequest } from "../../api/accessRequestsApi";

export function AccessRequestsPanel({ onReview, refreshKey }: { onReview: (request: AccessRequest) => void; refreshKey: number }) {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [stats, setStats] = useState<AccessRequestStats>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const [requests, capacity] = await Promise.all([fetchAccessRequests(), fetchAccessRequestStats()]);
      setRequests(requests); setStats(capacity);
    }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to load requests."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload, refreshKey]);
  async function reject(id: string) {
    setBusy(true); setError("");
    try { await rejectAccessRequest(id); await reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to reject request."); }
    finally { setBusy(false); }
  }
  return <section className="admin-section">
    <h3>Access requests</h3>
    <p>Review requests before creating accounts. New accounts default to Read-only. Saving an active user approves the selected request.</p>
    {stats && <p>{stats.pending} of {stats.limits.pending} pending requests; {stats.lastHour} of {stats.limits.hourly} new requests in the last hour.</p>}
    {stats && (stats.pending >= stats.limits.pending * 0.8 || stats.lastHour >= stats.limits.hourly * 0.8) && <p role="alert">Access requests are nearing capacity. Review the queue and check for unusual submissions.</p>}
    <button type="button" disabled={busy} onClick={() => void reload()}>Refresh requests</button>
    {busy && <p role="status">Loading…</p>}
    {error && <p role="alert">{error}</p>}
    {!busy && !error && requests.length === 0 && <p>No pending requests.</p>}
    {requests.map((request) => <article key={request.id} className="access-request-card">
      <h4>{request.displayName}</h4><p>{request.email} · {new Date(request.createdAt).toLocaleDateString()}</p>
      <p><strong>Cemetery:</strong> {request.cemeteryInterest}</p>
      <p className="access-request-reason">{request.reason}</p>
      <button type="button" disabled={busy} onClick={() => onReview(request)}>Set up user</button>{" "}
      <button type="button" disabled={busy} onClick={() => void reject(request.id)}>Reject request</button>
    </article>)}
    {requests.length === 200 && <p>Showing the oldest 200 requests. Review these and refresh for more.</p>}
  </section>;
}
