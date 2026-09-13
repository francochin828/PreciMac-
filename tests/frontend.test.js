import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('Phase 0 uses the required Precimac identity', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /<title>Precimac \(精点\) — High Precision Nutrition Engine<\/title>/);
  assert.match(html, /id="page-title"/);
});

test('Phase 1 includes both target flows and the complete local meal workflow', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const script = await readFile(new URL('script.js', root), 'utf8');
  const data = JSON.parse(await readFile(new URL('data/ingredients.json', root), 'utf8'));
  assert.match(html, /I know my macros/);
  assert.match(html, /Calculate for me/);
  assert.match(html, /name="timeframe" value="month"/);
  assert.match(html, /High protein only/);
  assert.match(html, /id="ingredient-grid"/);
  assert.match(html, /id="copy-list"/);
  assert.match(html, /id="saved-meals"/);
  assert.ok(data.length >= 12);
  assert.match(script, /localStorage\.setItem/);
  assert.match(script, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(script, /innerHTML/);
});

test('the interface provides responsive, accessible, reduced-motion styling', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const css = await readFile(new URL('style.css', root), 'utf8');
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /class="skip-link"/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
});

test('the static app contains no scraping or external API integration', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const script = await readFile(new URL('script.js', root), 'utf8');
  assert.doesNotMatch(`${html}\n${script}`, /Firecrawl|FIRECRAWL|\/api\//i);
});
