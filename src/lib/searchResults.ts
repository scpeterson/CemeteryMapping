import type { CemeterySearchMatch, LotSearchMatch, MonumentSearchMatch, SearchMatch } from "../types";
import { graveSelectionKey } from "./format";

function matchCemeteryId(match: CemeterySearchMatch) {
  if ("headstone" in match) return match.headstone.cemeteryId;
  if ("lot" in match) return match.lot.cemeteryId;
  return match.grave.cemeteryId;
}

export function combineSearchMatches(
  monuments: MonumentSearchMatch[], lots: LotSearchMatch[], graves: SearchMatch[],
  cemeteryScope: string | null,
): CemeterySearchMatch[] {
  if (cemeteryScope === null) return [];
  const matches: CemeterySearchMatch[] = [...monuments, ...lots, ...graves];
  return cemeteryScope === "" ? matches : matches.filter((match) => matchCemeteryId(match) === cemeteryScope);
}

export function graveSearchResultIds(matches: CemeterySearchMatch[], query: string): Set<string> {
  if (!query.trim()) return new Set();
  return new Set(matches
    .filter((match): match is SearchMatch => "grave" in match)
    .map((match) => graveSelectionKey(match.grave)));
}
