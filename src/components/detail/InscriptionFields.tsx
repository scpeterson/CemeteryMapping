import type { InscriptionStatus, CurrentLegibility, HistoricalTranscription } from "../../types";
import { inscriptionStatus, inscriptionPlaceholder, wholeFaceInscription } from "../../../shared/inscriptionStatus.mjs";
import { currentLegibility as resolveLegibility, legibilityLabels, preserveTranscription } from "../../../shared/inscriptionHistory.mjs";
import { HistoricalTranscriptions } from "./HistoricalTranscriptions";

type Value = { inscription: string; inscriptionStatus: InscriptionStatus; currentLegibility: CurrentLegibility; historicalTranscriptions: HistoricalTranscription[] };
export function InscriptionFields({ text, status, currentLegibility, historicalTranscriptions = [], disabled, rows = 5, textLabel = "Inscription", onChange }: {
  text: string; status?: InscriptionStatus; currentLegibility?: CurrentLegibility;
  historicalTranscriptions?: HistoricalTranscription[]; disabled?: boolean; rows?: number; textLabel?: string; onChange: (value: Value) => void;
}) {
  const legibility = status === "blank" || status === "illegible" ? status : resolveLegibility(currentLegibility, status);
  const hasText = Boolean(text.trim()) && !inscriptionPlaceholder(text);
  const terminal = legibility === "blank" || legibility === "illegible";
  const selected = terminal ? legibility : inscriptionStatus(status, text);
  const change = (value: Partial<Value>) => onChange({ inscription: text, inscriptionStatus: selected, currentLegibility: legibility, historicalTranscriptions, ...value });
  return <>
    <fieldset className="headstone-wide-field" disabled={disabled || hasText}>
      <legend>Whole-face inscription</legend>
      {(["illegible", "blank"] as const).map(value => <label key={value} className="headstone-checkbox-field">
        <input type="checkbox" checked={legibility === value} onChange={event => {
          if (disabled || hasText) return;
          change(wholeFaceInscription(event.target.checked ? value : undefined));
        }} />{legibilityLabels[value]}
      </label>)}
    </fieldset>
    {!terminal ? <><label className="headstone-wide-field">Current legibility
      <select value={legibility} disabled={disabled} onChange={event => change({ currentLegibility: event.target.value as CurrentLegibility })}>
        {(["unknown", "legible", "partially_legible"] as const).map(value => <option key={value} value={value}>{legibilityLabels[value]}</option>)}
      </select>
    </label>
    <label className="headstone-wide-field">Inscription status
      <select value={selected} disabled={disabled} onChange={(event) => {
        const next = event.target.value as InscriptionStatus;
        if (next === "not_recorded" && text.length && !window.confirm("Move this transcription to history and clear the current field?")) return;
        change({ inscriptionStatus: next, inscription: next === "not_recorded" ? "" : text,
          historicalTranscriptions: next === "not_recorded" ? preserveTranscription(historicalTranscriptions, text) : historicalTranscriptions });
      }}><option value="not_recorded">Not recorded</option><option value="transcribed">Transcribed</option></select>
    </label></> : null}
    <label className="headstone-wide-field">{textLabel}
      <textarea value={text} rows={rows} maxLength={20000} disabled={disabled || terminal}
        onChange={(event) => change({ inscription: event.target.value, inscriptionStatus: "transcribed" })} />
    </label>
    <p className="muted headstone-wide-field">Blank: intentionally uninscribed. Illegible: unreadable. Uncheck to enter text. Mixed readings remain text.</p>
    <HistoricalTranscriptions entries={historicalTranscriptions} disabled={disabled} onAdd={(entry) => change({ historicalTranscriptions: [...historicalTranscriptions, entry] })} />
  </>;
}
