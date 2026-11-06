import { isRecordConflict } from "../api/apiClient";
import { ConflictRecovery } from "./ui/ConflictRecovery";
import { ShieldCheck, UserRound, X } from "lucide-react";
import { EmptyState, Notice } from "./ui/Feedback";
import { Modal } from "./ui/Modal";
import { useEffect, useState } from "react";
import { fetchProfile, saveProfile } from "../api/profileApi";
import type { CurrentUser } from "../types";
import type { UserProfile } from "../types/administration";
import { useDraftState } from "../hooks/useDraftState";

export function UserProfilePanel({ user, cemeteries, onClose, onSaved }: {
  user: CurrentUser; cemeteries: { id: string; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const [profile, setProfile] = useDraftState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [conflict,setConflict]=useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    fetchProfile().then(value => { if (active) setProfile(value); })
      .catch((error: unknown) => { if (active) setError(error instanceof Error ? error.message : "Unable to load profile."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setProfile]);
  return <Modal protectDrafts className="admin-panel profile-panel" label="My profile" onClose={onClose}>
    <div className="admin-panel-header">
      <div><p className="eyebrow">Account</p><h2>My profile</h2></div>
      <button type="button" className="icon-button" data-discard-draft onClick={onClose} aria-label="Close profile" title="Close your profile."><X size={18} aria-hidden="true" /></button>
    </div>
    {loading ? <Notice>Loading profile…</Notice> : null}
    {error ? <Notice tone="error">{error}</Notice> : null}
    {message ? <Notice tone="success">{message}</Notice> : null}
    {!loading && !profile && !error ? <EmptyState title="Profile unavailable">A registered account is required to save a profile.</EmptyState> : null}
    <section className="admin-section">
    <div className="section-title"><UserRound size={17} aria-hidden="true" /><h3>Contact details</h3></div>
    {profile ? <form className="admin-form" onSubmit={async event => {
      event.preventDefault(); setConflict(false); setSaving(true); setError(""); setMessage("");
      try { setProfile(await saveProfile(profile)); setMessage("Profile saved."); onSaved(); }
      catch (error) { setConflict(isRecordConflict(error)); setError(error instanceof Error ? error.message : "Unable to save profile."); }
      finally { setSaving(false); }
    }}>
      <label>Email<input aria-label="Email" value={profile.email} readOnly /><small>Contact an administrator to change your sign-in email.</small></label>
      <label>Display name<input maxLength={250} value={profile.displayName ?? ""} onChange={event => { const value = event.target.value; setProfile(current => current && ({ ...current, displayName: value })); }} /></label>
      <label>Phone (optional)<input type="tel" maxLength={50} value={profile.phone ?? ""} onChange={event => { const value = event.target.value; setProfile(current => current && ({ ...current, phone: value })); }} /></label>
      <label>Organization (optional)<input maxLength={250} value={profile.organization ?? ""} onChange={event => { const value = event.target.value; setProfile(current => current && ({ ...current, organization: value })); }} /></label>
      <label>Preferred cemetery<select value={profile.preferredCemeteryId ?? ""} onChange={event => { const value = event.target.value; setProfile(current => current && ({ ...current, preferredCemeteryId: value })); }}>
        <option value="">No preference</option>
        {cemeteries.filter(cemetery => user.role === "admin" || user.assignedCemeteryIds.includes(cemetery.id)).map(cemetery => <option key={cemetery.id} value={cemetery.id}>{cemetery.name}</option>)}
      </select></label>
      {conflict&&<ConflictRecovery disabled={saving} reload={async()=>{const latest=await fetchProfile();if(!latest)throw new Error("Profile unavailable.");setProfile(latest);setError("");setConflict(false);}}/>}
      <div className="admin-form-actions profile-form-actions">
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
        <button type="button" className="secondary-button" data-discard-draft onClick={onClose} disabled={saving}>Cancel</button>
      </div>
    </form> : null}
    {profile?.createdAt ? <p className="profile-help">Member since {new Date(profile.createdAt).toLocaleDateString()}</p> : null}
    </section>
    <section className="admin-section">
      <div className="section-title"><ShieldCheck size={17} aria-hidden="true" /><h3>Cemetery access</h3></div>
      {user.role === "admin" ? <p className="profile-help">System administrator · all cemeteries</p> : <dl className="record-audit-fields">{user.cemeteryMemberships?.map(membership => <div key={membership.cemeteryId}><dt>{cemeteries.find(cemetery => cemetery.id === membership.cemeteryId)?.name ?? membership.cemeteryId}</dt><dd>{{ reader: "Read-only", "power-user": "Power user", "cemetery-admin": "Cemetery admin" }[membership.role]}</dd></div>)}</dl>}
      <p className="profile-help">Administrators manage your access and cemetery roles.</p>
    </section>
  </Modal>;
}
