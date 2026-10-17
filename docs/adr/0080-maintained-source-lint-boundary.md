# ADR 0080: Keep Scratch Work Outside Maintained Source Checks

Status: Accepted

Root `tmp/` holds disposable local investigations and is ignored by Git and ESLint. Reusable tools belong in `scripts/` with tests. Application, server, test, and maintained script sources continue to receive the existing lint rules and Node/browser globals.

Move lazy route composition into an exported ApplicationRoot component, leaving main.tsx as the renderer bootstrap. This removes the Fast Refresh warning without suppressing the rule or changing public request-access routing.

Validation: lint-boundary unit tests confirm scratch ignores and continued error detection in maintained sources; full lint, TEST build, public request-access and authenticated startup browser regressions pass.
