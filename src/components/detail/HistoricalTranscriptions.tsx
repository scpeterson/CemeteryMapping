import { useState } from "react";
import type { HistoricalTranscription } from "../../types";

export function HistoricalTranscriptions({ entries = [], onAdd, disabled }: {
  entries?: HistoricalTranscription[]; disabled?: boolean; onAdd?: (entry: HistoricalTranscription) => void;
}) {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [sourceDate, setSourceDate] = useState("");
  const isNhg = /\b(?:NHG|North Hills Genealogists)\b/iu.test(source);
  return <section className="headstone-wide-field" aria-label="Historical transcriptions">
    <h5>Historical transcriptions</h5>
    <p className="muted">Earlier readings are evidence of what was recorded then, not what can be read today. Source dates may be a year alone.</p>
    {entries.map((entry) => <div key={entry.id}>
      <p><strong>{entry.source}</strong>{entry.sourceDate ? ` · ${entry.sourceDate}` : " · Date not recorded"}{entry.faceLabel ? ` · ${entry.faceLabel}` : ""}</p>
      <p className="note-box inscription-box">{entry.text}</p>
    </div>)}
    {!entries.length ? <p className="muted">No historical transcriptions recorded.</p> : null}
    {onAdd ? <fieldset disabled={disabled}>
      <legend>Add historical transcription</legend>
      <label>Historical transcription<textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} rows={4} /></label>
      <label>Historical source<input value={source} onChange={(e) => setSource(e.target.value)} maxLength={500} placeholder="For example: North Hills Genealogists" /></label>
      <label>Source year or date<input value={isNhg ? "2005-10-11" : sourceDate} disabled={isNhg} onChange={(e) => setSourceDate(e.target.value)} placeholder="2005 or YYYY-MM-DD" pattern="[0-9]{4}(-[0-9]{2}-[0-9]{2})?" maxLength={10} /></label>
      <button type="button" disabled={!text.trim() || !source.trim() || (!isNhg && Boolean(sourceDate) && !/^\d{4}(?:-\d{2}-\d{2})?$/u.test(sourceDate))} onClick={() => {
        onAdd({ id: crypto.randomUUID(), text, source, sourceDate: isNhg ? "2005-10-11" : sourceDate }); setText(""); setSource(""); setSourceDate("");
      }}>Add historical transcription</button>
    </fieldset> : null}
  </section>;
}
