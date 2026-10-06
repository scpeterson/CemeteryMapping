import { useState } from "react";
import { LookupSelect } from "./EditingOptions";
import { importVerifiedPlace, searchGeographicPlaces } from "../../api/cemeteryApi";
import type { GeographicPlaceCandidate, HeadstoneLookups, VerifiedPlace } from "../../types";

export default function BurialPlaceField({ label, value, places, onChange }: {
  label: string;
  value: string;
  places: HeadstoneLookups["verifiedPlaces"];
  onChange: (id: string) => void;
}) {
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeCandidates, setPlaceCandidates] = useState<GeographicPlaceCandidate[]>([]);
  const [placeRetry, setPlaceRetry] = useState<"search" | GeographicPlaceCandidate>();
  const [placeSearchMessage, setPlaceSearchMessage] = useState<string>();
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isImportingPlace, setIsImportingPlace] = useState(false);
  const [importedPlace, setImportedPlace] = useState<VerifiedPlace>();

  const searchPlaces = async () => {
    const query = placeQuery.trim();
    if (query.length < 2) {
      setPlaceCandidates([]);
      setPlaceSearchMessage("Enter at least two characters to search.");
      return;
    }
    setPlaceRetry(undefined);
    setIsSearchingPlaces(true);
    setPlaceSearchMessage(undefined);
    try {
      const response = await searchGeographicPlaces(query);
      setPlaceCandidates(response.results);
      setPlaceSearchMessage(response.available ? (response.results.length ? undefined : "No matching places found.") : response.message);
      if (!response.available) setPlaceRetry("search");
    } catch (error) {
      setPlaceRetry("search");
      setPlaceCandidates([]);
      setPlaceSearchMessage(error instanceof Error ? error.message : "Geographic search couldn't be completed. Try again.");
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const choosePlace = async (candidate: GeographicPlaceCandidate) => {
    setPlaceRetry(undefined);
    setIsImportingPlace(true);
    setPlaceSearchMessage(undefined);
    try {
      const place = await importVerifiedPlace(candidate);
      setImportedPlace(place);
      onChange(place.id);
      setPlaceCandidates([]);
      setPlaceSearchMessage(`${place.displayName} is verified and selected.`);
    } catch (error) {
      setPlaceRetry(candidate);
      setPlaceSearchMessage(error instanceof Error ? error.message : "That place couldn't be verified. Try again.");
    } finally {
      setIsImportingPlace(false);
    }
  };

  return (<>
        <label className="burial-wide-field">
          {label}
          <LookupSelect value={value} onChange={(event) => onChange(event.target.value)}>
            <option value="">Unknown / not recorded</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.label}
              </option>
            ))}
            {importedPlace && !places.some((place) => place.id === importedPlace.id) ? (
              <option value={importedPlace.id}>{importedPlace.displayName}</option>
            ) : null}
          </LookupSelect>
          <small>Only places verified against an authoritative geographic registry are available.</small>
        </label>
        <div className="burial-wide-field" role="group" aria-label={`${label} geographic search`}>
          <label>
            Find another verified {label.toLowerCase()}
            <input
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.target.value)}
              placeholder="City, state, or country"
              disabled={isSearchingPlaces || isImportingPlace}
            />
          </label>
          <button type="button" className="secondary-button" onClick={() => void searchPlaces()} disabled={isSearchingPlaces || isImportingPlace || placeQuery.trim().length < 2}>
            {isSearchingPlaces ? "Searching..." : "Search geographic registry"}
          </button>
          {placeSearchMessage ? <p className="detail-message" role={placeRetry ? "alert" : "status"}>{placeSearchMessage}</p> : null}
          {placeRetry ? <button type="button" disabled={isSearchingPlaces || isImportingPlace} onClick={() => void (placeRetry === "search" ? searchPlaces() : choosePlace(placeRetry))}>Retry place {placeRetry === "search" ? "search" : "verification"}</button> : null}
          {placeCandidates.length ? (
            <ul className="burial-notes" aria-label={`${label} search results`}>
              {placeCandidates.map((candidate) => (
                <li key={`${candidate.provider}-${candidate.providerId}`}>
                  <button type="button" className="secondary-button" onClick={() => void choosePlace(candidate)} disabled={isImportingPlace}>
                    Use {candidate.displayName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
  </>);
}
