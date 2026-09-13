# Precimac Project Guidelines

## Product purpose

Precimac is a focused nutrition-planning tool. A user sets macro targets, builds a meal from a curated ingredient dataset, sees live nutrition totals, scales the meal into a grocery plan, and can save the setup in the browser.

The project should remain useful without accounts, API keys, or third-party services.

## Product scope

Included:

- Manual and quick-calculated macro targets
- A curated local ingredient dataset
- Dietary filters and preparation notes
- A meal builder with live macro totals and goal indicators
- Meal, daily, weekly, and monthly grocery quantities
- Clipboard export
- Saved meals stored in the user's browser

Not included:

- Delivery-service scraping or ordering
- Barcode scanning or image recognition
- User accounts or authentication
- A hosted database
- External nutrition APIs
- Firecrawl or any other web-scraping service
- Heavy frontend frameworks

## Project map

- `index.html`: page structure and accessible controls
- `style.css`: visual design and responsive layout
- `script.js`: user interactions, rendering, and browser persistence
- `macro-engine.js`: pure calculation and validation logic
- `data/ingredients.json`: bundled ingredient and nutrition data
- `tests/`: behavior and architecture regression tests

## Product contracts

- Nutrition targets use calories, protein, carbohydrates, and fats.
- Ingredient nutrition values are expressed per configured serving size.
- The interface recalculates totals immediately when a meal changes.
- Saved meals stay on the current device and browser profile.
- The core experience must work from the repository's static files when served over HTTP.

## Delivery phases

1. Build the working local-first nutrition planner.
2. Lock the architecture and product boundaries with documentation and automated guardrail tests.
3. Improve the curated ingredient catalogue and meal-planning depth without adding external data dependencies.
4. Polish accessibility, mobile behavior, performance, and release readiness.

Any later expansion beyond these boundaries should be an explicit product decision, not an incidental dependency.
