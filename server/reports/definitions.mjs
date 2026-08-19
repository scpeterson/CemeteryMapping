const roleRank = new Map([
  ["reader", 1],
  ["power-user", 2],
  ["cemetery-admin", 3],
  ["admin", 4],
]);

export const reportDefinitions = [
  {
    id: "burial-date-extremes",
    title: "Oldest and latest burials",
    description: "Finds the earliest and most recent recorded burial dates.",
    category: "Burials",
    requiredRole: "reader",
    parameters: [],
    examples: ["What is the oldest burial in the cemetery?", "What is the latest burial?"],
  },
  {
    id: "veteran-service-summary",
    title: "Veteran service summary",
    description: "Counts veteran burials and groups them by branch and war service.",
    category: "Veterans",
    requiredRole: "reader",
    parameters: [],
    examples: ["How many veterans are buried here?", "What wars did veterans serve in?", "What service branches were they in?"],
  },
  {
    id: "spatial-inventory-counts",
    title: "Spatial inventory counts",
    description: "Counts markers and gravesites by cemetery and optional section.",
    category: "Inventory",
    requiredRole: "reader",
    parameters: [{ name: "sectionName", label: "Section", type: "text", required: false }],
    examples: [
      "How many markers are in section C?",
      "How many markers are in the cemetery?",
      "How many gravesites are in section C?",
      "How many gravesites are in the cemetery?",
    ],
  },
  {
    id: "marker-type-inventory",
    title: "Markers by type",
    description: "Lists markers grouped by marker type, cemetery, and optional section.",
    category: "Inventory",
    requiredRole: "reader",
    parameters: [
      { name: "sectionName", label: "Section", type: "text", required: false },
      { name: "markerType", label: "Marker type", type: "text", required: false },
    ],
    examples: ["List markers by type.", "What marker types are in section C?", "List flat markers."],
  },
  {
    id: "marker-burial-pages",
    title: "Marker burial pages",
    description: "Creates one printable page per burial linked to a marker, including marker photo, marker details, burial details, and NHG text.",
    category: "Burials",
    requiredRole: "reader",
    parameters: [
      { name: "markerId", label: "Marker ID", type: "text", required: false },
      { name: "personName", label: "Burial name", type: "text", required: false },
      { name: "sectionName", label: "Section", type: "text", required: false },
    ],
    examples: ["Print burial pages for marker TLC-HS-0228.", "Show marker burial pages for Schug.", "Print marker burial pages for section C."],
  },
  {
    id: "owner-holdings",
    title: "Owner holdings",
    description: "Lists lots and gravesites currently associated with an owner name.",
    category: "Ownership",
    requiredRole: "power-user",
    parameters: [{ name: "ownerName", label: "Owner name", type: "text", required: true }],
    examples: ["How many lots are owned by Smith?", "How many gravesites are owned by Maria Garcia?"],
  },
  {
    id: "unowned-gravesites",
    title: "Unowned gravesites",
    description: "Lists gravesites without a direct owner or ownership inherited through a whole-lot deed.",
    category: "Ownership",
    requiredRole: "power-user",
    parameters: [
      { name: "sectionName", label: "Section", type: "text", required: false },
      { name: "status", label: "Gravesite status", type: "text", required: false },
    ],
    examples: ["Which gravesites do not have an owner?", "Show unowned gravesites in section C."],
  },
  {
    id: "available-inventory",
    title: "Available lots and gravesites",
    description: "Lists gravesites and whole lots that appear available for purchase.",
    category: "Inventory",
    requiredRole: "power-user",
    parameters: [],
    examples: ["What lots are available for purchase?", "What gravesites are available?"],
  },
  {
    id: "maintenance-needs",
    title: "Maintenance needs",
    description: "Lists open maintenance issues, completed work, or markers not cleaned within a selected time period.",
    category: "Maintenance",
    requiredRole: "power-user",
    parameters: [
      { name: "status", label: "Status", type: "text", required: false },
      { name: "targetType", label: "Target type", type: "text", required: false },
      { name: "issueCode", label: "Issue", type: "text", required: false },
      { name: "actionCode", label: "Action", type: "text", required: false },
      { name: "daysSinceCleaned", label: "Days since cleaned", type: "text", required: false },
    ],
    examples: [
      "Which markers are illegible?",
      "Which markers are listing or broken?",
      "Which gravesites need grass planted?",
      "Which gravesites need leveling?",
      "What markers have not been cleaned in a year?",
    ],
  },
  {
    id: "deed-claim-trace-guide",
    title: "Deed claim trace guide",
    description: "Outlines the records to inspect when someone claims inherited lot rights without paperwork.",
    category: "Investigations",
    requiredRole: "cemetery-admin",
    parameters: [{ name: "claimantName", label: "Claimant or family name", type: "text", required: false }],
    examples: ["How do we trace a deed claim with no paperwork?", "Parents owned a deed but the family has no documents."],
  },
];

export function canRun(role, requiredRole) {
  return (roleRank.get(role) ?? 0) >= (roleRank.get(requiredRole) ?? Number.POSITIVE_INFINITY);
}

export function toDefinition(definition) {
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    category: definition.category,
    requiredRole: definition.requiredRole,
    parameters: definition.parameters,
    examples: definition.examples,
  };
}

export function definitionById(id) {
  return reportDefinitions.find((definition) => definition.id === id);
}
