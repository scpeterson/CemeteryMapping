import type { InscriptionStatus } from "../../types";
import { inscriptionAllowsText, inscriptionStatus } from "../../../shared/inscriptionStatus.mjs";

export function InscriptionFields({ text, status, disabled, rows = 5, onChange }: {
  text: string; status?: InscriptionStatus; disabled?: boolean; rows?: number;
  onChange: (value: { inscription: string; inscriptionStatus: InscriptionStatus }) => void;
}) {
  const selected = inscriptionStatus(status, text);
  return <>
    <label className="headstone-wide-field">Inscription status
      <select value={selected} disabled={disabled} onChange={(event) => {
        const next = event.target.value as InscriptionStatus;
        const clearsText = !inscriptionAllowsText(next) || next === "not_recorded";
        if (clearsText && text.length && !window.confirm("Changing this status clears the existing inscription text. Continue?")) return;
        onChange({ inscriptionStatus: next, inscription: clearsText ? "" : text });
      }}>
        <option value="not_recorded">Not recorded</option>
        <option value="transcribed">Transcribed</option>
        <option value="blank">Blank</option>
        <option value="illegible">Illegible</option>
      </select>
    </label>
    <label className="headstone-wide-field">Inscription
      <textarea value={text} rows={rows} maxLength={20000} disabled={disabled || !inscriptionAllowsText(selected)}
        onChange={(event) => onChange({ inscription: event.target.value, inscriptionStatus: "transcribed" })} />
    </label>
    <p className="muted headstone-wide-field">Blank means no inscription is present; Illegible means none can be read. Use Transcribed for partial text, including [blank], [illegible], or [illegible lines] within it.</p>
  </>;
}
