# Technical Guideline — AI News Briefing

## Stack and Operating Model

- **Frontend:** semantic HTML, CSS, and plain browser JavaScript in `index.html`, `style.css`, and `script.js`.
- **Backend:** Vercel-compatible serverless route modules in `api/` using Web `Request`, `Response`, `fetch`, and Node 20 APIs.
- **Dependency policy:** `fast-xml-parser` is the only runtime dependency. Do not add a framework, bundler, UI/CSS/state library, linter, or test runner unless the user explicitly approves the need.
- **Testing:** Node's built-in test runner. Run `pnpm check` and `pnpm test` before handoff.
- **Deployment:** Vercel. Server-only configuration uses environment variables, currently `FIRECRAWL_API_KEY`.

## Architecture: Named Seams

Keep responsibilities separate. A change should normally stay inside one seam.

| Seam | Owns | Must not do |
| --- | --- | --- |
| `index.html` | Accessible structure, labels, IDs, and source order | Contain credentials or business logic. |
| `style.css` | Visual presentation, responsive behavior, focus styles | Decide product logic or manipulate content. |
| `script.js` | DOM events, loading/empty/error states, safe rendering, calls to local routes | Use secrets, call Firecrawl directly, or use unsafe HTML injection. |
| `api/news.js` | Prepared RSS feeds and normalized news output | Leak upstream failures as raw errors. |
| `api/scrape.js` | Public URL validation and one-page Firecrawl retrieval | Permit local/private/internal URLs or expose the API key. |
| `api/jobs/scan.js` | Job-source validation, grounded extraction, scoring, and ranked output | Invent evidence or trust model output that is absent from the visible page. |
| `tests/` | Regression evidence for observable behavior and safety guarantees | Make production choices solely to satisfy a brittle string match. |

Extend the inside of the appropriate existing route or rendering function rather than moving responsibilities across files. If a request genuinely needs a new seam, state the contract and add the test before broadening the structure.

## Protected Contracts — Do Not Change Without Explicit Approval

### Browser/API boundaries

- The frontend calls only local paths: `/api/news`, `/api/scrape`, and `/api/jobs/scan`.
- `FIRECRAWL_API_KEY` is read only in server route code through `process.env`; it must never appear in frontend source, commits, logs, error bodies, or returned JSON.
- All user-supplied retrieval URLs must be `http:` or `https:` and must reject localhost, private ranges, and internal hostnames before an upstream fetch. Reuse `validateWebUrl` from `api/scrape.js`.

### Response shapes

Keep keys present with safe empty values (`''` or `[]`) instead of omitting them.

```js
// GET /api/news
{ articles: [{ id, source, title, url, publishedAt, summary }], warnings: [] }

// POST /api/scrape
{ page: { title, domain, url, description, content } }

// POST /api/jobs/scan
{
  sources: [{ url, domain, status, message }],
  jobs: [{
    rank, title, employer, location, jobUrl, sourceUrl, sourceDomain,
    postedDate, employmentType, score,
    reasons: [{ heading, text }, { heading, text }, { heading, text }]
  }]
}
```

- Job results are capped at five. Each rendered job always has exactly three evidence-based reasons.
- A job title, supporting evidence, and job URL must be grounded in visible page output. When a direct posting URL cannot be grounded, retain the source page URL rather than choosing an unrelated link.
- Partial upstream failure is a supported outcome: preserve successful news feeds and job sources while reporting warnings/statuses.

### Frontend structure and safety

- Preserve the element IDs consumed by `script.js`, including `load-news`, `story-filter`, `article-list`, `news-status`, `empty-state`, `deep-read`, `web-explorer-form`, `explorer-result`, `job-scout-form`, `job-source-statuses`, and `job-results`.
- Preserve the visual order: News Radar, Web Explorer, then Junior Job Scout.
- Render all fetched or model-derived content with DOM APIs and `textContent`; do not use `innerHTML`.
- Maintain usable keyboard focus, `aria-live` status updates, disabled controls while requests run, and clear success, empty, error, and loading states.

## Data and Error Handling Rules

1. Normalize upstream data at the route boundary. The frontend should receive stable, display-ready fields rather than parser/vendor-specific shapes.
2. Treat Firecrawl structured extraction as untrusted until checked against visible markdown and extracted links.
3. Use bounded timeouts and result limits. Do not make unbounded fan-out requests or return full upstream documents when an excerpt is sufficient.
4. Prefer partial success over losing all available results. Include a concise warning or per-source status.
5. Return readable, retry-oriented errors. Do not disclose stack traces, raw upstream payloads, internal network details, or credentials.
6. Keep route and frontend state local to the operation; avoid global side effects that make concurrent requests interfere with one another.

## Change Checklist

Before editing:

1. Read `ProjectGuideline.md` and this file.
2. Read the affected module and its tests.
3. Identify whether a protected contract changes; if it does, ask for approval before proceeding.

During implementation:

1. Change the smallest responsible seam.
2. Preserve the public response shape and accessible UI states.
3. Add a regression test for a new edge case, security guard, or user-visible behavior.

Before handoff:

1. Run `pnpm check`.
2. Run `pnpm test`.
3. Inspect the diff for secrets, contract changes, unsafe DOM rendering, and unrelated changes.
4. Report files changed, checks passed/failed, dependencies added, and unresolved limitations.

