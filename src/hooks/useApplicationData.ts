import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { fetchCemeteryData, fetchCurrentUser, fetchHeadstoneLookups } from "../api/cemeteryApi";
import { cemeteryData } from "../data/cemeteryData";
import { graveSelectionKey } from "../lib/format";
import type { CemeteryData, CurrentUser, GraveSpaceSummary, HeadstoneLookups } from "../types";

const emptyHeadstoneLookups: HeadstoneLookups = {
  headstones: [],
  gravesites: [],
  markerTypes: [],
  markerScopes: [],
  materials: [],
  conditions: [],
  vaseTypes: [],
  vaseMaterials: [],
  vasePlacements: [],
  graveFeatureTypes: [],
  graveFeatureSubtypes: [],
  graveFeaturePlacements: [],
  graveFeatureMaterials: [],
  intermentTypes: [],
  burialRecordStatuses: [],
  militaryBranches: [],
  militaryRanks: [],
  militaryWarServices: [],
  militaryDecorations: [],
  verifiedPlaces: [],
  maintenanceIssueTypes: [],
  maintenanceActionTypes: [],
  maintenancePriorities: [],
};

export function useApplicationData(setSelectedGrave: Dispatch<SetStateAction<GraveSpaceSummary | undefined>>) {
  const [data, setData] = useState<CemeteryData>(cemeteryData);
  const [loadError, setLoadError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser>();
  const [lookupError, setLookupError] = useState<string>();
  const [lookupLoading, setLookupLoading] = useState(true);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [headstoneLookups, setHeadstoneLookups] = useState<HeadstoneLookups>(emptyHeadstoneLookups);
  const [userError, setUserError] = useState<string>();
  useEffect(() => {
    let isCurrent = true;

    fetchCurrentUser()
      .then((user) => {
        if (!isCurrent) return;
        setCurrentUser(user);
        setUserError(undefined);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setUserError(error instanceof Error ? error.message : "Unable to load user permissions");
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    setLookupLoading(true);
    setLookupError(undefined);
    fetchHeadstoneLookups()
      .then((lookups) => {
        if (isCurrent) setHeadstoneLookups(lookups);
      })
      .catch((error: unknown) => {
        if (isCurrent) setLookupError(error instanceof Error ? error.message : "Try again.");
      })
      .finally(() => { if (isCurrent) setLookupLoading(false); });

    return () => {
      isCurrent = false;
    };
  }, [lookupAttempt]);

  useEffect(() => {
    let isCurrent = true;

    fetchCemeteryData()
      .then((nextData) => {
        if (!isCurrent) return;
        setData(nextData);
        setSelectedGrave((current) =>
          current ? nextData.graves.find((grave) => graveSelectionKey(grave) === graveSelectionKey(current)) : undefined,
        );
        setLoadError(undefined);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load cemetery data");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [setSelectedGrave]);

  return { data, setData, loadError, isLoading, currentUser, userError, headstoneLookups, lookupError, lookupLoading,
    retryLookups: () => setLookupAttempt((value) => value + 1) };
}
