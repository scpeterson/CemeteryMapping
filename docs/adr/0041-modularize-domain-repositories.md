---
---

# ADR 0041: Modularize Large Domain Repositories Behind Stable Facades

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-19

## Context

As reporting, North Hills review, media, ownership, and cemetery workflows expanded, several server repository modules accumulated unrelated queries, mutations, validation rules, and response mapping. Large single files made ownership boundaries harder to see and increased the chance that a focused change would disturb an unrelated workflow.

Callers already depend on established repository module paths. Splitting internal concerns should improve maintainability without forcing route registration, tests, or other consumers to change imports at the same time.

## Decision

Organize large server domains into focused modules by responsibility while retaining a stable facade at the established repository path.

Use these boundaries where they fit the domain:

- read/query families;
- mutation families;
- row-to-API mapping and normalization;
- validation and shared domain helpers.

The facade re-exports the supported public functions. Internal modules may live in a domain directory such as `server/reports/`, `server/northHillsReview/`, or `server/media/`. Route modules and external repository consumers should import from the facade unless they are specifically testing an internal concern.

The current implementation applies this pattern to report query families, North Hills source-fact mutations, and media validation/mapping/storage-path helpers. Frontend API clients and type definitions use the same domain-oriented principle, with compatibility exports retained where existing callers need them.

## Rationale

Stable facades decouple structural refactoring from API behavior. Focused files make transaction boundaries, query ownership, validation, and mapping easier to review while avoiding a broad import migration in every consumer. Domain directories also provide a predictable home for later functionality without recreating one monolithic repository.

## Consequences

Repository splits must preserve public exports and response shapes unless a separate contract change is intentional. Shared helpers should be extracted only when they represent one clear domain rule; generic utility modules should not become new catch-all files.

Tests should continue exercising public facade imports. Focused tests may import internal modules when they verify an isolated mapper or mutation family. Circular imports between a facade and its internal modules are not allowed.

File size alone does not require a split. The trigger is the presence of separable responsibilities that can be named, tested, and changed independently.

## Rebuild And Validation

Run:

```bash
npm run lint
npm run test:server
npm run build
```

Confirm route-registration tests still expose the same method/path contracts and repository tests still pass through the stable facade exports.

## Update Triggers

Update this ADR if repository consumers begin importing internal modules by default, facade compatibility is removed, a different domain-boundary strategy is adopted, or server persistence moves away from the current repository pattern.
