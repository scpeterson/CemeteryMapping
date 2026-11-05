import type { useRecordOptions } from "../../hooks/useRecordOptions";

export function RecordOptionSearch({ records, label }: { records: ReturnType<typeof useRecordOptions>; label: string }) {
  return <div className="headstone-wide-field">
    <label>{label}<input type="search" value={records.query} onChange={event => records.setQuery(event.target.value)} /></label>
    <div className="headstone-form-actions">
      <button type="button" className="secondary-button" disabled={records.loading || records.offset===0} onClick={()=>records.setOffset(Math.max(0,records.offset-records.pageSize))}>Previous options</button>
      <span>Page {Math.floor(records.offset/records.pageSize)+1}</span>
      <button type="button" className="secondary-button" disabled={records.loading || !records.hasMore} onClick={()=>records.setOffset(records.offset+records.pageSize)}>Next options</button>
    </div>
    {records.loading && <small role="status">Loading options…</small>}
    {!records.loading && !records.error && records.matchCount===0 && <small role="status">No matching records. Try another search.</small>}
    {records.error && <p className="form-error" role="alert">{records.error}</p>}
  </div>;
}
