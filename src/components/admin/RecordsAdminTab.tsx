import { Landmark } from "lucide-react";
import { formatAdminTimestamp } from "../../lib/format";
import type { CemeteryAdminRecords, CemeteryTextRecord, LotTextRecord, SectionTextRecord } from "../../types";

const alternateNamesText = (alternateNames: string[]) => alternateNames.join("\n");
const parseAlternateNames = (value: string) =>
  [...new Set(value.split(/\r?\n|,/u).map((item) => item.trim()).filter(Boolean))];
const cemeteryPickerLabel = (cemetery: CemeteryTextRecord) => cemetery.name;
const sectionPickerLabel = (section: SectionTextRecord) => `Section ${section.name}`;
const lotPickerLabel = (lot: LotTextRecord) => `Lot ${lot.lotId} - ${lot.name}`;

type RecordsAdminTabProps = {
  cemeteryRecords: CemeteryAdminRecords;
  selectedCemeteryId: string;
  selectedSectionId: string;
  selectedLotId: string;
  selectedCemetery?: CemeteryTextRecord;
  selectedSection?: SectionTextRecord;
  selectedLot?: LotTextRecord;
  sectionsForSelectedCemetery: SectionTextRecord[];
  lotsForSelectedSection: LotTextRecord[];
  canEditSelectedCemetery: boolean;
  savingRecordKey?: string;
  selectCemeteryById: (id: string) => void;
  selectSectionById: (id: string) => void;
  selectLotById: (id: string) => void;
  updateCemeteryRecord: (id: string, patch: Partial<CemeteryTextRecord>) => void;
  updateSectionRecord: (id: string, patch: Partial<SectionTextRecord>) => void;
  updateLotRecord: (id: string, patch: Partial<LotTextRecord>) => void;
  saveCemeteryRecord: (record: CemeteryTextRecord) => Promise<void>;
  saveSectionRecord: (record: SectionTextRecord) => Promise<void>;
  saveLotRecord: (record: LotTextRecord) => Promise<void>;
};

export function RecordsAdminTab({
  cemeteryRecords,
  selectedCemeteryId,
  selectedSectionId,
  selectedLotId,
  selectedCemetery,
  selectedSection,
  selectedLot,
  sectionsForSelectedCemetery,
  lotsForSelectedSection,
  canEditSelectedCemetery,
  savingRecordKey,
  selectCemeteryById,
  selectSectionById,
  selectLotById,
  updateCemeteryRecord,
  updateSectionRecord,
  updateLotRecord,
  saveCemeteryRecord,
  saveSectionRecord,
  saveLotRecord,
}: RecordsAdminTabProps) {
  return (
        <>
          <section className="admin-section">
            <div className="section-title">
              <Landmark size={17} aria-hidden="true" />
              <h3>Cemetery Records</h3>
            </div>

            <div className="record-picker-grid">
              <label className="record-picker">
                Cemetery
                <select
                  value={selectedCemeteryId}
                  onChange={(event) => selectCemeteryById(event.target.value)}
                  title="Search for and select the cemetery record to edit."
                >
                  <option value="">Select cemetery</option>
                  {cemeteryRecords.cemeteries.map((cemetery) => (
                    <option key={cemetery.id} value={cemetery.id}>
                      {cemeteryPickerLabel(cemetery)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCemetery ? (
                <label className="record-picker">
                  Section
                  <select
                    value={selectedSectionId}
                    onChange={(event) => selectSectionById(event.target.value)}
                    title="Search for and select a section in the selected cemetery."
                  >
                    <option value="">Select section</option>
                    {sectionsForSelectedCemetery.map((section) => (
                      <option key={section.id} value={section.id}>
                        {sectionPickerLabel(section)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {selectedSection ? (
                <label className="record-picker">
                  Lot
                  <select
                    value={selectedLotId}
                    onChange={(event) => selectLotById(event.target.value)}
                    title="Search for and select a lot in the selected section."
                  >
                    <option value="">Select lot</option>
                    {lotsForSelectedSection.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lotPickerLabel(lot)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="record-editor-list">
              {selectedCemetery ? (
                <article className="record-editor-row record-editor-row-cemetery">
                  <h4>Cemetery</h4>
                  <label className="record-editor-name">
                    Name
                    <input
                      value={selectedCemetery.name}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { name: event.target.value })}
                      title="The cemetery name shown on the map, search results, and cemetery marker."
                    />
                  </label>
                  <label>
                    Full address
                    <input
                      value={selectedCemetery.fullAddress}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { fullAddress: event.target.value })}
                      title="The cemetery's street address or full mailing/location address."
                    />
                  </label>
                  <label>
                    Municipality
                    <input
                      value={selectedCemetery.municipality}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { municipality: event.target.value })}
                      title="The municipality where the cemetery is located."
                    />
                  </label>
                  <label>
                    Agency
                    <input
                      value={selectedCemetery.agency}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { agency: event.target.value })}
                      title="The agency or organization associated with the cemetery."
                    />
                  </label>
                  <label>
                    Agency URL
                    <input
                      value={selectedCemetery.agencyUrl}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { agencyUrl: event.target.value })}
                      title="The agency website URL associated with the cemetery."
                    />
                  </label>
                  <label>
                    Operational hours
                    <input
                      value={selectedCemetery.operationalHours}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { operationalHours: event.target.value })}
                      title="Public or operational hours for the cemetery."
                    />
                  </label>
                  <label>
                    Contact name
                    <input
                      value={selectedCemetery.contactName}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { contactName: event.target.value })}
                      title="Primary contact person for this cemetery record."
                    />
                  </label>
                  <label>
                    Contact phone
                    <input
                      value={selectedCemetery.contactPhone}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { contactPhone: event.target.value })}
                      title="Primary contact phone number for this cemetery record."
                    />
                  </label>
                  <label>
                    Contact email
                    <input
                      value={selectedCemetery.contactEmail}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { contactEmail: event.target.value })}
                      title="Primary contact email address for this cemetery record."
                    />
                  </label>
                  <label>
                    Image URL
                    <input
                      value={selectedCemetery.imageUrl}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { imageUrl: event.target.value })}
                      title="URL for an image associated with this cemetery."
                    />
                  </label>
                  <label>
                    Notes
                    <textarea
                      value={selectedCemetery.notes}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { notes: event.target.value })}
                      rows={8}
                      title="Administrative notes stored with the cemetery record."
                    />
                  </label>
                  <dl className="record-audit-fields" aria-label="Cemetery audit timestamps">
                    <div title="When this cemetery record was created. This field cannot be edited here.">
                      <dt>Created</dt>
                      <dd>{formatAdminTimestamp(selectedCemetery.createdAt)}</dd>
                    </div>
                    <div title="When this cemetery record was last updated. This field cannot be edited here.">
                      <dt>Updated</dt>
                      <dd>{formatAdminTimestamp(selectedCemetery.updatedAt)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void saveCemeteryRecord(selectedCemetery)}
                    disabled={savingRecordKey === `cemetery:${selectedCemetery.id}` || !selectedCemetery.name.trim() || !canEditSelectedCemetery}
                    title={canEditSelectedCemetery ? "Save this cemetery text." : "You have read-only access to this cemetery."}
                  >
                    {savingRecordKey === `cemetery:${selectedCemetery.id}` ? "Saving..." : "Save cemetery"}
                  </button>
                </article>
              ) : (
                <p className="record-editor-empty">Select a cemetery to edit its text records.</p>
              )}

              {selectedCemetery && sectionsForSelectedCemetery.length === 0 ? (
                <p className="record-editor-empty">No sections are available for this cemetery.</p>
              ) : null}

              {selectedSection ? (
                <article className="record-editor-row record-editor-row-section">
                  <h4>Section</h4>
                  <label>
                    Name
                    <input
                      value={selectedSection.name}
                      onChange={(event) => updateSectionRecord(selectedSection.id, { name: event.target.value })}
                      title="The section display name shown on the map label."
                    />
                  </label>
                  <label>
                    Alternate names
                    <textarea
                      value={alternateNamesText(selectedSection.alternateNames)}
                      onChange={(event) => updateSectionRecord(selectedSection.id, { alternateNames: parseAlternateNames(event.target.value) })}
                      rows={3}
                      title="Alternate section names, one per line or separated by commas. For example: OC and Original Cemetery."
                    />
                  </label>
                  <label className="record-editor-notes">
                    Notes
                    <textarea
                      value={selectedSection.notes}
                      onChange={(event) => updateSectionRecord(selectedSection.id, { notes: event.target.value })}
                      rows={6}
                      title="Administrative notes stored with the section record."
                    />
                  </label>
                  <dl className="record-audit-fields" aria-label="Section audit timestamps">
                    <div title="When this section record was created. This field cannot be edited here.">
                      <dt>Created</dt>
                      <dd>{formatAdminTimestamp(selectedSection.createdAt)}</dd>
                    </div>
                    <div title="When this section record was last updated. This field cannot be edited here.">
                      <dt>Updated</dt>
                      <dd>{formatAdminTimestamp(selectedSection.updatedAt)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void saveSectionRecord(selectedSection)}
                    disabled={savingRecordKey === `section:${selectedSection.id}` || !canEditSelectedCemetery}
                    title={canEditSelectedCemetery ? "Save this section name and alternate names." : "You have read-only access to this cemetery."}
                  >
                    {savingRecordKey === `section:${selectedSection.id}` ? "Saving..." : "Save section"}
                  </button>
                </article>
              ) : null}

              {selectedSection && lotsForSelectedSection.length === 0 ? (
                <p className="record-editor-empty">No lots are available for this section.</p>
              ) : null}

              {selectedLot ? (
                <article className="record-editor-row record-editor-row-lot">
                  <h4>Lot</h4>
                  <label>
                    Name
                    <input
                      value={selectedLot.name}
                      onChange={(event) => updateLotRecord(selectedLot.id, { name: event.target.value })}
                      title="The lot display name shown on the map label."
                    />
                  </label>
                  <dl className="record-audit-fields" aria-label="Lot audit timestamps">
                    <div title="When this lot record was created. This field cannot be edited here.">
                      <dt>Created</dt>
                      <dd>{formatAdminTimestamp(selectedLot.createdAt)}</dd>
                    </div>
                    <div title="When this lot record was last updated. This field cannot be edited here.">
                      <dt>Updated</dt>
                      <dd>{formatAdminTimestamp(selectedLot.updatedAt)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void saveLotRecord(selectedLot)}
                    disabled={savingRecordKey === `lot:${selectedLot.id}` || !canEditSelectedCemetery}
                    title={canEditSelectedCemetery ? "Save this lot text." : "You have read-only access to this cemetery."}
                  >
                    {savingRecordKey === `lot:${selectedLot.id}` ? "Saving..." : "Save lot"}
                  </button>
                </article>
              ) : null}
            </div>
          </section>
        </>
  );
}
