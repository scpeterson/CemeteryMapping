import { useMemo } from "react";
import type { CemeteryData, GraveStatus } from "../types";
import { indexSearchGraves, searchGraves, searchLots, searchMonuments } from "../lib/search";
import { combineSearchMatches, graveSearchResultIds } from "../lib/searchResults";
import { useCemeterySearch } from "./useCemeterySearch";

/** Build list results and map highlights from the already cemetery-scoped data. */
export function useCemeterySearchResults(
  scopedData: CemeteryData, query: string, statuses: Set<GraveStatus>, cemeteryScope: string | null,
) {
  const { remoteMatches, ...workflow } = useCemeterySearch(query, statuses, cemeteryScope);
  const localMatches = useMemo(
    () => remoteMatches === undefined ? searchGraves(scopedData, query, statuses) : [],
    [scopedData, query, statuses, remoteMatches],
  );
  const gravesByKey = useMemo(() => indexSearchGraves(scopedData.graves), [scopedData.graves]);
  const monuments = useMemo(
    () => searchMonuments(scopedData, query, statuses, gravesByKey),
    [scopedData, query, statuses, gravesByKey],
  );
  const lots = useMemo(() => searchLots(scopedData, query), [scopedData, query]);
  const matches = useMemo(
    () => combineSearchMatches(monuments, lots, remoteMatches ?? localMatches, cemeteryScope),
    [monuments, lots, remoteMatches, localMatches, cemeteryScope],
  );
  const searchResultIds = useMemo(() => graveSearchResultIds(matches, query), [matches, query]);
  return { ...workflow, matches, searchResultIds };
}
