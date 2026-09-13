# Project Guideline — AI News Briefing

## Purpose

AI News Briefing is a small, deployable vanilla-JavaScript application for three related tasks: loading current AI news from prepared RSS feeds, retrieving a readable excerpt from one public web page, and comparing up to five public job-listing pages to recommend junior opportunities. It deploys as a Vercel-style static frontend with serverless API routes.

This is a guide for Codex to work safely in the existing project. It is intentionally organised into three phases: understand before changing, make one scoped change, then prove and hand over the result. Do not treat the phases as product-roadmap features; all current features already exist.

## Project Map

| Area | Files | Responsibility |
| --- | --- | --- |
| Browser UI# Project Guideline — AI News Briefing

## Purpose

AI News Briefing is a small, deployable vanilla-JavaScript application for three related tasks: loading current AI news from prepared RSS feeds, retrieving a readable excerpt from one public web page, and comparing up to five public job-listing pages to recommend junior opportunities. It deploys as a Vercel-style static frontend with serverless API routes.

This is a guide for Codex to work safely in the existing project. It is intentionally organised into three phases: understand before changing, make one scoped change, then prove and hand over the result. Do not treat the phases as product-roadmap features; all current features already exist.

## Project Map

| Area | Files | Responsibility |
| --- | --- | --- |
| Browser UI | `index.html`, `style.css`, `script.js` | Markup, styling, event wiring, safe DOM rendering, and browser calls to local API routes. |
| News route | `api/news.js` | Fetches, parses, normalizes, sorts, and partially tolerates failures from the three RSS feeds. |
| Page retrieval route | `api/scrape.js` | Validates public URLs, calls Firecrawl server-side, removes boilerplate, and returns a normalized page. |
| Job-scanning route | `api/jobs/scan.js` | Validates 1–5 public job pages, extracts grounded records, ranks them, and reports per-source outcomes. |
| Regression suite | `tests/*.test.js` | Node built-in tests for route behavior, safety boundaries, and essential frontend structure. |
| Project commands | `package.json` | `pnpm check` for syntax; `pnpm test` for regression tests. |

## Phase 1 — Familiarize and Baseline

Do this before editing a feature or fixing a defect.

1. Read this file and `TechnicalGuideline.md`, then inspect the smallest relevant source file and its matching test file.
2. Check `git status --short`; preserve unrelated user changes and untracked files.
3. State the requested outcome, the current behavior, and the smallest likely file set. Do not alter an interface or contract without explaining why.
4. Run the relevant tests first. For cross-cutting work, run `pnpm check` and `pnpm test` to establish a baseline.
5. Identify the correct seam: RSS work belongs in `api/news.js`; public-page retrieval belongs in `api/scrape.js`; job comparison belongs in `api/jobs/scan.js`; interaction and rendering belong in `script.js`; presentation belongs in `style.css`.

**Exit condition:** the requested change, affected contract, risks, and baseline test result are known.

## Phase 2 — Implement One Focused Change

1. Work only on the requested behavior. Do not combine cleanup, redesign, new dependencies, or a later feature with the task.
2. Make the smallest additive change at the established seam. Preserve existing route paths, element IDs, response fields, and user-visible behavior unless the request explicitly requires a breaking change.
3. Keep secrets on the server. Browser files may call `/api/...` but must never contain Firecrawl credentials or access server environment variables.
4. For untrusted text, use DOM creation and `textContent`/`replaceChildren`; do not introduce `innerHTML`.
5. Add or update a focused regression test for behavior that could otherwise recur. Keep the existing tests meaningful rather than merely changing their assertions to fit an unintended result.
6. Keep errors actionable and safe: return or render a short retry-oriented message, never a stack trace, credential, raw upstream payload, or private URL.

**Exit condition:** the requested behavior is implemented, scoped tests cover it, and no unrelated product area was changed.

## Phase 3 — Verify and Hand Off

1. Run `pnpm check` and `pnpm test` after the change. Resolve failures caused by the work; report pre-existing failures separately.
2. Perform a targeted manual check when UI behavior, loading state, responsive layout, or an external route is involved. Check the success path and the relevant empty/error path.
3. Review the diff for accidental secrets, unrelated edits, contract drift, and unsafe DOM or network behavior.
4. Report: requested outcome, files changed, behavior verified, commands run and their results, dependencies added (normally none), and any limitation or required configuration.
5. Stop after the requested phase. Do not silently start the next enhancement.

**Exit condition:** the result is verified proportionally to risk and can be understood by the next Codex session without rediscovering the project.

## Phase Guard Prompt

Use this at the beginning of each future task:

> Read `ProjectGuideline.md` and `TechnicalGuideline.md`. State the requested outcome, the affected contract or seam, and the smallest files expected to change. Confirm whether the task changes a protected interface. Implement only that scoped work, add or update focused tests, run the required checks, summarize the result, and stop.

 | `index.html`, `style.css`, `script.js` | Markup, styling, event wiring, safe DOM rendering, and browser calls to local API routes. |
| News route | `api/news.js` | Fetches, parses, normalizes, sorts, and partially tolerates failures from the three RSS feeds. |
| Page retrieval route | `api/scrape.js` | Validates public URLs, calls Firecrawl server-side, removes boilerplate, and returns a normalized page. |
| Job-scanning route | `api/jobs/scan.js` | Validates 1–5 public job pages, extracts grounded records, ranks them, and reports per-source outcomes. |
| Regression suite | `tests/*.test.js` | Node built-in tests for route behavior, safety boundaries, and essential frontend structure. |
| Project commands | `package.json` | `pnpm check` for syntax; `pnpm test` for regression tests. |

## Phase 1 — Familiarize and Baseline

Do this before editing a feature or fixing a defect.

1. Read this file and `TechnicalGuideline.md`, then inspect the smallest relevant source file and its matching test file.
2. Check `git status --short`; preserve unrelated user changes and untracked files.
3. State the requested outcome, the current behavior, and the smallest likely file set. Do not alter an interface or contract without explaining why.
4. Run the relevant tests first. For cross-cutting work, run `pnpm check` and `pnpm test` to establish a baseline.
5. Identify the correct seam: RSS work belongs in `api/news.js`; public-page retrieval belongs in `api/scrape.js`; job comparison belongs in `api/jobs/scan.js`; interaction and rendering belong in `script.js`; presentation belongs in `style.css`.

**Exit condition:** the requested change, affected contract, risks, and baseline test result are known.

## Phase 2 — Implement One Focused Change

1. Work only on the requested behavior. Do not combine cleanup, redesign, new dependencies, or a later feature with the task.
2. Make the smallest additive change at the established seam. Preserve existing route paths, element IDs, response fields, and user-visible behavior unless the request explicitly requires a breaking change.
3. Keep secrets on the server. Browser files may call `/api/...` but must never contain Firecrawl credentials or access server environment variables.
4. For untrusted text, use DOM creation and `textContent`/`replaceChildren`; do not introduce `innerHTML`.
5. Add or update a focused regression test for behavior that could otherwise recur. Keep the existing tests meaningful rather than merely changing their assertions to fit an unintended result.
6. Keep errors actionable and safe: return or render a short retry-oriented message, never a stack trace, credential, raw upstream payload, or private URL.

**Exit condition:** the requested behavior is implemented, scoped tests cover it, and no unrelated product area was changed.

## Phase 3 — Verify and Hand Off

1. Run `pnpm check` and `pnpm test` after the change. Resolve failures caused by the work; report pre-existing failures separately.
2. Perform a targeted manual check when UI behavior, loading state, responsive layout, or an external route is involved. Check the success path and the relevant empty/error path.
3. Review the diff for accidental secrets, unrelated edits, contract drift, and unsafe DOM or network behavior.
4. Report: requested outcome, files changed, behavior verified, commands run and their results, dependencies added (normally none), and any limitation or required configuration.
5. Stop after the requested phase. Do not silently start the next enhancement.

**Exit condition:** the result is verified proportionally to risk and can be understood by the next Codex session without rediscovering the project.

## Phase Guard Prompt

Use this at the beginning of each future task:

> Read `ProjectGuideline.md` and `TechnicalGuideline.md`. State the requested outcome, the affected contract or seam, and the smallest files expected to change. Confirm whether the task changes a protected interface. Implement only that scoped work, add or update focused tests, run the required checks, summarize the result, and stop.

