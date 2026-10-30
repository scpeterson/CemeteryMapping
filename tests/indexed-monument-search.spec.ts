import { expect, test } from "@playwright/test";
import { indexSearchGraves, searchMonuments } from "../src/lib/search";
import type { CemeteryData, GraveSpaceSummary, HeadstoneSummary } from "../src/types";

test("indexed monument search separates cemeteries and preserves unknown status, normalization and order", () => {
  const graves = [
    { id: "same", cemeteryId: "a", status: "occupied" },
    { id: "same", cemeteryId: "b", status: "available" },
  ] as GraveSpaceSummary[];
  const headstones = [
    { id: "2", headstoneId: "M-2", cemeteryId: "a", gravesiteId: "same" },
    { id: "1", headstoneId: "M-1", cemeteryId: "b", gravesiteId: "same" },
    { id: "3", headstoneId: "M-3", cemeteryId: "a", gravesiteId: "missing" },
  ] as HeadstoneSummary[];
  const data = { graves, headstones } as CemeteryData;
  const index = indexSearchGraves(graves);
  expect(searchMonuments(data, " m- ", new Set(["occupied"]), index).map((match) => match.headstone.id)).toEqual(["2"]);
  expect(searchMonuments(data, "M-", new Set(["available", "unknown"]), index).map((match) => match.headstone.id)).toEqual(["1", "3"]);
  expect(searchMonuments(data, " ", new Set(["occupied"]), index)).toEqual([]);
  expect(searchMonuments(data, "M-2", new Set(["occupied"]), index)[0].reasons).toEqual(["Monument ID: M-2"]);
});
