import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";

const geodatabasePath = process.argv[2];

if (!geodatabasePath) {
  console.error("Usage: npm run geodatabase:inspect -- /path/to/source.gdb");
  process.exit(1);
}

if (!existsSync(geodatabasePath) || !statSync(geodatabasePath).isDirectory()) {
  console.error(`File Geodatabase folder not found: ${geodatabasePath}`);
  process.exit(1);
}

const result = spawnSync("ogrinfo", ["-so", geodatabasePath], {
  stdio: "inherit",
});

if (result.error) {
  console.error(`Unable to run ogrinfo: ${result.error.message}`);
  console.error("Install GDAL/OGR and make sure ogrinfo is on your PATH.");
  process.exit(1);
}

process.exit(result.status ?? 1);
