import { createContext, useContext } from "react";

type AccountSession = {
  identity: string;
  accountId?: string;
  signOut: () => void;
};

// No account controls when authentication is disabled in the environment.
export const SessionContext = createContext<AccountSession | undefined>(undefined);
export const useAccountSession = () => useContext(SessionContext);
