---
---

# Getting Started

[Documentation Home](index.md)

This guide is for someone setting up Cemetery Mapping from scratch. It assumes you are comfortable following commands, but it does not assume you already know the project, Docker, Node.js, or the database layout.

Start here when you want to run the application locally with demo data. After that works, use the [Operator Workflows](operator-workflows.md) for real cemetery onboarding and maintenance.

## Pick Your Path

- **Run the demo locally**: follow this page from top to bottom. This is the best first step.
- **Use real Auth0 sign-in**: first make the demo work, then follow [Auth0 Test Tenant Setup](auth0-test-tenant.md).
- **Bring in a new cemetery**: first make the demo work, then follow the one-time cemetery onboarding section in [Operator Workflows](operator-workflows.md).
- **Validate a full technical rebuild**: use [Rebuild Guide](rebuild.md) after this page is working.

## What You Need To Install

Install these before running the project:

- **Git**: downloads the project source code.
- **Node.js 24**: runs the frontend, API, and project scripts. Node includes `npm`.
- **Docker Desktop**: runs the local PostgreSQL/PostGIS database and Liquibase migration container.
- **Ruby 3.4.1 and Bundler 2.6.2**: only needed to build the documentation site locally.
- **GDAL/OGR**: only needed when importing Esri File Geodatabases.

For a first demo run, the required tools are Git, Node.js/npm, and Docker Desktop. Ruby and GDAL can wait unless you are building docs or importing geodatabase files.

## Mac Setup Notes

Recommended install options:

- Install **Git** from Apple's command line tools or from [git-scm.com](https://git-scm.com/).
- Install **Node.js 24** from [nodejs.org](https://nodejs.org/) or with a version manager such as `nvm`.
- Install **Docker Desktop for Mac** from Docker.
- Install **Ruby 3.4.1** with a Ruby version manager such as `rbenv`, `asdf`, or `mise` if you need to build docs.
- Install **GDAL** with Homebrew when you need geodatabase imports:

  ```bash
  brew install gdal
  ```

Open the project in Terminal. If you use zsh, which is the default shell on modern macOS, the commands in this guide can be copied as written.

## Windows Setup Notes

Recommended install options:

- Install **Git for Windows** from [git-scm.com](https://git-scm.com/).
- Install **Node.js 24** from [nodejs.org](https://nodejs.org/).
- Install **Docker Desktop for Windows** and enable the WSL 2 backend when prompted.
- Install **Windows Terminal** from the Microsoft Store if it is not already installed.
- Use **PowerShell** or **Windows Terminal** for basic local demo commands.
- For the smoothest developer experience, use **WSL 2 with Ubuntu** and run the project commands inside Ubuntu.

Windows path examples look different from Mac paths. For example:

```text
Mac:     /Users/scottpeterson/Dev/CemeteryMapping
Windows: C:\Users\YourName\Dev\CemeteryMapping
WSL:     /home/yourname/Dev/CemeteryMapping
```

If you use WSL, keep the project files inside the WSL Linux filesystem, such as `/home/yourname/Dev/CemeteryMapping`, rather than under `/mnt/c/...`. Docker Desktop can still run the database containers.

GDAL on Windows is optional until you import geodatabase files. Install it through OSGeo4W, Conda, or inside WSL when needed. Confirm that `ogrinfo` works before running geodatabase import commands.

## Check Your Tools

Open Terminal, PowerShell, or your WSL shell and run:

```bash
git --version
node --version
npm --version
docker --version
docker compose version
```

Expected result:

- Each command prints a version number.
- `node --version` should start with `v24` or another compatible current version.
- Docker Desktop should be running before Docker commands will work.

Optional documentation checks:

```bash
ruby --version
bundle --version
```

Optional geodatabase import check:

```bash
ogrinfo --version
```

If a command says it is not found, install that tool or restart your terminal so your PATH is refreshed.

## Get The Project

Choose a folder where you keep development projects. Then clone the repository:

```bash
git clone <repository-url>
cd CemeteryMapping
```

If you already have the project folder, go into it:

```bash
cd /path/to/CemeteryMapping
```

On this Mac workspace, the project path is:

```bash
cd /Users/scottpeterson/Dev/CemeteryMapping
```

You should now be in the folder that contains `package.json`.

Check:

```bash
ls
```

Expected result: you should see files and folders such as `package.json`, `src`, `server`, `db`, and `docs`.

## Install Project Packages

Run:

```bash
npm ci
```

Expected result:

- npm installs packages into `node_modules`.
- The command exits without an error.

If `npm ci` fails because the lockfile is missing or packages changed unexpectedly, use:

```bash
npm install
```

For normal rebuilds and CI-style validation, prefer `npm ci`.

## Start The Local Database

Make sure Docker Desktop is running. Then start the DEV database:

```bash
npm run db:up
```

Expected result:

- Docker starts a container named like `cemetery-mapping-db-dev`.
- The command should finish without an error.

If port `5432` is already in use, create `db/env/dev.local.env` with a different host port:

```text
POSTGRES_PORT=5436
```

Then run:

```bash
npm run db:up
```

## Apply Database Migrations

Run:

```bash
npm run db:migrate
```

Expected result:

- Liquibase runs database changesets.
- The command says the update was successful, or reports that there are no pending changes.

Check migration status:

```bash
npm run db:status
```

## Load Demo Data

Demo data lets you see the application working before importing real cemetery data.

Run:

```bash
npm run db:seed:demo
```

Expected result:

- Demo cemeteries, sections, lots, gravesites, burials, headstones, users, and lookup values are inserted or refreshed.
- The command exits without an error.

Demo data is allowed in DEV, TEST, and STAGE only. It is blocked in PROD.

## Start The Application

Run:

```bash
npm run dev
```

Expected result:

- The API starts on `http://127.0.0.1:3001`.
- The web app starts on `http://127.0.0.1:5173`.
- The terminal stays busy while the app is running. Leave it open.

Open this exact address in your browser:

```text
http://127.0.0.1:5173
```

For the basic local demo, Auth0 is not required. The app can run with local disabled-auth behavior so you can verify the map and workflows first.

## Confirm The Demo Works

In the browser:

1. Confirm the page title says `Cemetery Mapping`.
2. Confirm the map loads.
3. Confirm the left panel shows cemetery records or search results.
4. Click a gravesite or search result.
5. Confirm the right detail panel shows burial, marker, and cemetery record details.
6. Open Admin if available in the local demo and confirm the admin drawer opens.

If these work, your local system is running.

## Stop The Application

In the terminal running `npm run dev`, press:

```text
Control + C
```

To stop the database container:

```bash
npm run db:down
```

You do not need to stop the database every time, but stopping it frees local resources.

## Common Problems

### Port 5173 Is Already In Use

Meaning: another Vite frontend is already running.

Mac/Linux/WSL:

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
kill <PID>
```

Windows PowerShell:

```powershell
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

Then run `npm run dev` again.

### Port 3001 Is Already In Use

Meaning: another API process is already running.

Mac/Linux/WSL:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
kill <PID>
```

Windows PowerShell:

```powershell
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Port 5432 Is Already In Use

Meaning: another PostgreSQL service is already using the default DEV database port.

Fix: create `db/env/dev.local.env`:

```text
POSTGRES_PORT=5436
```

Then rerun:

```bash
npm run db:up
```

### Docker Commands Fail

Check that Docker Desktop is open and fully started. On Windows, also confirm Docker Desktop is using the WSL 2 backend.

Run:

```bash
docker ps
```

Expected result: Docker prints a table of running containers. It is okay if the table is empty before starting the database.

### npm Cannot Find package.json

Meaning: the command was run from the wrong folder.

Fix:

```bash
cd /path/to/CemeteryMapping
ls
```

Confirm `package.json` is visible, then rerun the npm command.

### The Browser Shows A Sign-In Screen

For the simplest local demo, you should not need Auth0. If you are intentionally testing Auth0, follow [Auth0 Test Tenant Setup](auth0-test-tenant.md).

If you only want the local demo, stop the app and restart it without Auth0-specific environment variables.

### The Map Loads But Has No Real Cemetery Data

That is normal before real data is imported. The demo seed creates sample data. For real cemetery data, use the one-time cemetery onboarding workflows in [Operator Workflows](operator-workflows.md).

## Next Steps

After the local demo works:

1. Read [Operator Workflows](operator-workflows.md) for regular maintenance and one-time cemetery onboarding.
2. Read [Auth0 Test Tenant Setup](auth0-test-tenant.md) if you need real sign-in behavior.
3. Read [Rebuild Guide](rebuild.md) if you need full validation, rollback testing, or CI-style rebuild confidence.
4. Read [Data Source Register](data-sources.md) before importing real data.
