const defaultGeoNamesBaseUrl = "https://secure.geonames.org";

export class PlaceSearchUnavailableError extends Error {
  constructor(message = "Geographic search is temporarily unavailable.") {
    super(message);
    this.name = "PlaceSearchUnavailableError";
    this.statusCode = 503;
  }
}

function normalizedCandidate(place) {
  const providerId = String(place?.geonameId ?? "").trim();
  const locality = String(place?.name ?? "").trim();
  const administrativeArea = String(place?.adminName1 ?? "").trim();
  const countryName = String(place?.countryName ?? "").trim();
  const countryCode = String(place?.countryCode ?? "").trim().toUpperCase();
  const latitude = Number(place?.lat);
  const longitude = Number(place?.lng);
  if (!/^\d+$/u.test(providerId) || !locality || !countryName || !/^[A-Z]{2}$/u.test(countryCode)) return undefined;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return undefined;

  return {
    provider: "geonames",
    providerId,
    displayName: [locality, administrativeArea, countryName].filter(Boolean).join(", "),
    locality,
    administrativeArea,
    countryName,
    countryCode,
    featureClass: String(place?.fcl ?? "").trim(),
    featureCode: String(place?.fcode ?? "").trim(),
    latitude,
    longitude,
    authorityName: "GeoNames",
    authorityIdentifier: providerId,
    authorityUrl: `https://www.geonames.org/${providerId}/`,
  };
}

async function geoNamesRequest(config, path, parameters, { fetchFn = globalThis.fetch } = {}) {
  const username = String(config?.username ?? "").trim();
  if (!username) throw new PlaceSearchUnavailableError("Geographic search is not configured. Existing verified places remain available.");
  if (typeof fetchFn !== "function") throw new PlaceSearchUnavailableError();

  const baseUrl = String(config?.baseUrl ?? defaultGeoNamesBaseUrl).replace(/\/$/u, "");
  const url = new URL(`${baseUrl}/${path}`);
  for (const [key, value] of Object.entries({ ...parameters, username })) url.searchParams.set(key, String(value));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(config?.timeoutMs) || 5000);
  try {
    const response = await fetchFn(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response?.ok) throw new PlaceSearchUnavailableError();
    const payload = await response.json();
    if (payload?.status?.message) throw new PlaceSearchUnavailableError();
    return payload;
  } catch (error) {
    if (error instanceof PlaceSearchUnavailableError) throw error;
    throw new PlaceSearchUnavailableError();
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchGeoNames(config, query, options = {}) {
  const payload = await geoNamesRequest(
    config,
    "searchJSON",
    { q: query, maxRows: 10, featureClass: "P", style: "FULL" },
    options,
  );
  if (!Array.isArray(payload?.geonames)) throw new PlaceSearchUnavailableError();
  return payload.geonames.map(normalizedCandidate).filter(Boolean);
}

export async function getGeoNamesPlace(config, providerId, options = {}) {
  if (!/^\d+$/u.test(String(providerId ?? ""))) throw new Error("GeoNames place identifier is invalid.");
  const payload = await geoNamesRequest(config, "getJSON", { geonameId: providerId, style: "FULL" }, options);
  const candidate = normalizedCandidate(payload);
  if (!candidate) throw new PlaceSearchUnavailableError("The geographic service returned an invalid place record.");
  return candidate;
}
