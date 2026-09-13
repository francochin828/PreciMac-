# Precimac Technical Guidelines

## Approved architecture

Precimac is a local-first web application with one narrow serverless integration:

- HTML for document structure
- CSS for presentation
- Ordered vanilla JavaScript files for behavior and direct-file compatibility
- A bundled JSON file for ingredient data
- A browser-ready local mirror so direct-file use requires no network fetch
- `localStorage` for saved meals
- Static hosting on Vercel
- A Vercel Function that proxies and normalizes USDA FoodData Central search

Firecrawl and live scraping remain intentionally excluded. The application has no authentication or hosted database. USDA FoodData Central is the sole approved external nutrition API; all other planning still works from bundled data.

The Dingdong Maicai checkout control is an explicit integration boundary. It remains disabled until an approved retailer API can create a real cart. Browser code must not contain retailer credentials or claim that a search or deep link populated a cart.

The guided calculator uses the adult Mifflin–St Jeor resting-energy equation, an explicit activity factor, and a visible goal-pace adjustment. Its result is an estimate, not medical advice, and the interface must recommend checking it against real results over time.

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

Each ingredient record contains the core fields below. USDA imports also include `source: 'USDA'`, `fdcId`, and `dataType`.

```js
{
  id: string,
  name: string,
  nameZh: string,
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
- Read `USDA_API_KEY` only in the serverless function; the browser calls `/api/foods/search`.
- Validate search length, return only normalized fields, and never log or return the USDA key.
- Treat local JSON and user-entered text as untrusted input.
- Prefer safe DOM APIs such as `textContent`; do not render user content with `innerHTML`.
- Saved meal data remains on the user's device unless the product scope explicitly changes.

## Dependency policy

The current application has no runtime or development package dependencies. The USDA integration uses the platform's built-in `fetch`. Add a dependency only when its benefit clearly exceeds the maintenance, security, bundle-size, and cost impact.

## Verification

Before shipping a change, run:

```sh
pnpm check
pnpm test
```

The test suite must cover macro calculations, browser-facing contracts, and the architectural guardrails above.
