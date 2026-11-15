export type InscriptionStatus = "not_recorded" | "transcribed" | "blank" | "illegible";
export const inscriptionStatuses: InscriptionStatus[];
export function inscriptionStatus(status: InscriptionStatus | undefined | null, text: unknown): InscriptionStatus;
export function inscriptionAllowsText(status: InscriptionStatus): boolean;
export function inscriptionMissing(status: InscriptionStatus | undefined | null, text: unknown, legibility?: string): boolean;

export function inscriptionPlaceholder(text: unknown): "blank" | "illegible" | undefined;
export function normalizeInscriptionPlaceholder<T extends { inscription: string }>(value: T): T;
export function wholeFaceInscription(status?: "blank" | "illegible"): { inscription: string; inscriptionStatus: InscriptionStatus; currentLegibility: "blank" | "illegible" | "unknown" };
