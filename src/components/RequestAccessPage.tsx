import { useState, type FormEvent } from "react";
import { apiBaseUrl } from "../config/environment";
import { jsonRequest, jsonResponse, normalizeBaseUrl } from "../api/apiClient";

export function RequestAccessPage() {
  const [form, setForm] = useState({ displayName: "", email: "", cemeteryInterest: "", reason: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch(`${normalizeBaseUrl(apiBaseUrl)}/access-requests`, jsonRequest("POST", form));
      const result = await jsonResponse<{ message: string }>(response, "Request access");
      setMessage(result.message);
    } catch (failure) {
      setError(failure instanceof TypeError ? "Couldn't reach the server. Please try again." : failure instanceof Error ? failure.message : "Unable to submit your request.");
    } finally { setBusy(false); }
  }
  return <main className="access-request-page">
    <h1>Request access</h1>
    <p>Cemetery records are private. An administrator must approve your account before you can view them.</p>
    {message ? <p role="status">{message}</p> : <form onSubmit={(event) => void submit(event)}>
      <label>Your name<input autoComplete="name" required maxLength={250} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
      <label>Email<input type="email" autoComplete="email" required maxLength={320} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>Cemetery of interest<input required maxLength={250} value={form.cemeteryInterest} onChange={(event) => setForm({ ...form, cemeteryInterest: event.target.value })} /></label>
      <label>Why would you like access?<textarea required maxLength={2000} rows={4} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
      <div className="access-request-honeypot" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label></div>
      <p>Your details will be shared with the system administrator to review your request. Please do not include passwords or sensitive personal records.</p>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} type="submit">{busy ? "Submitting…" : "Submit request"}</button>
    </form>}
    <p><a href="/">Return to sign in</a></p>
  </main>;
}
