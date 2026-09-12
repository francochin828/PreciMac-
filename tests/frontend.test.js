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
