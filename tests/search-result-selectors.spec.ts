import { expect, test } from "@playwright/test";
import { combineSearchMatches, graveSearchResultIds } from "../src/lib/searchResults";
import type { CemeterySearchMatch, LotSearchMatch, MonumentSearchMatch, SearchMatch } from "../src/types";

const monuments = ["a", "b"].map((cemeteryId) => ({ headstone: { id: "marker", cemeteryId }, reasons: [] })) as MonumentSearchMatch[];
const lots = ["a", "b"].map((cemeteryId) => ({ lot: { id: "lot", cemeteryId }, reasons: [] })) as LotSearchMatch[];
const graves = ["a", "b"].map((cemeteryId) => ({ grave: { id: "same", cemeteryId }, reasons: ["Grave match"] })) as SearchMatch[];

test("combined results preserve monument/lot/grave order and scope every record type", () => {
  expect(combineSearchMatches(monuments, lots, graves, "")).toEqual([...monuments, ...lots, ...graves]);
  expect(combineSearchMatches(monuments, lots, graves, "a")).toEqual([monuments[0], lots[0], graves[0]]);
  expect(combineSearchMatches(monuments, lots, graves, null)).toEqual([]);
  expect(combineSearchMatches(monuments, lots, [], "b")).toEqual([monuments[1], lots[1]]);
});

test("map highlights use distinct cemetery-qualified grave IDs only for a nonempty query", () => {
  const matches: CemeterySearchMatch[] = [...monuments, ...lots, ...graves, graves[0]];
  expect([...graveSearchResultIds(matches, "find")]).toEqual(["a:same", "b:same"]);
  expect([...graveSearchResultIds(matches, " \t ")]).toEqual([]);
});
