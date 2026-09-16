import { createContext } from "react";
export const EditingOptionsContext = createContext({ loading: false, error: undefined as string | undefined, retry: () => {} });
