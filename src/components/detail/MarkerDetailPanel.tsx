import { EditingOptionsContext } from "./editingOptionsContext";
import { PhotoGalleryContext } from "./photoGalleryContext";
import type { MarkerDetailAction } from "./markerWorkflowTypes";
import { useContext, useState } from "react";
import { DetailTabs } from "./DetailTabs";
import { MarkerOverview } from "./MarkerOverview";
import { Flag, Landmark, Link2, MapPinned } from "lucide-react";
import type {
  GraveFeature,
  GraveSpaceSummary,
  Headstone,
  HeadstoneLookups,
  HeadstoneSummary,
  MaintenanceRecord,
  MediaAsset,
  SaveGraveFeatureInput,
  SaveHeadstoneGravesiteRelationshipInput,
  SaveHeadstoneInput,
  SaveHeadstoneRelationshipInput,
  SaveMaintenanceRecordInput
} from "../../types";
import { GraveFeatureForm } from "./GraveFeatureRecords";
import { HeadstoneRecord } from "./HeadstoneRecord";
import { MarkerGravesiteRelationshipManager } from "./MarkerGravesiteRecords";
import { MarkerRelationshipForm, MarkerRelationshipList } from "./MarkerRelationshipRecords";

export function MarkerDetailPanel({
  canViewOwnership,
  summary,
  headstone,
  markerGraves,
  canUpdateHeadstones,
  canEditInspections,
  headstoneLookups,
  onSaveHeadstone,
  onSaveHeadstoneRelationship,
  onUpdateHeadstoneRelationship,
  onDeleteHeadstoneRelationship,
  onSaveHeadstoneGravesiteRelationship,
  onUpdateHeadstoneGravesiteRelationship,
  onDeleteHeadstoneGravesiteRelationship,
  onSaveGraveFeature,
  onUpdateGraveFeature,
  onDeleteGraveFeature,
  onSaveMaintenanceRecord,
  onUpdateMaintenanceRecord,
  onSelectMarkerGrave,
  onUploadPhoto,
  onDeletePhoto,
  onMovePhoto,
  canDeleteGraveFeatures,
  canDeletePhotos,
  canReorderPhotos,
  isLoading,
  error,
  onRetry,
}: {
  canViewOwnership: boolean;
  summary: HeadstoneSummary;
  headstone?: Headstone;
  markerGraves: GraveSpaceSummary[];
  canUpdateHeadstones: boolean;
  canEditInspections: boolean;
  headstoneLookups: HeadstoneLookups;
  onSaveHeadstone: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  onSaveHeadstoneRelationship: (headstoneId: string, relationship: SaveHeadstoneRelationshipInput) => Promise<Headstone>;
  onUpdateHeadstoneRelationship: (headstoneId: string, relationshipId: string, relationship: SaveHeadstoneRelationshipInput) => Promise<Headstone>;
  onDeleteHeadstoneRelationship: (headstoneId: string, relationshipId: string, reason?: string) => Promise<void>;
  onSaveHeadstoneGravesiteRelationship: (headstoneId: string, relationship: SaveHeadstoneGravesiteRelationshipInput) => Promise<Headstone>;
  onUpdateHeadstoneGravesiteRelationship: (headstoneId: string, relationshipId: string, relationship: SaveHeadstoneGravesiteRelationshipInput) => Promise<Headstone>;
  onDeleteHeadstoneGravesiteRelationship: (headstoneId: string, relationshipId: string, reason?: string) => Promise<void>;
  onSaveGraveFeature: (feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onUpdateGraveFeature: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onDeleteGraveFeature: (id: string, reason?: string) => Promise<void>;
  onSaveMaintenanceRecord: (record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onUpdateMaintenanceRecord: (id: string, record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onSelectMarkerGrave: (grave: GraveSpaceSummary) => void;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string; inspectionId?: string; maintenanceRecordId?: string; faceId?: string; phase?: "unspecified" | "before" | "during" | "after" }) => Promise<void>;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later" | "primary" | "automatic") => Promise<void>;
  canDeleteGraveFeatures: boolean;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "details">("overview");
  const [initialAction,setInitialAction]=useState<MarkerDetailAction>();
  const {open:openPhotos}=useContext(PhotoGalleryContext);
  const options=useContext(EditingOptionsContext);
  const showDetails=(action?:MarkerDetailAction)=>{setInitialAction(action);setActiveTab("details");if(!action)requestAnimationFrame(()=>document.getElementById("marker-detail-tab-details")?.focus());};
  const selectTab=(tab:"overview"|"details")=>{setInitialAction(undefined);setActiveTab(tab);};
  const editingUnavailable=options.loading||Boolean(options.error);
  const inspectionDisabled=editingUnavailable||!headstoneLookups.conditions.length;
  const informationDisabled=editingUnavailable||!headstoneLookups.markerTypes.length||!headstoneLookups.markerScopes.length||!headstoneLookups.materials.length;
  const maintenanceDisabled=editingUnavailable||!headstoneLookups.maintenancePriorities.length||(!headstoneLookups.maintenanceIssueTypes.length&&!headstoneLookups.maintenanceActionTypes.length);
  const missingActionOptions=(canEditInspections&&inspectionDisabled)||(canUpdateHeadstones&&(informationDisabled||maintenanceDisabled));
  const isMonolith = headstone?.markerScope.code === "monolith";
  const markerInformationContent = <>
      {!headstone || !canUpdateHeadstones ? null : (
        <section className="detail-section">
          <div className="section-title">
            <Flag size={17} aria-hidden="true" />
            <h4>Marker features</h4>
          </div>
          <GraveFeatureForm headstones={[headstone]} fixedHeadstone={headstone} lookups={headstoneLookups} onSave={onSaveGraveFeature} />
        </section>
      )}

      {!headstone || error ? null : (
        <section className="detail-section">
          <div className="section-title">
            <Link2 size={17} aria-hidden="true" />
            <h4>{isMonolith ? "Regular markers linked to this monolith" : "Related markers"}</h4>
          </div>
          <MarkerRelationshipList
            headstone={headstone}
            relationships={headstone.relationships ?? []}
            lookups={headstoneLookups}
            canUpdate={canUpdateHeadstones}
            onUpdate={(relationshipId, relationship) => onUpdateHeadstoneRelationship(headstone.id, relationshipId, relationship)}
            onDelete={(relationshipId, reason) => onDeleteHeadstoneRelationship(headstone.id, relationshipId, reason)}
          />
          {canUpdateHeadstones ? (
            <MarkerRelationshipForm headstone={headstone} lookups={headstoneLookups} onSave={(relationship) => onSaveHeadstoneRelationship(headstone.id, relationship)} />
          ) : null}
        </section>
      )}

      {error ? null : (
        <section className="detail-section">
          <div className="section-title">
            <MapPinned size={17} aria-hidden="true" />
            <h4>{isMonolith ? "Gravesites associated with this monolith" : "Associated gravesites"}</h4>
          </div>
          {headstone ? (
            <MarkerGravesiteRelationshipManager
              headstone={headstone}
              graves={markerGraves}
              lookups={headstoneLookups}
              canUpdate={canUpdateHeadstones}
              onSelectGrave={onSelectMarkerGrave}
              onSave={(relationship) => onSaveHeadstoneGravesiteRelationship(headstone.id, relationship)}
              onUpdate={(relationshipId, relationship) => onUpdateHeadstoneGravesiteRelationship(headstone.id, relationshipId, relationship)}
              onDelete={(relationshipId, reason) => onDeleteHeadstoneGravesiteRelationship(headstone.id, relationshipId, reason)}
            />
          ) : null}
        </section>
      )}
              </>;
  return (
    <aside className="detail-panel">
      <div className="grave-title-row">
        <div>
          <p className="eyebrow">Marker</p>
          <div className="marker-title-with-badge">
            <h2>{summary.headstoneId}</h2>
            {isMonolith ? <span className="monolith-badge">Monolith</span> : null}
          </div>
          <p className="grave-cemetery">{summary.cemeteryName}</p>
        </div>
      </div>

      {isMonolith ? (
        <div className="monolith-notice">
          <Landmark size={18} aria-hidden="true" />
          <div>
            <strong>Shared monolith marker</strong>
            <p>This marker does not represent a gravesite at its location. It is linked to the regular markers and gravesites listed below.</p>
          </div>
        </div>
      ) : null}

      {isLoading && !headstone ? (
        <div className="detail-message" role="status">
          Loading marker details...
        </div>
      ) : null}

      {error ? (
        <div className="detail-message is-error" role="alert">
          <p>Unable to load marker details: {error}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {headstone && !error ? <>
        <DetailTabs prefix="marker-detail" label="Marker details" tabs={[{ id: "overview", label: "Overview" }, { id: "details", label: "Details" }]} active={activeTab} onSelect={selectTab} />
        <div role="tabpanel" id={`marker-detail-panel-${activeTab}`} aria-labelledby={`marker-detail-tab-${activeTab}`} className="detail-tab-panel">
          {activeTab === "overview" ? <MarkerOverview marker={headstone} graves={markerGraves} canViewOwnership={canViewOwnership}
            onSelectGrave={onSelectMarkerGrave} onShowDetails={()=>showDetails()}
            onShowInspections={()=>showDetails("view-inspections")}
            onRecordInspection={canEditInspections?()=>showDetails("new-inspection"):undefined}
            onAddPhotos={canUpdateHeadstones?()=>openPhotos({headstone,mode:"upload"}):undefined}
            onRecordMaintenance={canUpdateHeadstones?()=>showDetails("new-maintenance"):undefined}
            onEditMarker={canUpdateHeadstones?()=>showDetails("edit-information"):undefined}
            inspectionDisabled={inspectionDisabled} informationDisabled={informationDisabled} maintenanceDisabled={maintenanceDisabled}
            editingNotice={options.loading?"Loading editing options…":options.error?"Editing options are unavailable.":missingActionOptions?"Some actions need additional editing options.":undefined}
            onRetryOptions={options.error?options.retry:undefined} /> : null}
          {activeTab === "details" ? <>
      {!headstone || error ? null : (
        <section className="detail-section">
          <div className="headstone-list">
            <HeadstoneRecord
              headstone={headstone}
              initialAction={initialAction}
              onInitialActionHandled={()=>setInitialAction(undefined)}
              lookups={headstoneLookups}
              canUpdate={canUpdateHeadstones}
              canEditInspections={canEditInspections}
              onSave={onSaveHeadstone}
              cemeteryName={summary.cemeteryName}
              sectionName=""
              canDeletePhotos={canDeletePhotos}
              canReorderPhotos={canReorderPhotos}
              onDeletePhoto={onDeletePhoto}
              onMovePhoto={onMovePhoto}
              canUploadPhotos={canUpdateHeadstones}
              onUploadPhoto={onUploadPhoto}
              onUpdateGraveFeature={onUpdateGraveFeature}
              onDeleteGraveFeature={onDeleteGraveFeature}
              canDeleteGraveFeatures={canDeleteGraveFeatures}
              onSaveMaintenanceRecord={onSaveMaintenanceRecord}
              onUpdateMaintenanceRecord={onUpdateMaintenanceRecord}
              markerInformationContent={markerInformationContent}
            />
          </div>
        </section>
      )}

          </> : null}
        </div>
      </> : null}
    </aside>
  );
}
