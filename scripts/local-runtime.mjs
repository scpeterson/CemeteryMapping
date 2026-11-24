import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, cpSync, symlinkSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createServer } from "node:net";

export function settings(environment, root) {
  if (!["dev", "test"].includes(environment)) throw new Error("Only local dev and test are supported.");
  return { environment, root, home: join(root, ".runtime", environment), api: environment === "dev" ? 3001 : 3003, web: environment === "dev" ? 5173 : 5174 };
}
export function xml(value) {
  return String(value).replace(/[<>&"']/gu, ch => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[ch]);
}
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} failed (${result.status}).`);
}
export function runtimeEnvironment(config, profile, release) {
  // A managed runtime must never silently downgrade an existing authenticated environment.
  if (profile.AUTH_MODE !== "auth0" || !profile.AUTH0_DOMAIN || !profile.AUTH0_AUDIENCE) throw new Error("Private profile must explicitly configure AUTH_MODE=auth0, AUTH0_DOMAIN and AUTH0_AUDIENCE.");
  return { ...process.env, ...profile, APP_ENV: config.environment, API_PORT: String(config.api),
    VITE_PROXY_API_TARGET: `http://127.0.0.1:${config.api}`, GIT_SHA: release.gitSha,
    BUILD_TIME: release.buildTime, APP_VERSION: release.version };
}
function profile(config) {
  const path = join(config.home, "environment.json");
  if ((statSync(path).mode & 0o077) !== 0) throw new Error("Private profile must have mode 0600 or stricter.");
  return json(path);
}
function current(config) { return json(join(config.home, "release.json")); }
async function freePort(port) {
  await new Promise((accept, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(`Port ${port} is occupied; stop its owner explicitly before starting.`)));
    server.listen(port, "127.0.0.1", () => server.close(accept));
  });
}
async function supervise(config) {
  await freePort(config.api); await freePort(config.web);
  const release = current(config);
  const env = runtimeEnvironment(config, profile(config), release);
  const apiScript = config.environment === "test" ? join(release.directory, "server/index.mjs") : join(config.root, "server/index.mjs");
  const webArgs = [join(config.root, "node_modules/vite/bin/vite.js"), ...(config.environment === "test" ? ["preview", "--outDir", join(release.directory, "dist")] : []), "--mode", config.environment, "--host", "127.0.0.1", "--port", String(config.web), "--strictPort"];
  const children = [[apiScript], webArgs].map(args => spawn(process.execPath, args, { cwd: config.root, env, stdio: "inherit" }));
  let stopping = false;
  function stop(code) {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill("SIGTERM");
    const deadline = setTimeout(() => { for (const child of children) child.kill("SIGKILL"); process.exit(code); }, 10000);
    Promise.all(children.map(child => child.exitCode !== null || child.signalCode !== null ? Promise.resolve() : new Promise(done => child.once("exit", done)))).then(() => { clearTimeout(deadline); process.exit(code); });
  }
  process.on("SIGTERM", () => stop(0)); process.on("SIGINT", () => stop(0));
  for (const child of children) { child.once("error", () => stop(1)); child.once("exit", () => stop(1)); }
}
async function main() {
  const [command, environment = "test"] = process.argv.slice(2);
  const root = fileURLToPath(new URL("../", import.meta.url));
  const config = settings(environment, root);
  mkdirSync(config.home, { recursive: true, mode: 0o700 });
  const label = `org.nhcemeteries.local.${createHash("sha256").update(root).digest("hex").slice(0, 10)}.${environment}`;
  const service = `gui/${process.getuid()}/${label}`;
  if (command === "build") {
    const release = { gitSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), buildTime: new Date().toISOString(), version: json(join(root, "package.json")).version };
    release.directory = join(config.home, "releases", release.buildTime.replace(/[^0-9TZ]/gu, ""));
    const env = runtimeEnvironment(config, profile(config), release);
    mkdirSync(release.directory, { recursive: true, mode: 0o700 });
    if (environment === "test") {
      run(process.execPath, ["node_modules/typescript/bin/tsc", "-b"], { cwd: root, env });
      run(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--mode", "test", "--outDir", join(release.directory, "dist")], { cwd: root, env });
      for (const name of ["server", "shared", "package.json", "package-lock.json"]) cpSync(join(root, name), join(release.directory, name), { recursive: true });
      // Dependencies remain the lockfile-installed checkout dependencies; npm ci requires a rebuild/restart.
      symlinkSync(join(root, "node_modules"), join(release.directory, "node_modules"), "dir");
    }
    writeFileSync(join(release.directory, "release.json"), JSON.stringify(release, null, 2), { mode: 0o600 });
    writeFileSync(join(config.home, "release.json"), JSON.stringify(release, null, 2), { mode: 0o600 });
    console.log(`Prepared ${environment} ${release.gitSha} at ${release.buildTime}. Restart to activate.`);
  } else if (command === "run") await supervise(config);
  else if (["start", "stop"].includes(command)) {
    if (process.platform !== "darwin") throw new Error("Use 'run' under your service manager on non-macOS systems.");
    if (command === "stop") { run("launchctl", ["bootout", service]); return; }
    current(config); runtimeEnvironment(config, profile(config), current(config));
    await freePort(config.api); await freePort(config.web);
    const agents = join(process.env.HOME, "Library/LaunchAgents"); mkdirSync(agents, { recursive: true });
    const path = join(agents, `${label}.plist`);
    const args = [process.execPath, fileURLToPath(import.meta.url), "run", environment];
    const plist = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${xml(label)}</string><key>ProgramArguments</key><array>${args.map(arg => `<string>${xml(arg)}</string>`).join("")}</array><key>WorkingDirectory</key><string>${xml(root)}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer><key>StandardOutPath</key><string>${xml(join(config.home, "runtime.log"))}</string><key>StandardErrorPath</key><string>${xml(join(config.home, "runtime.log"))}</string><key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(process.env.PATH)}</string></dict></dict></plist>`;
    writeFileSync(path, plist, { mode: 0o600 });
    writeFileSync(join(config.home, "runtime.log"), "", { flag: "a", mode: 0o600 });
    run("launchctl", ["bootstrap", `gui/${process.getuid()}`, path]);
    console.log(`Started ${environment}; ${join(config.home, "runtime.log")}`);
  } else if (command === "status") {
    const response = await fetch(`http://127.0.0.1:${config.web}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Health returned ${response.status}.`);
    const health = await response.json();
    const release = current(config);
    if (health.status !== "ok" || health.environment !== environment.toUpperCase() || health.version.gitSha !== release.gitSha || health.version.buildTime !== release.buildTime) throw new Error("Runtime does not match the prepared release.");
    const me = await fetch(`http://127.0.0.1:${config.web}/api/me`, { signal: AbortSignal.timeout(5000) });
    if (me.status !== 401) throw new Error("Anonymous identity request must return 401.");
    console.log(JSON.stringify({ environment, version: health.version, status: health.status, anonymousIdentityStatus: me.status }, null, 2));
  } else throw new Error("Usage: npm run local:runtime -- build|start|stop|run|status dev|test");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
