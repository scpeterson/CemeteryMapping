import type { InscriptionStatus, CurrentLegibility, HistoricalTranscription } from "../../types";
import { inscriptionAllowsText, inscriptionStatus } from "../../../shared/inscriptionStatus.mjs";
import { currentLegibility as resolveLegibility, legibilityLabels, preserveTranscription } from "../../../shared/inscriptionHistory.mjs";
import { HistoricalTranscriptions } from "./HistoricalTranscriptions";

type Value = { inscription: string; inscriptionStatus: InscriptionStatus; currentLegibility: CurrentLegibility; historicalTranscriptions: HistoricalTranscription[] };
export function InscriptionFields({ text, status, currentLegibility, historicalTranscriptions = [], disabled, rows = 5, onChange }: {
  text: string; status?: InscriptionStatus; currentLegibility?: CurrentLegibility;
  historicalTranscriptions?: HistoricalTranscription[]; disabled?: boolean; rows?: number; onChange: (value: Value) => void;
}) {
  const legibility = resolveLegibility(currentLegibility, status);
  const terminal = legibility === "blank" || legibility === "illegible";
  const selected = terminal ? legibility : inscriptionStatus(status, text);
  const change = (value: Partial<Value>) => onChange({ inscription: text, inscriptionStatus: selected, currentLegibility: legibility, historicalTranscriptions, ...value });
  return <>
    <label className="headstone-wide-field">Current legibility
      <select value={legibility} disabled={disabled} onChange={(event) => {
        const next = event.target.value as CurrentLegibility;
        const clears = next === "blank" || next === "illegible";
        if (clears && text.length && !window.confirm("Preserve the current transcription in history and clear the current inscription field?")) return;
        change({ currentLegibility: next, inscription: clears ? "" : text,
          inscriptionStatus: clears ? next : (text.trim() ? "transcribed" : "not_recorded"),
          historicalTranscriptions: clears ? preserveTranscription(historicalTranscriptions, text) : historicalTranscriptions });
      }}>
        {Object.entries(legibilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    {!terminal ? <label className="headstone-wide-field">Inscription status
      <select value={selected} disabled={disabled} onChange={(event) => {
        const next = event.target.value as InscriptionStatus;
        if (next === "not_recorded" && text.length && !window.confirm("Preserve the current transcription in history and clear the current inscription field?")) return;
        change({ inscriptionStatus: next, inscription: next === "not_recorded" ? "" : text,
          historicalTranscriptions: next === "not_recorded" ? preserveTranscription(historicalTranscriptions, text) : historicalTranscriptions });
      }}><option value="not_recorded">Not recorded</option><option value="transcribed">Transcribed</option></select>
    </label> : <p className="muted">Current transcription: none (currently {legibility}). Earlier text is preserved below.</p>}
    <label className="headstone-wide-field">Inscription
      <textarea value={text} rows={rows} maxLength={20000} disabled={disabled || terminal || !inscriptionAllowsText(selected)}
        onChange={(event) => change({ inscription: event.target.value, inscriptionStatus: "transcribed" })} />
    </label>
    <p className="muted headstone-wide-field">Current text may include [blank], [illegible], or [illegible lines] for partial transcriptions. Keep earlier source readings in Historical transcriptions.</p>
    <HistoricalTranscriptions entries={historicalTranscriptions} disabled={disabled} onAdd={(entry) => change({ historicalTranscriptions: [...historicalTranscriptions, entry] })} />
  </>;
}
