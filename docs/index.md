# Cemetery Mapping Documentation

This site contains the operational and architectural documentation for rebuilding, maintaining, and extending the Cemetery Mapping application.

## Start Here

- [Rebuild Guide](rebuild.md)
- [Architecture Decision Records](adr/)
- [Data Source Register](data-sources.md)
- [Admin Workflow Roadmap](admin-workflows.md)

## Architecture Decisions

The ADR index includes the documentation process, software inventory, and accepted decisions:

- [ADR index](adr/)
- [ADR template](adr/0000-template.md)

Every pull request that changes architecture, schema, import behavior, validation policy, deployment/rebuild behavior, or source data assumptions must add or update an ADR.

## Rebuild Summary

```bash
npm ci
APP_ENV=test npm run db:up
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:rollback:test
APP_ENV=test npm run db:migrate
APP_ENV=test npm run db:seed:demo
npm run lint
npm run build:test
APP_ENV=test npm run test:e2e
```

See the [full rebuild guide](rebuild.md) for prerequisites, real data imports, and validation steps.

## Data Sources

The [Data Source Register](data-sources.md) tracks known source paths, source owners, stewardship placeholders, import commands, and known limitations.
