export const auditActionLabels: Record<string, string> = {
  create: "Created", update: "Updated", soft_delete: "Deleted", restore: "Restored", delete: "Hard deleted", import_promote: "Imported",
};

export const auditTableLabels: Record<string, string> = {
  app_roles: "Roles", app_users: "Users", app_user_cemetery_access: "User cemetery assignments", audit_retention_policies: "Audit retention policies",
  blocks: "Blocks", burials: "Burials", burial_interment_types: "Burial interment types", burial_record_status_types: "Burial record statuses",
  cemeteries: "Cemeteries", deed_registry_entries: "Deed registry entries", deed_registry_entry_allocations: "Deed registry allocations", deed_registry_import_batches: "Deed registry imports",
  deed_investigation_case_entries: "Deed investigation evidence", deed_investigation_case_actions: "Deed investigation actions", deed_investigation_cases: "Deed investigation cases",
  grave_feature_material_types: "Grave feature materials", grave_feature_placement_types: "Grave feature placements", grave_feature_subtypes: "Grave feature subtypes", grave_feature_types: "Grave feature types", grave_features: "Grave features",
  gravesites: "Gravesites", gravesite_status_types: "Gravesite statuses", headstone_burials: "Headstone burials", headstone_condition_types: "Headstone conditions", headstone_gravesites: "Headstone gravesites", headstone_relationships: "Headstone relationships", headstones: "Headstones",
  lot_owner_parties: "Lot owners", lot_ownership_event_types: "Lot ownership events", lots: "Lots", marker_material_types: "Marker materials", marker_types: "Marker types",
  maintenance_action_types: "Maintenance action types", maintenance_issue_types: "Maintenance issue types", maintenance_priority_types: "Maintenance priorities", maintenance_records: "Maintenance records",
  military_branch_types: "Military branches", military_rank_types: "Military ranks", military_war_service_types: "Military war service", memorials: "Memorials",
  north_hills_ocr_source_facts: "North Hills source facts", north_hills_ocr_entries: "North Hills OCR readings", north_hills_ocr_entry_gravesite_links: "North Hills gravesite evidence links", north_hills_ocr_entry_headstone_links: "North Hills headstone evidence links", north_hills_ocr_import_batches: "North Hills OCR imports",
  owners: "Owners", sections: "Sections", source_person_record_links: "Source person record links", source_person_records: "Source person records", system_event_retention_policies: "System event retention policies",
};

export const systemEventTypeLabels: Record<string, string> = {
  error: "Error", warning: "Warning", job_run: "Job run", health_check: "Health check", integration_failure: "Integration failure",
};

export const systemEventSeverityLabels: Record<string, string> = { info: "Info", warning: "Warning", error: "Error", critical: "Critical" };

export const systemEventStatusLabels: Record<string, string> = {
  started: "Started", succeeded: "Succeeded", failed: "Failed", degraded: "Degraded", reported: "Reported", resolved: "Resolved",
};
