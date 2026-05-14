import type { CemeteryData, GraveSpace, Owner } from "../types";

const owners: Owner[] = [
  { id: "owner-harris", displayName: "Harris Family Trust", contactNote: "Primary contact: Elaine Harris" },
  { id: "owner-miller", displayName: "Samuel and Ruth Miller" },
  { id: "owner-church", displayName: "St. Mark Church Cemetery Association" },
  { id: "owner-watkins", displayName: "Clara Watkins" },
  { id: "owner-garcia", displayName: "Garcia Family" },
  { id: "owner-green", displayName: "Margaret Green Estate" },
];

const gravePolygon = (west: number, south: number, east: number, north: number): GeoJSON.Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ],
});

const graves: GraveSpace[] = [
  {
    id: "A-01-01",
    section: "A",
    lot: "01",
    space: "01",
    status: "occupied",
    geometry: gravePolygon(-76.70466, 39.19607, -76.70455, 39.19617),
    currentOwnerIds: ["owner-harris"],
    burials: [
      {
        id: "burial-mary-harris",
        person: { id: "person-mary-harris", firstName: "Mary", lastName: "Harris", birthDate: "1931-04-12", deathDate: "2011-09-02" },
        burialDate: "2011-09-06",
        notes: "Interred beside spouse per family deed.",
      },
    ],
    ownershipHistory: [
      {
        id: "own-a0101-1",
        ownerIds: ["owner-harris"],
        eventType: "purchase",
        effectiveDate: "1972-05-18",
        recordedBy: "Church Clerk",
        documentReference: "Deed Book 3, Page 14",
      },
    ],
  },
  {
    id: "A-01-02",
    section: "A",
    lot: "01",
    space: "02",
    status: "reserved",
    geometry: gravePolygon(-76.70454, 39.19607, -76.70443, 39.19617),
    currentOwnerIds: ["owner-harris"],
    burials: [],
    ownershipHistory: [
      {
        id: "own-a0102-1",
        ownerIds: ["owner-harris"],
        eventType: "purchase",
        effectiveDate: "1972-05-18",
        recordedBy: "Church Clerk",
        documentReference: "Deed Book 3, Page 14",
      },
    ],
    notes: "Reserved for family use.",
  },
  {
    id: "A-01-03",
    section: "A",
    lot: "01",
    space: "03",
    status: "available",
    geometry: gravePolygon(-76.70442, 39.19607, -76.70431, 39.19617),
    currentOwnerIds: ["owner-church"],
    burials: [],
    ownershipHistory: [
      {
        id: "own-a0103-1",
        ownerIds: ["owner-church"],
        eventType: "correction",
        effectiveDate: "2023-08-10",
        recordedBy: "Records Committee",
        notes: "Confirmed unsold during deed reconciliation.",
      },
    ],
  },
  {
    id: "A-02-01",
    section: "A",
    lot: "02",
    space: "01",
    status: "occupied",
    geometry: gravePolygon(-76.70466, 39.19593, -76.70455, 39.19603),
    currentOwnerIds: ["owner-miller"],
    burials: [
      {
        id: "burial-samuel-miller",
        person: { id: "person-samuel-miller", firstName: "Samuel", lastName: "Miller", birthDate: "1926-01-08", deathDate: "1998-11-22" },
        burialDate: "1998-11-26",
      },
      {
        id: "burial-ruth-miller",
        person: { id: "person-ruth-miller", firstName: "Ruth", lastName: "Miller", birthDate: "1930-06-19", deathDate: "2019-02-15" },
        burialDate: "2019-02-20",
      },
    ],
    ownershipHistory: [
      {
        id: "own-a0201-1",
        ownerIds: ["owner-miller"],
        eventType: "purchase",
        effectiveDate: "1965-03-04",
        recordedBy: "Treasurer",
        documentReference: "Receipt 1022",
      },
    ],
  },
  {
    id: "A-02-02",
    section: "A",
    lot: "02",
    space: "02",
    status: "sold",
    geometry: gravePolygon(-76.70454, 39.19593, -76.70443, 39.19603),
    currentOwnerIds: ["owner-watkins"],
    burials: [],
    ownershipHistory: [
      {
        id: "own-a0202-1",
        ownerIds: ["owner-church"],
        eventType: "correction",
        effectiveDate: "1990-01-01",
        recordedBy: "Records Committee",
      },
      {
        id: "own-a0202-2",
        ownerIds: ["owner-watkins"],
        eventType: "transfer",
        effectiveDate: "2008-07-12",
        recordedBy: "Cemetery Trustee",
        documentReference: "Transfer Form 2008-17",
      },
    ],
  },
  {
    id: "B-01-01",
    section: "B",
    lot: "01",
    space: "01",
    status: "occupied",
    geometry: gravePolygon(-76.70418, 39.19607, -76.70407, 39.19617),
    currentOwnerIds: ["owner-garcia"],
    burials: [
      {
        id: "burial-luis-garcia",
        person: { id: "person-luis-garcia", firstName: "Luis", lastName: "Garcia", birthDate: "1944-10-03", deathDate: "2020-12-28" },
        burialDate: "2021-01-04",
      },
    ],
    ownershipHistory: [
      {
        id: "own-b0101-1",
        ownerIds: ["owner-garcia"],
        eventType: "purchase",
        effectiveDate: "2004-11-20",
        recordedBy: "Cemetery Trustee",
      },
    ],
  },
  {
    id: "B-01-02",
    section: "B",
    lot: "01",
    space: "02",
    status: "reserved",
    geometry: gravePolygon(-76.70406, 39.19607, -76.70395, 39.19617),
    currentOwnerIds: ["owner-garcia"],
    burials: [],
    ownershipHistory: [
      {
        id: "own-b0102-1",
        ownerIds: ["owner-garcia"],
        eventType: "purchase",
        effectiveDate: "2004-11-20",
        recordedBy: "Cemetery Trustee",
      },
    ],
  },
  {
    id: "B-02-01",
    section: "B",
    lot: "02",
    space: "01",
    status: "unknown",
    geometry: gravePolygon(-76.70418, 39.19593, -76.70407, 39.19603),
    currentOwnerIds: ["owner-green"],
    burials: [
      {
        id: "burial-edward-green",
        person: { id: "person-edward-green", firstName: "Edward", middleName: "J.", lastName: "Green", deathDate: "1976-05-30" },
        burialDate: "1976-06-02",
        notes: "Birth date not present in ledger.",
      },
    ],
    ownershipHistory: [
      {
        id: "own-b0201-1",
        ownerIds: ["owner-green"],
        eventType: "inheritance",
        effectiveDate: "1989-09-16",
        recordedBy: "Church Clerk",
        notes: "Estate paperwork incomplete; verify current representative.",
      },
    ],
    notes: "Needs deed verification.",
  },
  {
    id: "B-02-02",
    section: "B",
    lot: "02",
    space: "02",
    status: "available",
    geometry: gravePolygon(-76.70406, 39.19593, -76.70395, 39.19603),
    currentOwnerIds: ["owner-church"],
    burials: [],
    ownershipHistory: [
      {
        id: "own-b0202-1",
        ownerIds: ["owner-church"],
        eventType: "correction",
        effectiveDate: "2024-04-09",
        recordedBy: "Records Committee",
      },
    ],
  },
];

export const cemeteryData: CemeteryData = {
  boundary: {
    type: "Feature",
    properties: { name: "St. Mark Church Cemetery" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-76.70475, 39.19584],
          [-76.70383, 39.19584],
          [-76.70383, 39.19625],
          [-76.70475, 39.19625],
          [-76.70475, 39.19584],
        ],
      ],
    },
  },
  sections: [
    {
      id: "section-a",
      name: "Section A",
      geometry: gravePolygon(-76.7047, 39.19588, -76.70425, 39.19621),
    },
    {
      id: "section-b",
      name: "Section B",
      geometry: gravePolygon(-76.70423, 39.19588, -76.70388, 39.19621),
    },
  ],
  graves,
  owners,
};
