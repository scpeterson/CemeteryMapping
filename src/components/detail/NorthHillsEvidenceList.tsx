import type {
  NorthHillsLinkedEvidence
} from "../../types";

function northHillsLocation(evidence: NorthHillsLinkedEvidence) {
  return [
    evidence.sourcePageNumber ? `page ${evidence.sourcePageNumber}` : undefined,
    evidence.parsedSectionName ? `Section ${evidence.parsedSectionName}` : undefined,
    evidence.parsedRowNumber ? `row ${evidence.parsedRowNumber}` : undefined,
    evidence.parsedPositionNumber ? `#${evidence.parsedPositionNumber}` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

export function NorthHillsEvidenceList({ evidence }: { evidence: NorthHillsLinkedEvidence[] }) {
  if (!evidence.length) return null;

  return (
    <div className="north-hills-evidence-list">
      {evidence.map((item) => (
        <article key={item.id} className="north-hills-evidence">
          <strong>{item.nameText || "North Hills reading"}</strong>
          <small>{northHillsLocation(item)}</small>
          <p>{item.rawText}</p>
          {item.reviewNotes ? <small>Review notes: {item.reviewNotes}</small> : null}
        </article>
      ))}
    </div>
  );
}
