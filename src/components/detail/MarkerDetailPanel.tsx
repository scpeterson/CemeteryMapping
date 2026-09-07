import { Flag, History, Landmark, Link2, MapPinned } from "lucide-react";
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
import { MaintenanceRecordForm, MaintenanceRecordList } from "./MaintenanceRecords";
import { MarkerGravesiteRelationshipManager } from "./MarkerGravesiteRecords";
import { MarkerRelationshipForm, MarkerRelationshipList } from "./MarkerRelationshipRecords";

export function MarkerDetailPanel({
  summary,
  headstone,
  markerGraves,
  canUpdateHeadstones,
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
  summary: HeadstoneSummary;
  headstone?: Headstone;
  markerGraves: GraveSpaceSummary[];
  canUpdateHeadstones: boolean;
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
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
  canDeleteGraveFeatures: boolean;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const isMonolith = headstone?.markerScope.code === "monolith";
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

      {!headstone || error ? null : (
        <section className="detail-section">
          <div className="section-title">
            <Landmark size={17} aria-hidden="true" />
            <h3>{isMonolith ? "Monolith Marker" : "Marker"}</h3>
          </div>
          <div className="headstone-list">
            <HeadstoneRecord
              headstone={headstone}
              lookups={headstoneLookups}
              canUpdate={canUpdateHeadstones}
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
            />
          </div>
        </section>
      )}

      {!headstone || error || !canUpdateHeadstones ? null : (
        <section className="detail-section">
          <div className="section-title">
            <Flag size={17} aria-hidden="true" />
            <h3>Marker Features</h3>
          </div>
          <GraveFeatureForm headstones={[headstone]} fixedHeadstone={headstone} lookups={headstoneLookups} onSave={onSaveGraveFeature} />
        </section>
      )}

      {!headstone || error ? null : (
        <section className="detail-section">
          <div className="section-title">
            <Link2 size={17} aria-hidden="true" />
            <h3>{isMonolith ? "Regular Markers Linked to This Monolith" : "Related Markers"}</h3>
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

      {!headstone || error ? null : (
        <section className="detail-section">
          <div className="section-title">
            <History size={17} aria-hidden="true" />
            <h3>Maintenance</h3>
          </div>
          <MaintenanceRecordList
            records={headstone.maintenanceRecords ?? []}
            canUpdate={canUpdateHeadstones}
            lookups={headstoneLookups}
            fixedHeadstone={headstone}
            onUpdate={onUpdateMaintenanceRecord}
          />
          {canUpdateHeadstones ? <MaintenanceRecordForm fixedHeadstone={headstone} lookups={headstoneLookups} onSave={onSaveMaintenanceRecord} /> : null}
        </section>
      )}

      {error ? null : (
        <section className="detail-section">
          <div className="section-title">
            <MapPinned size={17} aria-hidden="true" />
            <h3>{isMonolith ? "Gravesites Spanned by This Monolith" : "Associated Gravesites"}</h3>
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
    </aside>
  );
}
