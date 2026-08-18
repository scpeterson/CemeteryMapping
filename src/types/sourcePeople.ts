export type SourcePersonRecordSourceCode = "CR" | "CRG" | "FH" | "SK" | "NOTE" | "OTHER";
export type SourcePersonRecordType = "death_record" | "burial_record" | "funeral_record" | "church_record" | "family_history" | "other";
export type SourcePersonRecordStatus = "unmatched" | "candidate_match" | "linked" | "rejected";
export type SourcePersonRecordConfidence = "high" | "medium" | "low" | "review";

export type SourcePersonRecordLink = {
  id: string;
  linkType: "candidate" | "matched" | "rejected";
  confidence: SourcePersonRecordConfidence;
  targetType: "burial" | "gravesite" | "headstone";
  targetId: string;
  targetLabel: string;
  notes: string;
};

export type SourcePersonRecord = {
  id: string;
  cemeteryId: string;
  cemeteryName: string;
  northHillsOcrEntryId?: string;
  northHillsOcrSourceFactId?: string;
  sourceName: string;
  sourceCode: SourcePersonRecordSourceCode;
  sourceLabel: string;
  sourcePageNumber?: number;
  sourceLocationText: string;
  recordType: SourcePersonRecordType;
  status: SourcePersonRecordStatus;
  confidence: SourcePersonRecordConfidence;
  firstName: string;
  middleName: string;
  lastName: string;
  maidenName: string;
  fullName: string;
  birthDate?: string;
  birthDateText: string;
  deathDate?: string;
  deathDateText: string;
  burialDate?: string;
  burialDateText: string;
  funeralDate?: string;
  funeralDateText: string;
  ageText: string;
  rawText: string;
  notes: string;
  reviewedByEmail: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  links: SourcePersonRecordLink[];
};

export type SourcePersonRecordCemetery = {
  id: string;
  name: string;
};

export type SourcePersonRecordReview = {
  cemeteries: SourcePersonRecordCemetery[];
  records: SourcePersonRecord[];
};

export type SourcePersonRecordFilters = {
  q?: string;
  status?: string;
  sourceCode?: string;
  cemeteryId?: string;
  limit?: number;
};

export type SaveSourcePersonRecordInput = {
  cemeteryId: string;
  northHillsOcrEntryId?: string;
  northHillsOcrSourceFactId?: string;
  sourceName: string;
  sourceCode: SourcePersonRecordSourceCode;
  sourceLabel: string;
  sourcePageNumber?: number | null;
  sourceLocationText: string;
  recordType: SourcePersonRecordType;
  status: SourcePersonRecordStatus;
  confidence: SourcePersonRecordConfidence;
  firstName: string;
  middleName: string;
  lastName: string;
  maidenName: string;
  fullName: string;
  birthDate?: string;
  birthDateText: string;
  deathDate?: string;
  deathDateText: string;
  burialDate?: string;
  burialDateText: string;
  funeralDate?: string;
  funeralDateText: string;
  ageText: string;
  rawText: string;
  notes: string;
  reason: string;
};
