import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, cleanText } from '../api/news.js';

const originalFetch = global.fetch;

function rss(title, link, date, description = 'A useful summary') {
  return `<?xml version="1.0"?><rss><channel><item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate><description>${description}</description></item></channel></rss>`;
}

test.afterEach(() => {
  global.fetch = originalFetch;
});

test('decodes numeric HTML entities from publisher RSS text', () => {
  assert.equal(cleanText('OpenAI&#8217;s newest model'), 'OpenAI’s newest model');
});

test('combines working feeds, sorts newest first, and reports a partial failure', async () => {
  global.fetch = async (url) => {
    if (url.includes('techcrunch.com')) return new Response('unavailable', { status: 503 });
    if (url.includes('wired.com')) {
      return new Response(rss('Older story', 'https://wired.com/older', 'Fri, 11 Sep 2026 08:00:00 GMT'));
    }
    return new Response(rss('Newer story', 'https://venturebeat.com/newer', 'Sat, 12 Sep 2026 08:00:00 GMT'));
  };

  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.articles.map((article) => article.source), ['VentureBeat', 'WIRED']);
  assert.equal(payload.articles[0].title, 'Newer story');
  assert.equal(payload.warnings.length, 1);
  assert.match(payload.warnings[0], /TechCrunch/);
});

test('returns a readable error when all feeds fail', async () => {
  global.fetch = async () => new Response('unavailable', { status: 503 });

  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.articles.length, 0);
  assert.match(payload.error, /temporarily unavailable/);
  assert.equal(payload.warnings.length, 3);
});
