# ADR 0078: Application Coordination Boundaries

Status: Accepted

`useApplicationData` owns initial map, identity, and editing-option loading and lookup retry. `useCemeteryScope` owns the scope, cemetery choices, filtered map data, and label. `selectionPermissions` provides a pure, tested permission calculation. App retains selection, navigation, dialogs, and mutation coordination. Lazy screen boundaries and draft guards remain intact.

Replace source-format regular-expression checks for targeted refresh with browser tests invoking actual mutations through mocked API boundaries and asserting resulting state and requests. Retain pure state-helper tests and delayed-save/UI regressions. Refactors no longer need to preserve variable names or formatting for those checks.

Validation: permission unit tests, behavioral mutation browser tests, loading/retry/selection/draft/permission regressions, and TEST build.
