import { MapPinned } from "lucide-react";
import { useMemo } from "react";
import type {
  Burial,
  CemeteryLot,
  GraveFeature,
  GraveSpace,
  GraveSpaceSummary,
  Headstone,
  HeadstoneLookups,
  HeadstoneSummary,
  LotRestrictedArea,
  MaintenanceRecord,
  MediaAsset,
  Owner,
  SaveBurialInput,
  SaveGraveFeatureInput,
  SaveGraveSpaceInput,
  SaveHeadstoneCreateInput,
  SaveHeadstoneGravesiteRelationshipInput,
  SaveHeadstoneInput,
  SaveHeadstoneRelationshipInput,
  SaveMaintenanceRecordInput,
  SaveOwnershipEventInput,
  UpdateOwnerInput
} from "../types";
import { GraveDetailPanel } from "./detail/GraveDetailPanel";
import { LotDetailPanel } from "./detail/LotDetailPanel";
import { MarkerDetailPanel } from "./detail/MarkerDetailPanel";
import { PickedMarkerPoint } from "./detail/detailTypes";

type DetailPanelProps = {
  owners: Owner[];
  summary?: GraveSpaceSummary;
  lot?: CemeteryLot;
  lotGraves?: GraveSpaceSummary[];
  cemeteryGraves?: GraveSpaceSummary[];
  cemeteryLots?: CemeteryLot[];
  cemeteryHeadstones?: HeadstoneSummary[];
  lotRestrictedAreas?: LotRestrictedArea[];
  grave?: GraveSpace;
  standaloneHeadstoneSummary?: HeadstoneSummary;
  standaloneHeadstone?: Headstone;
  markerGraves?: GraveSpaceSummary[];
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
  onSaveOwnershipEvent: (event: SaveOwnershipEventInput) => Promise<void>;
  onUpdateOwner: (partyId: string, eventId: string, owner: UpdateOwnerInput) => Promise<void>;
  onRemoveOwnershipConnection: (rightId: string) => Promise<void>;
  onUpdateGraveLot: (lotId: string) => Promise<void>;
  onSelectLotGrave: (grave: GraveSpaceSummary) => void;
  onSelectMarkerGrave: (grave: GraveSpaceSummary) => void;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
  onStartMarkerPointPick: () => void;
  onCancelMarkerPointPick: () => void;
  canDeleteGraveFeatures: boolean;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
};

function EmptyDetailPanel() {
  return (
    <aside className="detail-panel empty-state">
      <MapPinned size={28} aria-hidden="true" />
      <h2>Select a grave site, lot, or marker</h2>
      <p>Click a mapped grave space, lot, marker, or choose a search result to view cemetery records.</p>
    </aside>
  );
}

export function DetailPanel({
  owners,
  summary,
  lot,
  lotGraves = [],
  cemeteryGraves = [],
  cemeteryLots = [],
  cemeteryHeadstones = [],
  lotRestrictedAreas = [],
  grave,
  standaloneHeadstoneSummary,
  standaloneHeadstone,
  markerGraves = [],
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
  onSaveOwnershipEvent,
  onUpdateOwner,
  onRemoveOwnershipConnection,
  onUpdateGraveLot,
  onSelectLotGrave,
  onSelectMarkerGrave,
  onUploadPhoto,
  onDeletePhoto,
  onMovePhoto,
  onStartMarkerPointPick,
  onCancelMarkerPointPick,
  canDeleteGraveFeatures,
  canDeletePhotos,
  canReorderPhotos,
  isLoading = false,
  error,
  onRetry,
}: DetailPanelProps) {
  const ownersById = useMemo(
    () => new Map([...(grave?.owners ?? []), ...owners].map((owner) => [owner.id, owner])),
    [grave?.owners, owners],
  );
  const headstones = useMemo(() => grave?.headstones ?? [], [grave?.headstones]);
  const northHillsEvidence = grave?.northHillsEvidence ?? [];
  const headstoneMediaIds = useMemo(() => new Set(headstones.flatMap((headstone) => (headstone.mediaAssets ?? []).map((asset) => asset.id))), [headstones]);
  const mediaAssets = useMemo(() => (grave?.mediaAssets ?? []).filter((asset) => !headstoneMediaIds.has(asset.id)), [grave?.mediaAssets, headstoneMediaIds]);

  if (standaloneHeadstoneSummary) {
    return (
      <MarkerDetailPanel
        summary={standaloneHeadstoneSummary}
        headstone={standaloneHeadstone}
        markerGraves={markerGraves}
        canUpdateHeadstones={canUpdateHeadstones}
        headstoneLookups={headstoneLookups}
        onSaveHeadstone={onSaveHeadstone}
        onSaveHeadstoneRelationship={onSaveHeadstoneRelationship}
        onUpdateHeadstoneRelationship={onUpdateHeadstoneRelationship}
        onDeleteHeadstoneRelationship={onDeleteHeadstoneRelationship}
        onSaveHeadstoneGravesiteRelationship={onSaveHeadstoneGravesiteRelationship}
        onUpdateHeadstoneGravesiteRelationship={onUpdateHeadstoneGravesiteRelationship}
        onDeleteHeadstoneGravesiteRelationship={onDeleteHeadstoneGravesiteRelationship}
        onSaveGraveFeature={onSaveGraveFeature}
        onUpdateGraveFeature={onUpdateGraveFeature}
        onDeleteGraveFeature={onDeleteGraveFeature}
        onSaveMaintenanceRecord={onSaveMaintenanceRecord}
        onUpdateMaintenanceRecord={onUpdateMaintenanceRecord}
        onSelectMarkerGrave={onSelectMarkerGrave}
        onUploadPhoto={onUploadPhoto}
        onDeletePhoto={onDeletePhoto}
        onMovePhoto={onMovePhoto}
        canDeleteGraveFeatures={canDeleteGraveFeatures}
        canDeletePhotos={canDeletePhotos}
        canReorderPhotos={canReorderPhotos}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
      />
    );
  }

  if (lot) {
    return <LotDetailPanel lot={lot} graves={lotGraves} restrictedAreas={lotRestrictedAreas} onSelectGrave={onSelectLotGrave} />;
  }

  if (!summary) {
    return <EmptyDetailPanel />;
  }

  return (
    <GraveDetailPanel
      ownersById={ownersById}
      summary={summary}
      grave={grave}
      cemeteryGraves={cemeteryGraves}
      cemeteryLots={cemeteryLots}
      cemeteryHeadstones={cemeteryHeadstones}
      headstones={headstones}
      northHillsEvidence={northHillsEvidence}
      mediaAssets={mediaAssets}
      canViewOwnership={canViewOwnership}
      canUpdateGravesites={canUpdateGravesites}
      canManageLotAssignment={canManageLotAssignment}
      canUpdateBurials={canUpdateBurials}
      canUpdateHeadstones={canUpdateHeadstones}
      headstoneLookups={headstoneLookups}
      pickedMarkerPoint={pickedMarkerPoint}
      isPickingMarkerPoint={isPickingMarkerPoint}
      onSaveGraveSpace={onSaveGraveSpace}
      onSaveBurial={onSaveBurial}
      onSaveHeadstone={onSaveHeadstone}
      onCreateHeadstone={onCreateHeadstone}
      onSaveGraveFeature={onSaveGraveFeature}
      onUpdateGraveFeature={onUpdateGraveFeature}
      onDeleteGraveFeature={onDeleteGraveFeature}
      onSaveMaintenanceRecord={onSaveMaintenanceRecord}
      onUpdateMaintenanceRecord={onUpdateMaintenanceRecord}
      onSaveOwnershipEvent={onSaveOwnershipEvent}
      onUpdateOwner={onUpdateOwner}
      onRemoveOwnershipConnection={onRemoveOwnershipConnection}
      onUpdateGraveLot={onUpdateGraveLot}
      onUploadPhoto={onUploadPhoto}
      onDeletePhoto={onDeletePhoto}
      onMovePhoto={onMovePhoto}
      onStartMarkerPointPick={onStartMarkerPointPick}
      onCancelMarkerPointPick={onCancelMarkerPointPick}
      canDeleteGraveFeatures={canDeleteGraveFeatures}
      canDeletePhotos={canDeletePhotos}
      canReorderPhotos={canReorderPhotos}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
    />
  );
}
