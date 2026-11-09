import base from "./vite.config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const guardPath = fileURLToPath(new URL("./src/hooks/useDraftState.ts", import.meta.url));
const override = process.env.DRAFT_GUARD_SOURCE ? readFileSync(process.env.DRAFT_GUARD_SOURCE, "utf8") : undefined;
export default {
  ...base,
  define: { ...base.define, __BUILD_TIME__: JSON.stringify("2026-11-09T12:00:00Z") },
  plugins: [{ name: "draft-guard-profile-baseline", enforce: "pre" as const, transform(_code: string, id: string) {
    return id === guardPath ? override : undefined;
  } }, ...(base.plugins ?? [])],
  build: {
    ...base.build,
    outDir: `node_modules/.tmp/draft-guard-profile/${process.env.DRAFT_PROFILE_VARIANT ?? "before"}`,
    emptyOutDir: true,
    rolldownOptions: { ...base.build?.rolldownOptions, input: fileURLToPath(new URL("./tests/draft-guard.html", import.meta.url)) },
  },
};
