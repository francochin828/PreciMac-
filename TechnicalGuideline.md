# Precimac Technical Guidelines

## Approved architecture

Precimac is a static, local-first web application:

- HTML for document structure
- CSS for presentation
- Vanilla JavaScript modules for behavior
- A bundled JSON file for ingredient data
- A browser-ready local mirror so direct-file use requires no network fetch
- `localStorage` for saved meals
- Static hosting on Vercel

Firecrawl is intentionally excluded. The application does not need live scraping, a backend, authentication, a database, or an external nutrition API for its current scope.

## Stable data contracts

Macro targets and totals use this shape:

```js
{
  calories: number,
  protein: number,
  carbs: number,
  fats: number
}
```

Each ingredient record contains:

```js
{
  id: string,
  name: string,
  category: string,
  servingGrams: number,
  calories: number,
  protein: number,
  carbs: number,
  fats: number,
  tags: string[]
}
```

Saved meals use the versioned browser key `precimac.savedMeals.v1`. Changing the stored shape requires either a migration or a new versioned key.

## Timeframe rules

- Meal: 0.25 days and 1 meal occurrence
- Day: 1 day and 4 meal occurrences
- Week: 7 days and 28 meal occurrences
- Month: 30 days and 120 meal occurrences

These values are product assumptions and must remain covered by tests if changed.

## Security and privacy

- Never commit secrets or production environment files.
- Keep `.env.local`, `.env.*.local`, and `.vercel/` ignored.
- Do not put API keys in browser JavaScript.
- Treat local JSON and user-entered text as untrusted input.
- Prefer safe DOM APIs such as `textContent`; do not render user content with `innerHTML`.
- Saved meal data remains on the user's device unless the product scope explicitly changes.

## Dependency policy

The current application has no runtime or development package dependencies. Add one only when its benefit clearly exceeds the maintenance, security, bundle-size, and cost impact. Do not add external services for functionality already supported locally.

## Verification

Before shipping a change, run:

```sh
pnpm check
pnpm test
```

The test suite must cover macro calculations, browser-facing contracts, and the architectural guardrails above.
