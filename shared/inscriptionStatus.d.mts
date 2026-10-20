export type InscriptionStatus = "not_recorded" | "transcribed" | "blank" | "illegible";
export const inscriptionStatuses: InscriptionStatus[];
export function inscriptionStatus(status: InscriptionStatus | undefined | null, text: unknown): InscriptionStatus;
export function inscriptionAllowsText(status: InscriptionStatus): boolean;
export function inscriptionMissing(status: InscriptionStatus | undefined | null, text: unknown): boolean;
