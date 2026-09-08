import { confirmDiscardChanges } from "../../hooks/useDraftState";

type Tab<Id extends string> = { id: Id; label: string; description?: string; count?: number };

export function DetailTabs<Id extends string>({ prefix, label, tabs, active, onSelect }: {
  prefix: string;
  label: string;
  tabs: Tab<Id>[];
  active: Id;
  onSelect: (id: Id) => void;
}) {
  return <div className="detail-tabs" role="tablist" aria-label={label}>
    {tabs.map((tab, index) => <button
      key={tab.id} type="button" role="tab" id={`${prefix}-tab-${tab.id}`}
      aria-controls={`${prefix}-panel-${tab.id}`} aria-selected={active === tab.id}
      aria-label={tab.description ?? tab.label} title={tab.description ?? tab.label}
      tabIndex={active === tab.id ? 0 : -1} className={active === tab.id ? "is-active" : undefined}
      onClick={() => onSelect(tab.id)}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        if (!confirmDiscardChanges()) return;
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        onSelect(tabs[next].id);
        document.getElementById(`${prefix}-tab-${tabs[next].id}`)?.focus();
      }}
    >
      <span>{tab.label}</span>
      {tab.count ? <span className="detail-tab-count" aria-label={`${tab.count} items`}>{tab.count}</span> : null}
    </button>)}
  </div>;
}
