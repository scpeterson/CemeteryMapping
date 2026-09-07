import { Modal } from "./ui/Modal";
import { Activity, BookOpenText, FileSearch, FileText, History, Landmark, ListChecks, ShieldAlert, UserCog, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import type {
  AuditEventFilters
} from "../types";
import type { DataQualityReviewTarget } from "./DataQualityAdminTab";
import { AdminPanelProps, AdminTab } from "./admin/adminWorkflowConfig";
import { useBulkAdministration } from "./admin/useBulkAdministration";
import { useCemeteryAdministration } from "./admin/useCemeteryAdministration";
import { useDeedAdministration } from "./admin/useDeedAdministration";
import { useLookupAdministration } from "./admin/useLookupAdministration";
import { useNorthHillsAdministration } from "./admin/useNorthHillsAdministration";
import { useSourcePeopleAdministration } from "./admin/useSourcePeopleAdministration";
const AuditAdminTab = lazy(() => import("./AdminEventTabs").then((module) => ({ default: module.AuditAdminTab })));
const SystemEventsAdminTab = lazy(() => import("./AdminEventTabs").then((module) => ({ default: module.SystemEventsAdminTab })));
const DataQualityAdminTab = lazy(() => import("./DataQualityAdminTab").then((module) => ({ default: module.DataQualityAdminTab })));
const DeedsAdminTab = lazy(() => import("./admin/DeedsAdminTab").then((module) => ({ default: module.DeedsAdminTab })));
const UsersAdminTab = lazy(() => import("./admin/UsersAdminTab").then((module) => ({ default: module.UsersAdminTab })));
const RecordsAdminTab = lazy(() => import("./admin/RecordsAdminTab").then((module) => ({ default: module.RecordsAdminTab })));
const BulkAdminTab = lazy(() => import("./admin/BulkAdminTab").then((module) => ({ default: module.BulkAdminTab })));
const NorthHillsAdminTab = lazy(() => import("./admin/NorthHillsAdminTab").then((module) => ({ default: module.NorthHillsAdminTab })));
const SourcePeopleAdminTab = lazy(() => import("./admin/SourcePeopleAdminTab").then((module) => ({ default: module.SourcePeopleAdminTab })));
const LookupAdminTab = lazy(() => import("./admin/LookupAdminTab").then((module) => ({ default: module.LookupAdminTab })));
export function AdminPanel({ currentUser, onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(currentUser.permissions.canManageUsers ? "users" : "records");
  const [auditSeedFilters, setAuditSeedFilters] = useState<AuditEventFilters>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const canManageUsers = currentUser.permissions.canManageUsers;
  const canUseSystemAdminTabs = currentUser.role === "admin";
  const canUseBulkTools = currentUser.role === "cemetery-admin" || currentUser.role === "admin";
  const canUseSourcePersonTab = currentUser.role === "cemetery-admin" || currentUser.role === "admin";
  const canUnlinkNorthHillsEvidence = currentUser.role === "cemetery-admin" || currentUser.role === "admin";
  const canEditNorthHillsEntries = currentUser.role === "cemetery-admin" || currentUser.role === "admin";
  const scrollAdminItemIntoView = (elementId: string) => {
    window.requestAnimationFrame(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const openSystemTab = () => {
    setActiveTab("system");
  };
  const openAuditTab = () => {
    setActiveTab("audit");
  };
  const openDataQualityReviewTarget = (target: DataQualityReviewTarget) => {
    setError(undefined);
    if (target === "northHills") {
      openNorthHillsReviewQueue();
      return;
    }
    if (target === "sourcePeople") {
      openSourcePeopleReviewQueue();
      return;
    }

    openBulkToolsTab();
    setMessage(
      target === "bulkMarkers"
        ? "Use Bulk marker tools for marker type, material, and condition cleanup."
        : "Use Bulk tools and the Readings panel for marker-to-gravesite link cleanup.",
    );
  };
  const {
    cemeteryRecords,
    selectedCemeteryId,
    selectedSectionId,
    selectedLotId,
    isLoading,
    savingRecordKey,
    selectedCemetery,
    sectionsForSelectedCemetery,
    selectedSection,
    lotsForSelectedSection,
    selectedLot,
    canEditSelectedCemetery,
    updateCemeteryRecord,
    updateSectionRecord,
    updateLotRecord,
    saveCemeteryRecord,
    saveSectionRecord,
    saveLotRecord,
    selectCemeteryById,
    selectSectionById,
    selectLotById
  } = useCemeteryAdministration({ currentUser, setError, canManageUsers, setMessage });

  const {
    deedRegistryReview,
    deedReviewFilters,
    setDeedReviewFilters,
    deedCases,
    deedCaseFilters,
    setDeedCaseFilters,
    selectedDeedCaseId,
    deedCaseForm,
    setDeedCaseForm,
    selectedDeedActionId,
    deedActionForm,
    setDeedActionForm,
    isLoadingDeedReview,
    isLoadingDeedCases,
    savingDeedCaseKey,
    savingDeedActionKey,
    selectedDeedBatch,
    removedOriginalDeedEntries,
    selectedDeedCase,
    deedResearchTerms,
    deedInvestigationOwners,
    deedInvestigationLots,
    deedInvestigationNoteCount,
    deedOnFileCount,
    deedRegisterOnFileCount,
    loadDeedRegistryReview,
    updateDeedReviewFilter,
    applyDeedReviewFilters,
    loadDeedCases,
    selectDeedCase,
    startNewDeedCase,
    saveDeedCase,
    selectDeedAction,
    startNewDeedAction,
    saveDeedAction,
    attachEntryToSelectedDeedCase,
    openDeedReviewTab
  } = useDeedAdministration({ setError, setMessage, setActiveTab });

  const {
    northHillsOcrReview,
    northHillsReviewFilters,
    setNorthHillsReviewFilters,
    editingNorthHillsEntryId,
    focusedNorthHillsEntryId,
    northHillsEntryForm,
    selectedNorthHillsEntryIds,
    setSelectedNorthHillsEntryIds,
    isLoadingNorthHillsReview,
    savingEvidenceKey,
    selectedNorthHillsBatch,
    selectedNorthHillsEntries,
    visibleNorthHillsEntryIds,
    nextUnresolvedNorthHillsEntry,
    loadNorthHillsOcrReview,
    updateNorthHillsReviewFilter,
    applyNorthHillsReviewFilters,
    toggleNorthHillsEntrySelection,
    toggleVisibleNorthHillsEntries,
    openNorthHillsReviewTab,
    openNorthHillsReviewQueue,
    goToNextUnresolvedNorthHillsEntry,
    startNorthHillsEntryEdit,
    cancelNorthHillsEntryEdit,
    updateNorthHillsEntryForm,
    updateNorthHillsSourceFactForm,
    updateNorthHillsObservationForm,
    saveNorthHillsEntryEdit,
    saveNorthHillsEvidence,
    unlinkNorthHillsEvidence,
    saveNorthHillsSourceFactReview,
    promoteNorthHillsDeathDate
  } = useNorthHillsAdministration({ setError, setActiveTab, setMessage, scrollAdminItemIntoView });

  const {
    sourcePersonReview,
    sourcePersonFilters,
    setSourcePersonFilters,
    selectedSourcePersonRecordId,
    focusedSourcePersonRecordId,
    sourcePersonForm,
    isLoadingSourcePersonRecords,
    savingSourcePersonKey,
    selectedSourcePersonRecord,
    nextUnresolvedSourcePersonRecord,
    loadSourcePersonRecords,
    updateSourcePersonFilter,
    applySourcePersonFilters,
    openSourcePeopleTab,
    openSourcePeopleReviewQueue,
    goToNextUnresolvedSourcePersonRecord,
    startNewSourcePersonRecord,
    startSourcePersonRecordEdit,
    updateSourcePersonForm,
    saveSourcePersonRecord,
    softDeleteSourcePersonRecord
  } = useSourcePeopleAdministration({ setError, setActiveTab, setMessage, scrollAdminItemIntoView });

  const {
    lookupRecords,
    selectedLookupTable,
    setSelectedLookupTable,
    showInactiveLookups,
    setShowInactiveLookups,
    newLookupRecord,
    setNewLookupRecord,
    isLoadingLookups,
    savingLookupKey,
    recentlyMovedLookupIds,
    selectedLookupDefinition,
    selectedLookupRows,
    duplicateLookupSortOrders,
    loadLookupRecords,
    openLookupsTab,
    updateLocalLookupRecord,
    saveLookupRecord,
    moveLookupRecord,
    viewLookupAudit,
    addLookupRecord
  } = useLookupAdministration({ setError, setActiveTab, setMessage, setAuditSeedFilters });

  const {
    headstoneLookups,
    savingBulkKey,
    bulkMarkerIdentifiers,
    setBulkMarkerIdentifiers,
    bulkMarkerTypeId,
    setBulkMarkerTypeId,
    bulkMarkerMaterialId,
    setBulkMarkerMaterialId,
    bulkMarkerConditionId,
    setBulkMarkerConditionId,
    bulkGravesiteIdentifiers,
    setBulkGravesiteIdentifiers,
    bulkLotId,
    setBulkLotId,
    bulkNorthHillsNote,
    setBulkNorthHillsNote,
    bulkReason,
    setBulkReason,
    openBulkToolsTab,
    saveBulkHeadstoneUpdate,
    saveBulkGravesiteLotAssignment,
    markSelectedNorthHillsReviewed,
    addNoteToSelectedNorthHillsEntries
  } = useBulkAdministration({
    setError,
    setActiveTab,
    setMessage,
    selectedNorthHillsEntryIds,
    setSelectedNorthHillsEntryIds,
    loadNorthHillsOcrReview,
    northHillsReviewFilters
  });

  return (
    <Modal className="admin-panel" label="Admin management" onClose={onClose}>
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Administration</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close admin panel" title="Close the admin panel.">
          <X size={18} />
        </button>
      </div>

      {isLoading ? <div className="admin-message" role="status">Loading admin records...</div> : null}
      {error ? <div className="admin-message is-error" role="alert">{error}</div> : null}
      {message ? <div className="admin-message" role="status">{message}</div> : null}

      <div className="admin-workspace">
        <nav className="admin-nav" aria-label="Admin sections">
          {canManageUsers ? <button
            type="button"
            aria-current={activeTab === "users" ? "page" : undefined}
            className={activeTab === "users" ? "is-active" : undefined}
            onClick={() => setActiveTab("users")}
            title="Manage application users and role assignments."
          >
            <UserCog size={16} aria-hidden="true" />
            <span>Users</span>
          </button> : null}
          <button
            type="button"
            aria-current={activeTab === "records" ? "page" : undefined}
            className={activeTab === "records" ? "is-active" : undefined}
            onClick={() => setActiveTab("records")}
            title="Edit cemetery, section, and lot text records."
          >
            <Landmark size={16} aria-hidden="true" />
            <span>Records</span>
          </button>
          <button
            type="button"
            aria-current={activeTab === "quality" ? "page" : undefined}
            className={activeTab === "quality" ? "is-active" : undefined}
            onClick={() => setActiveTab("quality")}
            title="Review data cleanup counts for readings, map links, burials, photos, and maintenance."
          >
            <ShieldAlert size={16} aria-hidden="true" />
            <span>Quality</span>
          </button>
          {canUseBulkTools ? <button
            type="button"
            aria-current={activeTab === "bulk" ? "page" : undefined}
            className={activeTab === "bulk" ? "is-active" : undefined}
            onClick={openBulkToolsTab}
            title="Apply carefully scoped updates to selected markers, gravesites, and NHG readings."
          >
            <ListChecks size={16} aria-hidden="true" />
            <span>Bulk</span>
          </button> : null}
          {canUseSystemAdminTabs ? <button
            type="button"
            aria-current={activeTab === "lookups" ? "page" : undefined}
            className={activeTab === "lookups" ? "is-active" : undefined}
            onClick={openLookupsTab}
            title="Maintain lookup values for statuses, marker types, materials, and ownership event types."
          >
            <ListChecks size={16} aria-hidden="true" />
            <span>Lookups</span>
          </button> : null}
          {canUseSystemAdminTabs ? <button
            type="button"
            aria-current={activeTab === "deeds" ? "page" : undefined}
            className={activeTab === "deeds" ? "is-active" : undefined}
            onClick={openDeedReviewTab}
            title="Review staged deed registry imports before promotion."
          >
            <FileSearch size={16} aria-hidden="true" />
            <span>Deeds</span>
          </button> : null}
          {canUseSystemAdminTabs ? <button
            type="button"
            aria-current={activeTab === "readings" ? "page" : undefined}
            className={activeTab === "readings" ? "is-active" : undefined}
            onClick={openNorthHillsReviewTab}
            title="Review staged North Hills Genealogists OCR readings against existing burials."
          >
            <FileText size={16} aria-hidden="true" />
            <span>Readings</span>
          </button> : null}
          {canUseSourcePersonTab ? <button
            type="button"
            aria-current={activeTab === "sourcePeople" ? "page" : undefined}
            className={activeTab === "sourcePeople" ? "is-active" : undefined}
            onClick={openSourcePeopleTab}
            title="Enter and review source-only people from church records, family history, and other source notes."
          >
            <BookOpenText size={16} aria-hidden="true" />
            <span>Source People</span>
          </button> : null}
          {canUseSystemAdminTabs ? <button
            type="button"
            aria-current={activeTab === "audit" ? "page" : undefined}
            className={activeTab === "audit" ? "is-active" : undefined}
            onClick={openAuditTab}
            title="Review create, update, delete, and restore audit events."
          >
            <History size={16} aria-hidden="true" />
            <span>Audit</span>
          </button> : null}
          {canUseSystemAdminTabs ? <button
            type="button"
            aria-current={activeTab === "system" ? "page" : undefined}
            className={activeTab === "system" ? "is-active" : undefined}
            onClick={openSystemTab}
            title="Review API errors, scheduled job runs, health checks, and integration failures."
          >
            <Activity size={16} aria-hidden="true" />
            <span>System</span>
          </button> : null}
        </nav>

        <div className="admin-content">
          <Suspense fallback={<p className="admin-message">Loading admin workflow…</p>}>
            {activeTab === "users" && canManageUsers ? (
              <UsersAdminTab cemeteryRecords={cemeteryRecords} />
            ) : activeTab === "records" ? (
              <RecordsAdminTab
                cemeteryRecords={cemeteryRecords}
                selectedCemeteryId={selectedCemeteryId}
                selectedSectionId={selectedSectionId}
                selectedLotId={selectedLotId}
                selectedCemetery={selectedCemetery}
                selectedSection={selectedSection}
                selectedLot={selectedLot}
                sectionsForSelectedCemetery={sectionsForSelectedCemetery}
                lotsForSelectedSection={lotsForSelectedSection}
                canEditSelectedCemetery={canEditSelectedCemetery}
                savingRecordKey={savingRecordKey}
                selectCemeteryById={selectCemeteryById}
                selectSectionById={selectSectionById}
                selectLotById={selectLotById}
                updateCemeteryRecord={updateCemeteryRecord}
                updateSectionRecord={updateSectionRecord}
                updateLotRecord={updateLotRecord}
                saveCemeteryRecord={saveCemeteryRecord}
                saveSectionRecord={saveSectionRecord}
                saveLotRecord={saveLotRecord}
              />
            ) : activeTab === "quality" ? (
              <DataQualityAdminTab onError={setError} onOpenReviewTarget={openDataQualityReviewTarget} />
            ) : activeTab === "bulk" && canUseBulkTools ? (
              <BulkAdminTab
                reason={bulkReason} setReason={setBulkReason}
                markerIdentifiers={bulkMarkerIdentifiers} setMarkerIdentifiers={setBulkMarkerIdentifiers}
                markerTypeId={bulkMarkerTypeId} setMarkerTypeId={setBulkMarkerTypeId}
                markerMaterialId={bulkMarkerMaterialId} setMarkerMaterialId={setBulkMarkerMaterialId}
                markerConditionId={bulkMarkerConditionId} setMarkerConditionId={setBulkMarkerConditionId}
                gravesiteIdentifiers={bulkGravesiteIdentifiers} setGravesiteIdentifiers={setBulkGravesiteIdentifiers}
                lotId={bulkLotId} setLotId={setBulkLotId}
                northHillsNote={bulkNorthHillsNote} setNorthHillsNote={setBulkNorthHillsNote}
                selectedNorthHillsCount={selectedNorthHillsEntries.length} savingKey={savingBulkKey}
                lookups={headstoneLookups} cemeteryRecords={cemeteryRecords}
                onSaveMarkers={(event) => void saveBulkHeadstoneUpdate(event)}
                onAssignLot={(event) => void saveBulkGravesiteLotAssignment(event)}
                onMarkReadingsReviewed={() => void markSelectedNorthHillsReviewed()}
                onAddReadingNote={() => void addNoteToSelectedNorthHillsEntries()}
                onOpenReadings={openNorthHillsReviewTab}
              />
            ) : activeTab === "lookups" ? (<LookupAdminTab
              selectedLookupTable={selectedLookupTable}
              setSelectedLookupTable={setSelectedLookupTable}
              lookupRecords={lookupRecords}
              loadLookupRecords={loadLookupRecords}
              isLoadingLookups={isLoadingLookups}
              showInactiveLookups={showInactiveLookups}
              setShowInactiveLookups={setShowInactiveLookups}
              selectedLookupDefinition={selectedLookupDefinition}
              selectedLookupRows={selectedLookupRows}
              duplicateLookupSortOrders={duplicateLookupSortOrders}
              savingLookupKey={savingLookupKey}
              recentlyMovedLookupIds={recentlyMovedLookupIds}
              updateLocalLookupRecord={updateLocalLookupRecord}
              moveLookupRecord={moveLookupRecord}
              viewLookupAudit={viewLookupAudit}
              saveLookupRecord={saveLookupRecord}
              newLookupRecord={newLookupRecord}
              setNewLookupRecord={setNewLookupRecord}
              addLookupRecord={addLookupRecord}
            />) : activeTab === "deeds" ? (
              <DeedsAdminTab
                deedCaseFilters={deedCaseFilters}
                setDeedCaseFilters={setDeedCaseFilters}
                isLoadingDeedCases={isLoadingDeedCases}
                loadDeedCases={loadDeedCases}
                startNewDeedCase={startNewDeedCase}
                deedCases={deedCases}
                selectedDeedCaseId={selectedDeedCaseId}
                selectDeedCase={selectDeedCase}
                deedCaseForm={deedCaseForm}
                setDeedCaseForm={setDeedCaseForm}
                selectedDeedCase={selectedDeedCase}
                savingDeedCaseKey={savingDeedCaseKey}
                saveDeedCase={saveDeedCase}
                startNewDeedAction={startNewDeedAction}
                selectedDeedActionId={selectedDeedActionId}
                selectDeedAction={selectDeedAction}
                deedActionForm={deedActionForm}
                setDeedActionForm={setDeedActionForm}
                savingDeedActionKey={savingDeedActionKey}
                saveDeedAction={saveDeedAction}
                deedReviewFilters={deedReviewFilters}
                updateDeedReviewFilter={updateDeedReviewFilter}
                deedRegistryReview={deedRegistryReview}
                applyDeedReviewFilters={applyDeedReviewFilters}
                isLoadingDeedReview={isLoadingDeedReview}
                setDeedReviewFilters={setDeedReviewFilters}
                loadDeedRegistryReview={loadDeedRegistryReview}
                selectedDeedBatch={selectedDeedBatch}
                deedResearchTerms={deedResearchTerms}
                deedInvestigationOwners={deedInvestigationOwners}
                deedInvestigationLots={deedInvestigationLots}
                deedOnFileCount={deedOnFileCount}
                deedRegisterOnFileCount={deedRegisterOnFileCount}
                deedInvestigationNoteCount={deedInvestigationNoteCount}
                attachEntryToSelectedDeedCase={attachEntryToSelectedDeedCase}
                removedOriginalDeedEntries={removedOriginalDeedEntries}
              />
            ) : activeTab === "sourcePeople" ? (<SourcePeopleAdminTab
              applySourcePersonFilters={applySourcePersonFilters}
              sourcePersonFilters={sourcePersonFilters}
              updateSourcePersonFilter={updateSourcePersonFilter}
              sourcePersonReview={sourcePersonReview}
              isLoadingSourcePersonRecords={isLoadingSourcePersonRecords}
              setSourcePersonFilters={setSourcePersonFilters}
              loadSourcePersonRecords={loadSourcePersonRecords}
              startNewSourcePersonRecord={startNewSourcePersonRecord}
              nextUnresolvedSourcePersonRecord={nextUnresolvedSourcePersonRecord}
              goToNextUnresolvedSourcePersonRecord={goToNextUnresolvedSourcePersonRecord}
              selectedSourcePersonRecordId={selectedSourcePersonRecordId}
              focusedSourcePersonRecordId={focusedSourcePersonRecordId}
              startSourcePersonRecordEdit={startSourcePersonRecordEdit}
              saveSourcePersonRecord={saveSourcePersonRecord}
              selectedSourcePersonRecord={selectedSourcePersonRecord}
              sourcePersonForm={sourcePersonForm}
              updateSourcePersonForm={updateSourcePersonForm}
              savingSourcePersonKey={savingSourcePersonKey}
              softDeleteSourcePersonRecord={softDeleteSourcePersonRecord}
            />) : activeTab === "readings" ? (<NorthHillsAdminTab
              applyNorthHillsReviewFilters={applyNorthHillsReviewFilters}
              northHillsReviewFilters={northHillsReviewFilters}
              updateNorthHillsReviewFilter={updateNorthHillsReviewFilter}
              northHillsOcrReview={northHillsOcrReview}
              isLoadingNorthHillsReview={isLoadingNorthHillsReview}
              setNorthHillsReviewFilters={setNorthHillsReviewFilters}
              loadNorthHillsOcrReview={loadNorthHillsOcrReview}
              selectedNorthHillsBatch={selectedNorthHillsBatch}
              nextUnresolvedNorthHillsEntry={nextUnresolvedNorthHillsEntry}
              goToNextUnresolvedNorthHillsEntry={goToNextUnresolvedNorthHillsEntry}
              canEditNorthHillsEntries={canEditNorthHillsEntries}
              visibleNorthHillsEntryIds={visibleNorthHillsEntryIds}
              selectedNorthHillsEntryIds={selectedNorthHillsEntryIds}
              toggleVisibleNorthHillsEntries={toggleVisibleNorthHillsEntries}
              selectedNorthHillsEntries={selectedNorthHillsEntries}
              markSelectedNorthHillsReviewed={markSelectedNorthHillsReviewed}
              savingBulkKey={savingBulkKey}
              openBulkToolsTab={openBulkToolsTab}
              focusedNorthHillsEntryId={focusedNorthHillsEntryId}
              toggleNorthHillsEntrySelection={toggleNorthHillsEntrySelection}
              startNorthHillsEntryEdit={startNorthHillsEntryEdit}
              savingEvidenceKey={savingEvidenceKey}
              editingNorthHillsEntryId={editingNorthHillsEntryId}
              northHillsEntryForm={northHillsEntryForm}
              saveNorthHillsEntryEdit={saveNorthHillsEntryEdit}
              updateNorthHillsEntryForm={updateNorthHillsEntryForm}
              updateNorthHillsSourceFactForm={updateNorthHillsSourceFactForm}
              updateNorthHillsObservationForm={updateNorthHillsObservationForm}
              cancelNorthHillsEntryEdit={cancelNorthHillsEntryEdit}
              saveNorthHillsSourceFactReview={saveNorthHillsSourceFactReview}
              promoteNorthHillsDeathDate={promoteNorthHillsDeathDate}
              saveNorthHillsEvidence={saveNorthHillsEvidence}
              canUnlinkNorthHillsEvidence={canUnlinkNorthHillsEvidence}
              unlinkNorthHillsEvidence={unlinkNorthHillsEvidence}
            />) : activeTab === "system" ? (
              <SystemEventsAdminTab onError={setError} onMessage={setMessage} />
            ) : (
              <AuditAdminTab seedFilters={auditSeedFilters} onError={setError} onMessage={setMessage} />
            )}
          </Suspense>
        </div>
      </div>
    </Modal>
  );
}
