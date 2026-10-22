export type CurrentLegibility = "unknown" | "legible" | "partially_legible" | "blank" | "illegible";
export type HistoricalTranscription = { id: string; text: string; source: string; sourceDate: string; faceId?: string; faceLabel?: string };
export const legibilityValues: CurrentLegibility[];
export const legibilityLabels: Record<CurrentLegibility, string>;
export function currentLegibility(value?: CurrentLegibility | null, status?: string | null): CurrentLegibility;
export function preserveTranscription(history: HistoricalTranscription[] | undefined, text: string): HistoricalTranscription[];
