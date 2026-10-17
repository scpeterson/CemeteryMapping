import { FileText } from "lucide-react";
import type {
NorthHillsOcrObservation,
NorthHillsSourceFact,
NorthHillsSourceFactStatus
} from "../../../types";
import {
blankNorthHillsObservation,
blankNorthHillsSourceFact,
confidenceLabels,
entryStatusOptions,
markerScopeOptions,
observationStatusLabels,
observationTypeLabels,
sourceFactStatusLabels,
sourceFactTypeLabels
} from "../../admin/adminWorkflowConfig";
import { Props } from "./shared";

export function ReadingEditor({ savingEvidenceKey, northHillsEntryForm, saveNorthHillsEntryEdit, updateNorthHillsEntryForm, updateNorthHillsSourceFactForm, updateNorthHillsObservationForm, cancelNorthHillsEntryEdit, entry }: Pick<Props, "savingEvidenceKey" | "northHillsEntryForm" | "saveNorthHillsEntryEdit" | "updateNorthHillsEntryForm" | "updateNorthHillsSourceFactForm" | "updateNorthHillsObservationForm" | "cancelNorthHillsEntryEdit"> & { entry: Props["northHillsOcrReview"]["entries"][number] } & { northHillsEntryForm: NonNullable<Props["northHillsEntryForm"]> }) {
  return (<form className="reading-entry-edit-form" onSubmit={saveNorthHillsEntryEdit}>
                    <div className="section-title">
                      <FileText size={16} aria-hidden="true" />
                      <h4>Edit NHG Entry</h4>
                    </div>
                    <label className="wide-field">
                      Raw entry text
                      <textarea
                        value={northHillsEntryForm.rawText}
                        onChange={(event) => updateNorthHillsEntryForm({ rawText: event.target.value })}
                        rows={5}
                      />
                    </label>
                    <div className="reading-edit-grid">
                      <label>
                        Name
                        <input value={northHillsEntryForm.nameText} onChange={(event) => updateNorthHillsEntryForm({ nameText: event.target.value })} />
                      </label>
                      <label>
                        Surnames
                        <input value={northHillsEntryForm.surnamesText} onChange={(event) => updateNorthHillsEntryForm({ surnamesText: event.target.value })} />
                      </label>
                      <label>
                        Page
                        <input
                          type="number"
                          value={northHillsEntryForm.sourcePageNumber ?? ""}
                          onChange={(event) => updateNorthHillsEntryForm({ sourcePageNumber: event.target.value ? Number(event.target.value) : null })}
                        />
                      </label>
                      <label>
                        Line start
                        <input
                          type="number"
                          value={northHillsEntryForm.sourceLineStart ?? ""}
                          onChange={(event) => updateNorthHillsEntryForm({ sourceLineStart: event.target.value ? Number(event.target.value) : null })}
                        />
                      </label>
                      <label>
                        Line end
                        <input
                          type="number"
                          value={northHillsEntryForm.sourceLineEnd ?? ""}
                          onChange={(event) => updateNorthHillsEntryForm({ sourceLineEnd: event.target.value ? Number(event.target.value) : null })}
                        />
                      </label>
                      <label>
                        Section
                        <input value={northHillsEntryForm.parsedSectionName} onChange={(event) => updateNorthHillsEntryForm({ parsedSectionName: event.target.value.toUpperCase() })} />
                      </label>
                      <label>
                        Row
                        <input
                          type="number"
                          value={northHillsEntryForm.parsedRowNumber ?? ""}
                          onChange={(event) => updateNorthHillsEntryForm({ parsedRowNumber: event.target.value ? Number(event.target.value) : null })}
                        />
                      </label>
                      <label>
                        Position
                        <input
                          type="number"
                          value={northHillsEntryForm.parsedPositionNumber ?? ""}
                          onChange={(event) => updateNorthHillsEntryForm({ parsedPositionNumber: event.target.value ? Number(event.target.value) : null })}
                        />
                      </label>
                      <label>
                        Scope
                        <select value={northHillsEntryForm.parsedMarkerScope} onChange={(event) => updateNorthHillsEntryForm({ parsedMarkerScope: event.target.value })}>
                          {markerScopeOptions.map((scope) => (
                            <option key={scope || "blank"} value={scope}>
                              {scope || "Not recorded"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Marker
                        <input value={northHillsEntryForm.markerTypeText} onChange={(event) => updateNorthHillsEntryForm({ markerTypeText: event.target.value })} />
                      </label>
                      <label>
                        Material
                        <input value={northHillsEntryForm.materialText} onChange={(event) => updateNorthHillsEntryForm({ materialText: event.target.value })} />
                      </label>
                      <label>
                        Condition
                        <input value={northHillsEntryForm.conditionText} onChange={(event) => updateNorthHillsEntryForm({ conditionText: event.target.value })} />
                      </label>
                      <label>
                        Years
                        <input value={northHillsEntryForm.parsedYearsText} onChange={(event) => updateNorthHillsEntryForm({ parsedYearsText: event.target.value })} />
                      </label>
                      <label>
                        Confidence
                        <select value={northHillsEntryForm.parseConfidence} onChange={(event) => updateNorthHillsEntryForm({ parseConfidence: event.target.value })}>
                          {Object.entries(confidenceLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Status
                        <select value={northHillsEntryForm.status} onChange={(event) => updateNorthHillsEntryForm({ status: event.target.value })}>
                          {entryStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="wide-field">
                      Inscription text
                      <textarea
                        value={northHillsEntryForm.inscriptionText}
                        onChange={(event) => updateNorthHillsEntryForm({ inscriptionText: event.target.value })}
                        rows={3}
                      />
                    </label>
                    <label className="wide-field">
                      Parser notes
                      <textarea
                        value={northHillsEntryForm.parseNotesText}
                        onChange={(event) => updateNorthHillsEntryForm({ parseNotesText: event.target.value })}
                        rows={2}
                      />
                    </label>
                    <section className="reading-edit-subsection">
                      <div className="reading-edit-subsection-title">
                        <h5>CR/CRG source facts</h5>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => updateNorthHillsEntryForm({ sourceFacts: [...northHillsEntryForm.sourceFacts, blankNorthHillsSourceFact()] })}
                        >
                          Add fact
                        </button>
                      </div>
                      {northHillsEntryForm.sourceFacts.map((fact, index) => (
                        <div key={fact.id || `new-fact-${index}`} className="reading-edit-repeat-row">
                          <select value={fact.sourceCode} onChange={(event) => updateNorthHillsSourceFactForm(index, { sourceCode: event.target.value as "CR" | "CRG" })}>
                            <option value="CR">CR</option>
                            <option value="CRG">CRG</option>
                          </select>
                          <select value={fact.factType} onChange={(event) => updateNorthHillsSourceFactForm(index, { factType: event.target.value as NorthHillsSourceFact["factType"] })}>
                            {Object.entries(sourceFactTypeLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <input value={fact.factValue} onChange={(event) => updateNorthHillsSourceFactForm(index, { factValue: event.target.value })} placeholder="Value" />
                          <input type="date" value={fact.factDate ?? ""} onChange={(event) => updateNorthHillsSourceFactForm(index, { factDate: event.target.value })} />
                          <select value={fact.confidence} onChange={(event) => updateNorthHillsSourceFactForm(index, { confidence: event.target.value as NorthHillsSourceFact["confidence"] })}>
                            {Object.entries(confidenceLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <select value={fact.status} onChange={(event) => updateNorthHillsSourceFactForm(index, { status: event.target.value as NorthHillsSourceFactStatus })}>
                            {Object.entries(sourceFactStatusLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <textarea value={fact.rawText} onChange={(event) => updateNorthHillsSourceFactForm(index, { rawText: event.target.value })} placeholder="Raw source text" rows={2} />
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => updateNorthHillsEntryForm({ sourceFacts: northHillsEntryForm.sourceFacts.filter((_, factIndex) => factIndex !== index) })}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </section>
                    <section className="reading-edit-subsection">
                      <div className="reading-edit-subsection-title">
                        <h5>Observations</h5>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => updateNorthHillsEntryForm({ observations: [...northHillsEntryForm.observations, blankNorthHillsObservation()] })}
                        >
                          Add observation
                        </button>
                      </div>
                      {northHillsEntryForm.observations.map((observation, index) => (
                        <div key={observation.id || `new-observation-${index}`} className="reading-edit-repeat-row reading-edit-observation-row">
                          <select
                            value={observation.observationType}
                            onChange={(event) => updateNorthHillsObservationForm(index, { observationType: event.target.value as NorthHillsOcrObservation["observationType"] })}
                          >
                            {Object.entries(observationTypeLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <select value={observation.status} onChange={(event) => updateNorthHillsObservationForm(index, { status: event.target.value as NorthHillsOcrObservation["status"] })}>
                            {Object.entries(observationStatusLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <textarea
                            value={observation.observationText}
                            onChange={(event) => updateNorthHillsObservationForm(index, { observationText: event.target.value })}
                            rows={2}
                          />
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => updateNorthHillsEntryForm({ observations: northHillsEntryForm.observations.filter((_, observationIndex) => observationIndex !== index) })}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </section>
                    <label className="wide-field">
                      Change reason
                      <input value={northHillsEntryForm.reason} onChange={(event) => updateNorthHillsEntryForm({ reason: event.target.value })} />
                    </label>
                    <div className="admin-form-actions">
                      <button type="submit" disabled={savingEvidenceKey === `${entry.id}:entry-edit`}>
                        {savingEvidenceKey === `${entry.id}:entry-edit` ? "Saving..." : "Save entry"}
                      </button>
                      <button type="button" className="secondary-button" onClick={cancelNorthHillsEntryEdit}>
                        Cancel
                      </button>
                    </div>
                  </form>);
}
