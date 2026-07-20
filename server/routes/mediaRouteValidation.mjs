import { optionalText, validateUuid } from "../inputValidation.mjs";
import { BadRequestError } from "../requestValidation.mjs";

export function validateMediaUploadMetadata(query) {
  const source = optionalText(query?.source, "Photo source", 50) || "field_upload";
  if (!["iphone", "admin_upload", "field_upload", "import", "other"].includes(source)) throw new BadRequestError("Photo source is invalid.");
  return {
    originalFilename: optionalText(query?.filename, "Filename", 255),
    headstoneId: query?.headstoneId ? validateUuid(query.headstoneId, "Headstone id") : "",
    notes: optionalText(query?.notes, "Photo notes", 4000),
    latitude: optionalText(query?.latitude, "Latitude", 30),
    longitude: optionalText(query?.longitude, "Longitude", 30),
    gpsAccuracy: optionalText(query?.gpsAccuracy, "GPS accuracy", 30),
    capturedAt: optionalText(query?.capturedAt, "Captured at", 40),
    deviceMake: optionalText(query?.deviceMake, "Device make", 100),
    deviceModel: optionalText(query?.deviceModel, "Device model", 100),
    source,
  };
}
