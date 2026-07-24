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
  optimizeDeps: {
    // MapLibre 6 loads its ESM worker relative to import.meta.url. Pre-bundling
    // the main module into .vite/deps separates it from that worker file.
    exclude: ["maplibre-gl"],
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? packageJson.version),
    __GIT_SHA__: JSON.stringify(process.env.GIT_SHA ?? gitSha()),
    __BUILD_TIME__: JSON.stringify(process.env.BUILD_TIME ?? new Date().toISOString()),
  },
  build: {
    // MapLibre is the core map engine and ships as one large module; keep the
    // warning threshold close to that known dependency so app chunks still stand out.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-map",
              test: /node_modules[\\/](maplibre-gl|@mapbox)[\\/]/,
              priority: 30,
              maxSize: 450 * 1024,
            },
            {
              name: "vendor-react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: "vendor-icons",
              test: /node_modules[\\/](lucide-react|lucide)[\\/]/,
              priority: 20,
            },
            {
              name: "vendor-auth",
              test: /node_modules[\\/]@auth0[\\/]/,
              priority: 20,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              priority: 10,
              maxSize: 450 * 1024,
            },
          ],
        },
      },
    },
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
