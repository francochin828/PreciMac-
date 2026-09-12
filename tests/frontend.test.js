import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('Phase 2 adds a separate Web Explorer below the RSS results', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const articleListPosition = html.indexOf('id="article-list"');
  const explorerPosition = html.indexOf('id="web-explorer-form"');

  assert.ok(articleListPosition >= 0);
  assert.ok(explorerPosition > articleListPosition);
  assert.match(html, /Explore Any Web Page/);
  assert.match(html, /id="explorer-result"/);
});

test('Web Explorer reuses the scrape route and keeps the secret server-side', async () => {
  const script = await readFile(new URL('script.js', root), 'utf8');

  assert.match(script, /explorerForm\.addEventListener\('submit', exploreWebPage\)/);
  assert.match(script, /fetch\('\/api\/scrape'/);
  assert.doesNotMatch(script, /FIRECRAWL_API_KEY/);
  assert.match(script, /Open Original Page/);
});

test('Phase 3 formats excerpts safely and shortens display URLs', async () => {
  const script = await readFile(new URL('script.js', root), 'utf8');
  const css = await readFile(new URL('style.css', root), 'utf8');

  assert.match(script, /function renderExcerpt/);
  assert.match(script, /function formatDisplayUrl/);
  assert.doesNotMatch(script, /innerHTML/);
  assert.match(script, /Some sources need attention/);
  assert.match(css, /\.rich-content/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /:focus-visible/);
});

test('Phase 4 adds one Job Scout comparison panel below Web Explorer', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const script = await readFile(new URL('script.js', root), 'utf8');
  const css = await readFile(new URL('style.css', root), 'utf8');

  assert.ok(html.indexOf('id="job-scout-form"') > html.indexOf('id="web-explorer-form"'));
  assert.equal((html.match(/class="job-source-input"/g) || []).length, 5);
  assert.match(html, /Top 5 Junior Opportunities/);
  assert.match(script, /fetch\('\/api\/jobs\/scan'/);
  assert.match(script, /Open Job Posting/);
  assert.doesNotMatch(script, /FIRECRAWL_API_KEY/);
  assert.doesNotMatch(script, /innerHTML/);
  assert.match(css, /\.job-card/);
});
