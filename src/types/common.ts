export type AppRoleName = "reader" | "power-user" | "cemetery-admin" | "admin";

export type AreaGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

export type GeometryType = "evidence" | "operational" | "schematic";

export type GeometryConfidence = "gps" | "surveyed" | "reviewed" | "estimated" | "draft" | "unknown";

export type DataConfidence = "unknown" | "low" | "medium" | "high";

export type DataReviewStatus = "unreviewed" | "needs_review" | "reviewed" | "conflict";

export type AppVersion = {
  version: string;
  gitSha: string;
  buildTime: string;
  environment: string;
};

export type LookupOption = {
  id: string;
  code: string;
  label: string;
};
