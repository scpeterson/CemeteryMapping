---
---

# ADR 0001: Use a Vite React TypeScript Frontend

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: Initial application implementation

## Context

The application needs an interactive browser UI for cemetery staff or maintainers to search grave records, view a cemetery map, filter grave status, and inspect selected grave details. The UI needs to render map geometry, make API calls, and remain straightforward for local development.

## Decision

Use a React single-page application built with Vite and TypeScript.

Core frontend software:

| Software | Version | Purpose |
| --- | --- | --- |
| React | 19.2.8 | Component model and client rendering |
| React DOM | 19.2.8 | Browser DOM renderer for React |
| Vite | 8.1.4 | Development server and production bundler |
| TypeScript | 6.0.3 | Static type checking |
| MapLibre GL JS | 6.0.0 | Interactive web map rendering |
| Lucide React | 1.23.0 | UI icons |

## Rationale

React provides a familiar component model for stateful UI such as search panels, filters, map state, and detail panels. Vite keeps local development fast and keeps build configuration small. TypeScript helps keep API response shapes, map data, and component props explicit as the schema evolves.

MapLibre GL JS was selected because it renders GeoJSON and vector-style map interactions in the browser without requiring a proprietary map SDK. It is suitable for local cemetery geometry and can consume GeoJSON returned by the Express API.

MapLibre GL JS 6 uses an ESM-only distribution and loads its worker module relative to `import.meta.url`. The Vite configuration excludes `maplibre-gl` from dependency optimization so the main module remains beside `maplibre-gl-worker.mjs`; pre-bundling it into `node_modules/.vite/deps` breaks that relative worker lookup.

## Consequences

The UI is easy to run locally with `npm run dev` and build with `npm run build`. Frontend environment modes map to `dev`, `test`, `stage`, and `prod`.

The frontend depends on the API contract in ADR 0005. When API response shapes change, TypeScript types and UI tests must be updated in the same PR.

React and React DOM must be upgraded together to the same release. MapLibre major upgrades must be checked for module-format, worker-loading, browser-target, and WebGL compatibility changes.

## Rebuild Notes

Install dependencies:

```bash
npm ci
```

Run locally against DEV:

```bash
npm run db:up
npm run db:migrate
npm run db:seed:demo
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Build:

```bash
npm run build
npm run build:test
```

Validate UI behavior:

```bash
APP_ENV=test npm run test:e2e
```

## Update Triggers

Update this ADR when the frontend framework, bundler, map renderer, TypeScript version strategy, or environment mode strategy changes.
