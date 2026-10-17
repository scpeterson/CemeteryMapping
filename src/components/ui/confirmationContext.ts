import { createContext, useContext } from "react";
export const ConfirmationContext = createContext<(message: string) => Promise<boolean>>(() => Promise.resolve(false));
export function useConfirmation() { return useContext(ConfirmationContext); }
