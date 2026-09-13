# Precimac Project Guidelines

## Product purpose

Precimac is a focused nutrition-planning tool. A user sets macro targets, builds a meal from a curated ingredient dataset, sees live nutrition totals, scales the meal into a grocery plan, and can save the setup in the browser.

The project should remain useful without accounts, API keys, or third-party services.

## Product scope

Included:

- Manual and quick-calculated macro targets
- A one-question-at-a-time guided calorie calculator
- A curated local ingredient dataset
- Dietary filters and preparation notes
- A meal builder with live macro totals and goal indicators
- Meal, daily, weekly, and monthly grocery quantities
- Clipboard export
- Saved meals stored in the user's browser
- Automatic meal generation from macro targets
- Chinese-language, editable grocery baskets
- An exclusive Dingdong Maicai checkout adapter boundary

Not included:

- Delivery-service scraping
- Fake checkout through search links or private app routes
- Barcode scanning or image recognition
- User accounts or authentication
- A hosted database
- External nutrition APIs
- Firecrawl or any other web-scraping service
- Heavy frontend frameworks

The static MVP prepares the complete basket locally. Dingdong Maicai is the only planned retailer integration. Real checkout may only be enabled through its approved API or embedded checkout; it must never be simulated with a search link.

## Project map

- `index.html`: page structure and accessible controls
- `style.css`: visual design and responsive layout
- `script.js`: user interactions, rendering, and browser persistence
- `macro-engine.js`: pure calculation and validation logic
- `data/ingredients.json`: bundled ingredient and nutrition data
- `data/ingredients.js`: browser-ready mirror used for direct-file startup
- `tests/`: behavior and architecture regression tests

## Product contracts

- Nutrition targets use calories, protein, carbohydrates, and fats.
- Ingredient nutrition values are expressed per configured serving size.
- The interface recalculates totals immediately when a meal changes.
- Saved meals stay on the current device and browser profile.
- The core experience must work from the repository's static files when served over HTTP.

## Delivery phases

- Phase 0 — Complete: static deployment pipeline and Precimac identity.
- Phase 1 — Complete: macro engine, meal builder, goal indicators, shopping list, dietary filters, and saved meals.
- Phase 2 — Excluded by product decision: the proposed Firecrawl Web Explorer is not part of Precimac.
- Phase 3 — Complete: performance, resilience, accessibility, responsive mobile behavior, and release readiness.

Any later expansion beyond these boundaries should be an explicit product decision, not an incidental dependency.
