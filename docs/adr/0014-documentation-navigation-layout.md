---
---

# ADR 0014: Use a Custom Documentation Layout with Sequential Navigation

- Status: Accepted
- Date: 2026-05-21
- Owners: Project maintainers
- Related changes: TBD

## Context

The GitHub Pages documentation used the default `jekyll-theme-minimal` layout. That made individual pages readable, but navigation was shallow. Maintainers needed an easy way to move through documentation in a deliberate order, especially across rebuild instructions, data-source notes, security notes, and ADRs.

## Decision

Use a custom Jekyll layout under `docs/_layouts/default.html` with:

- A persistent sidebar generated from `docs/_data/navigation.yml`.
- Previous and next page links rendered in the page header and footer.
- A custom stylesheet under `docs/assets/css/style.css`.
- A pinned local documentation build bundle in `docs/Gemfile` and `docs/Gemfile.lock`.

The site can still be served by GitHub Pages from the `docs/` folder. The custom layout replaces the visual behavior of the bundled minimal theme for project documentation pages.

## Rationale

An explicit ordered navigation data file keeps the reading order clear and maintainable. Rendering previous and next links through a shared include avoids manually editing each page. A custom layout gives the project enough control over navigation, readability, and responsive behavior without adding a separate documentation framework.

## Consequences

New documentation pages should be added to `docs/_data/navigation.yml` when they belong in the guided reading order. New ADRs should also be added to `docs/adr/README.md`.

The custom CSS becomes part of the documentation surface and should be reviewed when adding major new documentation sections.

## Rebuild Notes

GitHub Pages should continue to deploy from the `main` branch and `/docs` folder.

The local documentation build currently uses:

- Ruby 3.4.1
- Bundler 2.6.2
- Jekyll 4.4.1
- jekyll-relative-links 0.7.0
- jekyll-seo-tag 2.9.0

Validate locally:

```bash
cd docs
bundle install
bundle exec jekyll build
```

## Update Triggers

Update this ADR when the documentation site changes theme, layout system, navigation ordering, or publishing mechanism.
