import type { useInspectionDisplayPreferences } from "./useInspectionDisplayPreferences";

type Props = Pick<ReturnType<typeof useInspectionDisplayPreferences>, "displayPreferencesReset" | "displayResetButton" | "displayResetNotice" | "resetDisplayPreferences" | "restoredDefaultsControl" | "restoredDisplayDefaults" | "resetKeyboardHelpControl" | "dismissDisplayReset"> & { requirementsId: string };

export function InspectionDisplaySettings({ displayPreferencesReset, displayResetButton, displayResetNotice, resetDisplayPreferences, restoredDefaultsControl, restoredDisplayDefaults, resetKeyboardHelpControl, dismissDisplayReset, requirementsId }: Props) {
  return (
      <section className="inspection-display-settings" aria-label="Display preferences">
      <h5>Display preferences</h5>
      <button type="button" className="secondary-button inspection-display-preferences-reset" ref={displayResetButton} onClick={resetDisplayPreferences}>Reset display preferences</button>
      {displayPreferencesReset ? <div className="inspection-display-reset-notice" ref={displayResetNotice}>
          <div><div className="inspection-restored-defaults">
            <p role="status">Display defaults restored:</p>
            <details className="inspection-restored-defaults-list" open={restoredDefaultsControl.open}>
              <summary onClick={event=>{event.preventDefault();restoredDefaultsControl.apply(!restoredDefaultsControl.open);}}>{restoredDefaultsControl.controlLabel} ({restoredDisplayDefaults.length})</summary>
            <ul>
              {restoredDisplayDefaults.map(setting=><li key={setting.id}>{setting.label}: {setting.defaultOpen?"shown":"hidden"}</li>)}
            </ul>
            </details>
          </div>
          <details className="inspection-reset-keyboard-help" open={resetKeyboardHelpControl.open}>
            <summary onClick={event=>{event.preventDefault();resetKeyboardHelpControl.apply(!resetKeyboardHelpControl.open);}}>{resetKeyboardHelpControl.controlLabel}</summary>
          <ul id={`${requirementsId}-reset-escape`} className="inspection-reset-escape-hint">
            <li><kbd>Tab/Shift+Tab</kbd> <span>Next/previous control</span></li>
            <li><kbd>Enter/Space</kbd> <span>Activate Dismiss</span></li>
            <li><kbd>Escape</kbd> <span>Dismiss and return to Reset display preferences</span></li>
          </ul>
          </details></div>
          <button type="button" className="secondary-button" aria-label="Dismiss display preferences confirmation" aria-keyshortcuts="Escape" aria-describedby={`${requirementsId}-reset-escape`} onClick={()=>dismissDisplayReset(true)}>Dismiss</button>
        </div> : null}
      </section>
  );
}
