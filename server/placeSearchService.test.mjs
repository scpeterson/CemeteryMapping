import assert from "node:assert/strict";
import test from "node:test";
import { getGeoNamesPlace, PlaceSearchUnavailableError, searchGeoNames } from "./placeSearchService.mjs";

const config = { username: "cemetery-test", baseUrl: "https://example.test", timeoutMs: 20 };
const jonesboro = {
  geonameId: 4116834,
  name: "Jonesboro",
  adminName1: "Arkansas",
  countryName: "United States",
  countryCode: "US",
  fcl: "P",
  fcode: "PPLA2",
  lat: "35.8423",
  lng: "-90.7043",
};

test("searchGeoNames normalizes verified geographic candidates", async () => {
  const results = await searchGeoNames(config, "Jonesboro Arkansas", {
    fetchFn: async (url) => {
      assert.equal(url.searchParams.get("username"), "cemetery-test");
      assert.equal(url.searchParams.get("featureClass"), "P");
      return { ok: true, json: async () => ({ geonames: [jonesboro] }) };
    },
  });
  assert.deepEqual(results[0], {
    provider: "geonames",
    providerId: "4116834",
    displayName: "Jonesboro, Arkansas, United States",
    locality: "Jonesboro",
    administrativeArea: "Arkansas",
    countryName: "United States",
    countryCode: "US",
    featureClass: "P",
    featureCode: "PPLA2",
    latitude: 35.8423,
    longitude: -90.7043,
    authorityName: "GeoNames",
    authorityIdentifier: "4116834",
    authorityUrl: "https://www.geonames.org/4116834/",
  });
});

test("searchGeoNames fails gracefully when configuration is missing", async () => {
  await assert.rejects(() => searchGeoNames({}, "Jonesboro"), (error) => error instanceof PlaceSearchUnavailableError && /not configured/u.test(error.message));
});

test("searchGeoNames translates provider failures into an unavailable error", async () => {
  await assert.rejects(
    () => searchGeoNames(config, "Jonesboro", { fetchFn: async () => { throw new Error("network down"); } }),
    PlaceSearchUnavailableError,
  );
});

test("searchGeoNames rejects malformed provider responses", async () => {
  await assert.rejects(
    () => searchGeoNames(config, "Jonesboro", { fetchFn: async () => ({ ok: true, json: async () => ({ unexpected: true }) }) }),
    PlaceSearchUnavailableError,
  );
});

test("getGeoNamesPlace validates identifiers before calling the provider", async () => {
  await assert.rejects(() => getGeoNamesPlace(config, "not-a-number"), /identifier is invalid/u);
});
