import {
deedConfidenceLabel,
sourceFactStatusLabels,
sourceFactTypeLabels
} from "../../admin/adminWorkflowConfig";
import { Props } from "./shared";

export function ReadingSourceFacts({ savingEvidenceKey, saveNorthHillsSourceFactReview, promoteNorthHillsDeathDate, entry }: Pick<Props, "savingEvidenceKey" | "saveNorthHillsSourceFactReview" | "promoteNorthHillsDeathDate"> & { entry: Props["northHillsOcrReview"]["entries"][number] }) {
  return (<section className="deed-investigation-links" aria-label="Church record source facts">
                    <h4>Church record facts</h4>
                    {entry.sourceFacts.map((fact) => {
                      const factReviewed = fact.status === "reviewed";
                      const factRejected = fact.status === "rejected";
                      return (
                        <article key={fact.id} className="reading-match-review">
                          <p>
                            <strong>{fact.sourceCode} {sourceFactTypeLabels[fact.factType]}:</strong> {fact.factValue}
                            {fact.factDate ? ` (${fact.factDate})` : ""}
                          </p>
                          <small>
                            {fact.sourceLabel} · {sourceFactStatusLabels[fact.status] ?? fact.status} · {deedConfidenceLabel(fact.confidence)}
                            {fact.reviewedByEmail ? ` · ${fact.reviewedByEmail}` : ""}
                          </small>
                          {fact.rawText ? <p className="deed-entry-remarks">{fact.rawText}</p> : null}
                          {fact.reviewNotes ? <p className="deed-entry-remarks">{fact.reviewNotes}</p> : null}
                          <div className="reading-match-actions">
                            {fact.status !== "promoted" ? (
                              <>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={Boolean(savingEvidenceKey) || factReviewed}
                                  onClick={() => void saveNorthHillsSourceFactReview(fact, "reviewed")}
                                  title={factReviewed ? "This church record fact is already reviewed." : "Mark this church record fact as reviewed."}
                                >
                                  Mark reviewed
                                </button>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={Boolean(savingEvidenceKey) || factRejected}
                                  onClick={() => void saveNorthHillsSourceFactReview(fact, "rejected")}
                                  title={factRejected ? "This church record fact is already rejected." : "Reject this church record fact."}
                                >
                                  Reject fact
                                </button>
                              </>
                            ) : null}
                            {fact.factType === "death_date" && fact.status !== "promoted"
                              ? entry.candidateMatches.map((match) => (
                                <button
                                  key={`${fact.id}:${match.burialId}`}
                                  type="button"
                                  className="secondary-button"
                                  disabled={Boolean(savingEvidenceKey) || fact.promotedBurialId === match.burialId}
                                  onClick={() => void promoteNorthHillsDeathDate(fact, match)}
                                  title={`Promote this church record death date to ${match.fullName || match.gravesiteId}.`}
                                >
                                  Promote to {match.fullName || match.gravesiteId}
                                </button>
                              ))
                              : null}
                          </div>
                        </article>
                      );
                    })}
                  </section>);
}
