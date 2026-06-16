import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
const apiProxyTarget = process.env.VITE_PROXY_API_TARGET ?? "http://127.0.0.1:3001";

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? packageJson.version),
    __GIT_SHA__: JSON.stringify(process.env.GIT_SHA ?? gitSha()),
    __BUILD_TIME__: JSON.stringify(process.env.BUILD_TIME ?? new Date().toISOString()),
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      "/media": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
