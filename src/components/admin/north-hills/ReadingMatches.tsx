import {
candidateGravesiteLabel,
evidenceStatusLabels,
hasNorthHillsEvidenceStatus
} from "../../admin/adminWorkflowConfig";
import { Props } from "./shared";

export function ReadingMatches({ savingEvidenceKey, saveNorthHillsEvidence, canUnlinkNorthHillsEvidence, unlinkNorthHillsEvidence, entry }: Pick<Props, "savingEvidenceKey" | "saveNorthHillsEvidence" | "canUnlinkNorthHillsEvidence" | "unlinkNorthHillsEvidence"> & { entry: Props["northHillsOcrReview"]["entries"][number] }) {
  return (<section className="deed-investigation-links" aria-label="Possible existing burial matches">
                    <h4>Possible existing matches</h4>
                    {entry.candidateMatches.map((match) => {
                      const gravesiteLinked = hasNorthHillsEvidenceStatus(match.gravesiteEvidence, "linked");
                      const gravesiteRejected = hasNorthHillsEvidenceStatus(match.gravesiteEvidence, "rejected");
                      const gravesiteNeedsFieldCheck = hasNorthHillsEvidenceStatus(match.gravesiteEvidence, "needs_field_check");
                      return (
                        <article key={`${entry.id}:${match.burialId}`} className="reading-match-review">
                          <p>
                            <strong>{match.fullName || "Unnamed burial"}:</strong>{" "}
                            Gravesite {candidateGravesiteLabel(match)} · Record ID {match.gravesiteId} · score {match.score}
                          </p>
                          {match.gravesiteEvidence.length ? (
                            <small>
                              Gravesite review:{" "}
                              {match.gravesiteEvidence.map((evidence) => evidenceStatusLabels[evidence.status] ?? evidence.status).join(", ")}
                            </small>
                          ) : null}
                          <div className="reading-match-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={Boolean(savingEvidenceKey) || gravesiteLinked}
                              onClick={() => void saveNorthHillsEvidence(entry.id, "gravesite", match.gravesiteUuid, "linked", `gravesite ${match.gravesiteId}`)}
                              title={gravesiteLinked ? "This North Hills reading is already linked to this gravesite." : "Confirm this North Hills reading belongs to this gravesite."}
                            >
                              Link gravesite
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={Boolean(savingEvidenceKey) || gravesiteRejected}
                              onClick={() => void saveNorthHillsEvidence(entry.id, "gravesite", match.gravesiteUuid, "rejected", `gravesite ${match.gravesiteId}`)}
                              title={gravesiteRejected ? "This possible gravesite match is already rejected." : "Reject this possible gravesite match."}
                            >
                              Reject match
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={Boolean(savingEvidenceKey) || gravesiteNeedsFieldCheck}
                              onClick={() => void saveNorthHillsEvidence(entry.id, "gravesite", match.gravesiteUuid, "needs_field_check", `gravesite ${match.gravesiteId}`)}
                              title={gravesiteNeedsFieldCheck ? "This possible gravesite match is already marked for field review." : "Mark this possible match for field review."}
                            >
                              Needs field check
                            </button>
                            {canUnlinkNorthHillsEvidence && match.gravesiteEvidence.length ? (
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={Boolean(savingEvidenceKey)}
                                onClick={() => void unlinkNorthHillsEvidence(entry.id, "gravesite", match.gravesiteUuid, `gravesite ${match.gravesiteId}`)}
                                title="Remove this North Hills reading from this gravesite."
                              >
                                Unlink gravesite
                              </button>
                            ) : null}
                          </div>
                          {match.headstoneCandidates.length ? (
                            <div className="reading-headstone-candidates">
                              {match.headstoneCandidates.map((headstone) => {
                                const headstoneLinked = hasNorthHillsEvidenceStatus(headstone.evidence, "linked");
                                const headstoneRejected = hasNorthHillsEvidenceStatus(headstone.evidence, "rejected");
                                const headstoneNeedsFieldCheck = hasNorthHillsEvidenceStatus(headstone.evidence, "needs_field_check");
                                return (
                                  <span key={headstone.id}>
                                    <strong>{headstone.headstoneId}</strong>
                                    {headstone.evidence.length ? ` (${headstone.evidence.map((evidence) => evidenceStatusLabels[evidence.status] ?? evidence.status).join(", ")})` : ""}
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      disabled={Boolean(savingEvidenceKey) || headstoneLinked}
                                      onClick={() => void saveNorthHillsEvidence(entry.id, "headstone", headstone.id, "linked", `headstone ${headstone.headstoneId}`)}
                                      title={headstoneLinked ? "This North Hills reading is already linked to this headstone." : "Confirm this North Hills reading belongs to this headstone."}
                                    >
                                      Link headstone
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      disabled={Boolean(savingEvidenceKey) || headstoneRejected}
                                      onClick={() => void saveNorthHillsEvidence(entry.id, "headstone", headstone.id, "rejected", `headstone ${headstone.headstoneId}`)}
                                      title={headstoneRejected ? "This possible headstone match is already rejected." : "Reject this possible headstone match."}
                                    >
                                      Reject headstone
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      disabled={Boolean(savingEvidenceKey) || headstoneNeedsFieldCheck}
                                      onClick={() => void saveNorthHillsEvidence(entry.id, "headstone", headstone.id, "needs_field_check", `headstone ${headstone.headstoneId}`)}
                                      title={headstoneNeedsFieldCheck ? "This possible headstone match is already marked for field review." : "Mark this possible headstone match for field review."}
                                    >
                                      Field check
                                    </button>
                                    {canUnlinkNorthHillsEvidence && headstone.evidence.length ? (
                                      <button
                                        type="button"
                                        className="secondary-button"
                                        disabled={Boolean(savingEvidenceKey)}
                                        onClick={() => void unlinkNorthHillsEvidence(entry.id, "headstone", headstone.id, `headstone ${headstone.headstoneId}`)}
                                        title="Remove this North Hills reading from this headstone."
                                      >
                                        Unlink headstone
                                      </button>
                                    ) : null}
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </section>);
}
