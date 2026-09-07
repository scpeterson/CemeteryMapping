import { FileText, Flag, History, Images, Landmark, MapPinned, UserRound } from "lucide-react";
import { useState } from "react";
import { formatDate, formatGraveLabel } from "../../lib/format";
import type {
  Burial,
  CemeteryLot,
  GraveFeature,
  GraveSpace,
  GraveSpaceSummary,
  Headstone,
  HeadstoneLookups,
  HeadstoneSummary,
  MaintenanceRecord,
  MediaAsset,
  NorthHillsLinkedEvidence,
  Owner,
  SaveBurialInput,
  SaveGraveFeatureInput,
  SaveGraveSpaceInput,
  SaveHeadstoneCreateInput,
  SaveHeadstoneInput,
  SaveMaintenanceRecordInput,
  SaveOwnershipEventInput,
  UpdateOwnerInput
} from "../../types";
import { BurialRecord } from "./BurialRecord";
import { CreateHeadstoneForm } from "./CreateHeadstoneForm";
import { GraveGeometryMetadata } from "./DetailGeometry";
import { inferredLotForGrave } from "./lotInference";
import { GraveFeatureForm, GraveFeatureList } from "./GraveFeatureRecords";
import { GraveSpaceRecord } from "./GraveSpaceRecord";
import { HeadstoneRecord } from "./HeadstoneRecord";
import { MaintenanceRecordForm, MaintenanceRecordList } from "./MaintenanceRecords";
import { MediaGallery, PhotoUploadForm } from "./MediaRecords";
import { NorthHillsEvidenceList } from "./NorthHillsEvidenceList";
import { OwnerRecord, OwnershipEventForm } from "./OwnershipRecords";
import { PickedMarkerPoint } from "./detailTypes";

const ownerName = (ownersById: Map<string, Owner>, ownerId: string) => ownersById.get(ownerId)?.displayName ?? "Unknown owner";

export function GraveDetailPanel({
  ownersById,
  summary,
  grave,
  cemeteryGraves,
  cemeteryLots,
  cemeteryHeadstones,
  headstones,
  northHillsEvidence,
  mediaAssets,
  canViewOwnership,
  canUpdateGravesites,
  canManageLotAssignment,
  canUpdateBurials,
  canUpdateHeadstones,
  headstoneLookups,
  pickedMarkerPoint,
  isPickingMarkerPoint,
  onSaveGraveSpace,
  onSaveBurial,
  onSaveHeadstone,
  onCreateHeadstone,
  onSaveGraveFeature,
  onUpdateGraveFeature,
  onDeleteGraveFeature,
  onSaveMaintenanceRecord,
  onUpdateMaintenanceRecord,
  onSaveOwnershipEvent,
  onUpdateOwner,
  onRemoveOwnershipConnection,
  onUpdateGraveLot,
  onUploadPhoto,
  onDeletePhoto,
  onMovePhoto,
  onStartMarkerPointPick,
  onCancelMarkerPointPick,
  canDeleteGraveFeatures,
  canDeletePhotos,
  canReorderPhotos,
  isLoading,
  error,
  onRetry,
}: {
  ownersById: Map<string, Owner>;
  summary: GraveSpaceSummary;
  grave?: GraveSpace;
  cemeteryGraves: GraveSpaceSummary[];
  cemeteryLots: CemeteryLot[];
  cemeteryHeadstones: HeadstoneSummary[];
  headstones: Headstone[];
  northHillsEvidence: NorthHillsLinkedEvidence[];
  mediaAssets: MediaAsset[];
  canViewOwnership: boolean;
  canUpdateGravesites: boolean;
  canManageLotAssignment: boolean;
  canUpdateBurials: boolean;
  canUpdateHeadstones: boolean;
  headstoneLookups: HeadstoneLookups;
  pickedMarkerPoint?: PickedMarkerPoint;
  isPickingMarkerPoint: boolean;
  onSaveGraveSpace: (graveSpace: SaveGraveSpaceInput) => Promise<GraveSpace>;
  onSaveBurial: (id: string, burial: SaveBurialInput) => Promise<Burial>;
  onSaveHeadstone: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  onCreateHeadstone: (grave: GraveSpace, headstone: SaveHeadstoneCreateInput) => Promise<Headstone>;
  onSaveGraveFeature: (feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onUpdateGraveFeature: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onDeleteGraveFeature: (id: string, reason?: string) => Promise<void>;
  onSaveMaintenanceRecord: (record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onUpdateMaintenanceRecord: (id: string, record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onSaveOwnershipEvent: (event: SaveOwnershipEventInput) => Promise<void>;
  onUpdateOwner: (partyId: string, eventId: string, owner: UpdateOwnerInput) => Promise<void>;
  onRemoveOwnershipConnection: (rightId: string) => Promise<void>;
  onUpdateGraveLot: (lotId: string) => Promise<void>;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
  onStartMarkerPointPick: () => void;
  onCancelMarkerPointPick: () => void;
  canDeleteGraveFeatures: boolean;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const title = formatGraveLabel(summary);
  const [activeTab, setActiveTab] = useState<"overview" | "people" | "monuments" | "records" | "location">("overview");

  const inferredLot = grave ? inferredLotForGrave(grave, cemeteryLots, cemeteryHeadstones) : undefined;
  const detailTabs: { id: "overview" | "people" | "monuments" | "records" | "location"; label: string; description: string; count?: number }[] = grave ? [
    { id: "overview", label: "Overview", description: "Overview" },
    { id: "people", label: "People", description: "People and ownership", count: grave.burials.length + (canViewOwnership ? grave.currentOwnerIds.length : 0) },
    { id: "monuments", label: "Monuments", description: "Monuments and photos", count: headstones.length + (grave.features?.length ?? 0) + mediaAssets.length },
    { id: "records", label: "Maint.", description: "Maintenance records and evidence", count: (grave.maintenanceRecords?.length ?? 0) + northHillsEvidence.length },
    { id: "location", label: "Location", description: "Location and geometry" },
  ] : [];

  return (
    <aside className="detail-panel">
      <div className="grave-title-row">
        <div>
          <p className="eyebrow">Grave site</p>
          <h2>{title}</h2>
          <p className="grave-record-id">Record ID: {summary.id}</p>
          <p className="grave-cemetery">{summary.cemeteryName}</p>
        </div>
      </div>

      {isLoading && !grave ? (
        <div className="detail-message" role="status">
          Loading grave details...
        </div>
      ) : null}

      {error ? (
        <div className="detail-message is-error" role="alert">
          <p>Unable to load grave details: {error}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {!grave || error ? null : (
        <>
          <div className="detail-tabs" role="tablist" aria-label="Gravesite details">
            {detailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`grave-detail-tab-${tab.id}`}
                aria-controls={`grave-detail-panel-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-label={tab.description}
                title={tab.description}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={activeTab === tab.id ? "is-active" : undefined}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const currentIndex = detailTabs.findIndex((candidate) => candidate.id === activeTab);
                  const nextIndex = event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? detailTabs.length - 1
                      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + detailTabs.length) % detailTabs.length;
                  setActiveTab(detailTabs[nextIndex].id);
                  document.getElementById(`grave-detail-tab-${detailTabs[nextIndex].id}`)?.focus();
                }}
              >
                <span>{tab.label}</span>
                {tab.count ? <span className="detail-tab-count" aria-label={`${tab.count} items`}>{tab.count}</span> : null}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`grave-detail-panel-${activeTab}`}
            aria-labelledby={`grave-detail-tab-${activeTab}`}
            className="detail-tab-panel"
          >
          {activeTab === "overview" ? <>
          <section className="detail-section">
            <div className="section-title">
              <MapPinned size={17} aria-hidden="true" />
              <h3>Gravesite</h3>
            </div>
            <GraveSpaceRecord grave={grave} lots={cemeteryLots} inferredLot={inferredLot} canUpdate={canUpdateGravesites} canManageLot={canManageLotAssignment} onSave={onSaveGraveSpace} onUpdateLot={onUpdateGraveLot} />
          </section>

          {grave.notes ? (
            <section className="detail-section">
              <div className="section-title">
                <FileText size={17} aria-hidden="true" />
                <h3>Notes</h3>
              </div>
              <p className="note-box">{grave.notes}</p>
            </section>
          ) : null}
          </> : null}

          {activeTab === "people" ? <>
          {canViewOwnership ? (
            <section className="detail-section">
              <div className="section-title">
                <Landmark size={17} aria-hidden="true" />
                <h3>Current Owner</h3>
              </div>
              <div className="owner-list">
                {grave.currentOwnerIds.length ? (
                  grave.currentOwnerIds.map((id, index) => {
                    const owner = ownersById.get(id);
                    const isFirstOwnerForRight = owner?.ownershipEventRightId
                      ? grave.currentOwnerIds.findIndex((candidateId) => ownersById.get(candidateId)?.ownershipEventRightId === owner.ownershipEventRightId) === index
                      : false;
                    return owner ? <OwnerRecord key={id} owner={owner} canUpdate={canUpdateGravesites} canRemove={canManageLotAssignment && isFirstOwnerForRight} onSave={onUpdateOwner} onRemove={onRemoveOwnershipConnection} /> : null;
                  })
                ) : (
                  <p className="muted">No current ownership is recorded.</p>
                )}
              </div>
              {canUpdateGravesites ? (
                <OwnershipEventForm grave={grave} cemeteryGraves={cemeteryGraves} onSave={onSaveOwnershipEvent} />
              ) : null}
            </section>
          ) : null}

          <section className="detail-section">
            <div className="section-title burial-section-title">
              <UserRound size={17} aria-hidden="true" />
              <h3>Burials</h3>
              <span className="burial-gravesite-id">Gravesite {title} · Record ID {summary.id}</span>
            </div>
            {grave.burials.length ? (
              <div className="burial-list">
                {grave.burials.map((burial) => (
                  <BurialRecord key={burial.id} burial={burial} canUpdate={canUpdateBurials} lookups={headstoneLookups} onSave={onSaveBurial} />
                ))}
              </div>
            ) : (
              <p className="muted">No burials are recorded for this grave site.</p>
            )}
          </section>

          {canViewOwnership ? (
            <section className="detail-section">
              <div className="section-title">
                <History size={17} aria-hidden="true" />
                <h3>Ownership Timeline</h3>
              </div>
              <ol className="timeline">
                {[...grave.ownershipHistory]
                  .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
                  .map((event) => (
                    <li key={event.id}>
                      <time>{formatDate(event.effectiveDate)}</time>
                      <strong>{event.eventType}</strong>
                      {event.fromOwnerNames.length ? (
                        <div className="ownership-transfer-flow">
                          <span><small>From</small>{event.fromOwnerNames.join(", ")}</span>
                          <span aria-hidden="true">→</span>
                          <span><small>To</small>{event.toOwnerNames.join(", ")}</span>
                        </div>
                      ) : <span>{event.ownerIds.map((id) => ownerName(ownersById, id)).join(", ")}</span>}
                      <small><span className="timeline-field-label">Recorded by</span>{event.recordedBy}</small>
                      {event.documentReference ? (
                        <span className="document-ref">
                          <FileText size={13} aria-hidden="true" />
                          {event.documentReference}
                        </span>
                      ) : null}
                      {event.notes ? <p>{event.notes}</p> : null}
                    </li>
                  ))}
              </ol>
            </section>
          ) : null}
          </> : null}

          {activeTab === "monuments" ? <>
          <section className="detail-section">
            <div className="section-title">
              <Landmark size={17} aria-hidden="true" />
              <h3>Markers</h3>
            </div>
            {headstones.length ? (
              <div className="headstone-list">
                {headstones.map((headstone) => (
                  <HeadstoneRecord
                    key={headstone.id}
                    headstone={headstone}
                    lookups={headstoneLookups}
                    canUpdate={canUpdateHeadstones}
                    onSave={onSaveHeadstone}
                    grave={grave}
                    cemeteryName={summary.cemeteryName}
                    sectionName={summary.section}
                    canDeletePhotos={canDeletePhotos}
                    canReorderPhotos={canReorderPhotos}
                    onDeletePhoto={onDeletePhoto}
                    onMovePhoto={onMovePhoto}
                    canUploadPhotos={canUpdateHeadstones}
                    onUploadPhoto={onUploadPhoto}
                    onUpdateGraveFeature={onUpdateGraveFeature}
                    onDeleteGraveFeature={onDeleteGraveFeature}
                    canDeleteGraveFeatures={canDeleteGraveFeatures}
                  />
                ))}
              </div>
            ) : (
              <p className="muted">No markers are recorded for this grave site.</p>
            )}
            {canUpdateHeadstones ? (
              <CreateHeadstoneForm
                grave={grave}
                headstones={headstones}
                lookups={headstoneLookups}
                sectionName={summary.section}
                pickedMarkerPoint={pickedMarkerPoint}
                isPickingMarkerPoint={isPickingMarkerPoint}
                onSave={(headstone) => onCreateHeadstone(grave, headstone)}
                onStartMarkerPointPick={onStartMarkerPointPick}
                onCancelMarkerPointPick={onCancelMarkerPointPick}
              />
            ) : null}
          </section>

          <section className="detail-section">
            <div className="section-title">
              <Flag size={17} aria-hidden="true" />
              <h3>Grave Features</h3>
            </div>
            <GraveFeatureList
              features={grave.features ?? []}
              canUpdate={canUpdateHeadstones}
              canDelete={canDeleteGraveFeatures}
              grave={grave}
              lookups={headstoneLookups}
              onUpdate={onUpdateGraveFeature}
              onDelete={onDeleteGraveFeature}
            />
            {canUpdateHeadstones ? <GraveFeatureForm grave={grave} headstones={headstones} lookups={headstoneLookups} onSave={onSaveGraveFeature} /> : null}
          </section>

          <section className="detail-section">
            <div className="section-title">
              <Images size={17} aria-hidden="true" />
              <h3>Gravesite Photos</h3>
            </div>
            <MediaGallery
              assets={mediaAssets}
              emptyMessage="No gravesite overview photos are linked yet."
              canDelete={canDeletePhotos}
              onDelete={onDeletePhoto}
              onMove={canReorderPhotos ? onMovePhoto : undefined}
            />
            {canUpdateHeadstones ? <PhotoUploadForm headstones={headstones} gravesiteOnly onUpload={onUploadPhoto} /> : null}
          </section>
          </> : null}

          {activeTab === "records" ? <>
          <section className="detail-section">
            <div className="section-title">
              <History size={17} aria-hidden="true" />
              <h3>Maintenance</h3>
            </div>
            <MaintenanceRecordList records={grave.maintenanceRecords ?? []} canUpdate={canUpdateGravesites} grave={grave} lookups={headstoneLookups} onUpdate={onUpdateMaintenanceRecord} />
            {canUpdateGravesites ? <MaintenanceRecordForm grave={grave} lookups={headstoneLookups} onSave={onSaveMaintenanceRecord} /> : null}
          </section>

          {northHillsEvidence.length ? (
            <section className="detail-section">
              <div className="section-title">
                <FileText size={17} aria-hidden="true" />
                <h3>North Hills Genealogical (NHG) Evidence</h3>
              </div>
              <NorthHillsEvidenceList evidence={northHillsEvidence} />
            </section>
          ) : null}
          </> : null}

          {activeTab === "location" ? (
          <section className="detail-section">
            <div className="section-title">
              <MapPinned size={17} aria-hidden="true" />
              <h3>Geometry</h3>
            </div>
            <GraveGeometryMetadata grave={grave} />
          </section>
          ) : null}
          </div>
        </>
      )}
    </aside>
  );
}
