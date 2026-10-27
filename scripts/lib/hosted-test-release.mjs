import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function requirePassingCi(response, sha) {
  const checks = response.check_runs.filter((check) => check.name === "Lint, build, and test" && check.head_sha === sha);
  if (!checks.length || checks.some((check) => check.status !== "completed" || check.conclusion !== "success")) {
    throw new Error("Latest main must pass Lint, build, and test before deployment.");
  }
}

export function frontendEnvironment(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^(VITE_[A-Z0-9_]+)=(.*)$/u.exec(trimmed);
    if (!match) throw new Error("Hosted frontend.env must contain only public VITE_ settings.");
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/u, "$2");
  }
  for (const key of ["VITE_AUTH0_DOMAIN", "VITE_AUTH0_CLIENT_ID", "VITE_AUTH0_AUDIENCE"]) {
    if (!values[key]) throw new Error(`Hosted frontend.env is missing ${key}.`);
  }
  return values;
}

export function releaseFiles(root) {
  const files = {};
  function visit(directory, prefix = "") {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Release contains a symbolic link: ${relative}`);
      if (entry.isDirectory()) visit(join(directory, entry.name), `${relative}/`);
      else if (entry.isFile()) {
        if (entry.name.endsWith(".env") || entry.name.includes(".env.")) throw new Error(`Release contains an environment file: ${relative}`);
        files[relative] = createHash("sha256").update(readFileSync(join(directory, entry.name))).digest("hex");
      }
    }
  }
  visit(root);
  return files;
}
