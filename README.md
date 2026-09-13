# Precimac (精点)

Precimac is a vanilla-JavaScript nutrition planning app. It turns daily macro targets into a repeatable meal, timeframe-scaled grocery list, and locally saved meal setup.

## Features

- Manual or quick-calculated macro targets
- Local ingredient and macro dataset
- Dietary filters and custom prep notes
- Live meal totals and goal indicators
- One-meal, daily, weekly, and monthly shopping quantities
- One-click clipboard output
- Browser `localStorage` meal saving and loading

## Run locally

Serve the repository with any static development server. The nutrition planner has no server, API key, or external data dependency.

## Architecture guardrails

Precimac uses only vanilla HTML, CSS, JavaScript, a bundled ingredient JSON file, and browser `localStorage`. Firecrawl is intentionally excluded; there is no scraping service, backend, authentication, database, or external nutrition API.

See [ProjectGuideline.md](ProjectGuideline.md) for the product boundaries and [TechnicalGuideline.md](TechnicalGuideline.md) for the stable technical contracts.

## Verify

```sh
pnpm check
pnpm test
```
