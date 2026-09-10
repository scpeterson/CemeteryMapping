import { useRef, useState } from "react";
import { BarChart3, MapPinned, Menu, ShieldCheck } from "lucide-react";
import { useAccountSession } from "../auth/sessionContext";
import type { CurrentUser } from "../types";

type ApplicationHeaderProps = {
  cemeteryScopeLabel: string;
  currentUser?: CurrentUser;
  cemeteries?: { id: string; name: string }[];
  cemeteryScope?: string;
  onCemeteryScopeChange?: (id: string) => void;
  onOpenReports: () => void;
  onOpenControl: () => void;
  onOpenAdmin: () => void;
};

export function ApplicationHeader({
  cemeteryScopeLabel, cemeteries, cemeteryScope, onCemeteryScopeChange, currentUser, onOpenReports, onOpenControl, onOpenAdmin,
}: ApplicationHeaderProps) {
  const session = useAccountSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  return (
    <header className="application-header" onKeyDown={(event) => {
      if (event.key === "Escape" && menuOpen) {
        event.preventDefault();
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }}>
      <div className="application-brand">
        <h1>Cemetery Map</h1>
        <p>{cemeteryScopeLabel}</p>
        {currentUser?.role === "admin" && cemeteries?.length ? <label className="cemetery-scope" htmlFor="cemetery-scope">
          <span className="sr-only">Cemetery</span>
          <select id="cemetery-scope" aria-label="Cemetery" value={cemeteryScope} onChange={(event) => onCemeteryScopeChange?.(event.target.value)}>
            <option value="">All cemeteries</option>
            {cemeteries.map((cemetery) => <option key={cemetery.id} value={cemetery.id}>{cemetery.name}</option>)}
          </select>
        </label> : null}
      </div>
      {currentUser ? <>
        <button
          ref={menuButton}
          type="button"
          className="application-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="application-actions"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu size={18} aria-hidden="true" /> Menu
        </button>
        <nav id="application-actions" className="application-actions" aria-label="Application actions" data-open={menuOpen}>
          <button type="button" onClick={onOpenReports}
            aria-label="Open reports: run saved cemetery reports and guided queries"
            title="Open reports: run saved cemetery reports and guided queries.">
            <BarChart3 size={16} aria-hidden="true" /> Reports
          </button>
          {currentUser.permissions.canOpenAdminPanel ? <>
            <button type="button" onClick={onOpenControl}
              aria-label="Open control point collector: align historic map images to cemetery coordinates"
              title="Open control point collector: align historic map images to cemetery coordinates.">
              <MapPinned size={16} aria-hidden="true" /> Control
            </button>
            <button type="button" onClick={onOpenAdmin}
              aria-label="Open administration: manage users, records, lookups, audits, and system events"
              title="Open administration: manage users, records, lookups, audits, and system events.">
              <ShieldCheck size={16} aria-hidden="true" /> Admin
            </button>
          </> : null}
        </nav>
      </> : null}
      {session ? <div className="auth-session" role="group" aria-label="Signed in user">
        <span title={session.identity}>{session.identity}</span>
        <button type="button" onClick={session.signOut}>Sign out</button>
      </div> : null}
    </header>
  );
}
