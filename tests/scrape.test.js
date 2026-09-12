import test from 'node:test';
import assert from 'node:assert/strict';
import { POST, cleanExcerpt } from '../api/scrape.js';

const originalFetch = global.fetch;
const originalApiKey = process.env.FIRECRAWL_API_KEY;

function scrapeRequest(body) {
  return new Request('http://localhost/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.FIRECRAWL_API_KEY;
  else process.env.FIRECRAWL_API_KEY = originalApiKey;
});

test('removes browser-verification and sharing boilerplate from excerpts', () => {
  const markdown = [
    'Checking your Browser…',
    '',
    'Verification failed',
    '',
    '[Share on X](https://example.com/share)',
    '',
    '# Useful article',
    '',
    'The readable article begins here.'
  ].join('\n');

  assert.equal(cleanExcerpt(markdown), '# Useful article\n\nThe readable article begins here.');
});

test('keeps the article body and stops before recommendation sections', () => {
  const markdown = [
    'Promotional banner',
    '# Useful article',
    'The readable article begins here.',
    '## Most Popular',
    'Unrelated recommendation'
  ].join('\n\n');

  assert.equal(cleanExcerpt(markdown), '# Useful article\n\nThe readable article begins here.');
});

test('stops before embedded podcast-player controls', () => {
  const markdown = [
    '# Useful article',
    'The readable article begins here.',
    'AI researchers go full doomer | Equity Podcast',
    '0 seconds of 38 minutes, 5 seconds',
    'Keyboard Shortcuts',
    'Unrelated player and article text'
  ].join('\n\n');

  assert.equal(cleanExcerpt(markdown), '# Useful article\n\nThe readable article begins here.');
});

test('removes shopping-page chrome and stray extraction slashes', () => {
  const markdown = [
    '# Beauty Offers',
    'Available while supplies last.',
    '- \\\\',
    '\\\\',
    'Quicklook\\',
    'Hydrating Face Cream\\',
    '**$39.00** \\'
  ].join('\n');

  assert.equal(
    cleanExcerpt(markdown),
    '# Beauty Offers\n\nAvailable while supplies last.\n\nHydrating Face Cream\n\n**$39.00**'
  );
});

test('stops before expandable and related-content footers', () => {
  const markdown = [
    '# Useful page',
    'The useful content.',
    'Show more',
    '## Related Content:',
    'Unrelated links'
  ].join('\n\n');

  assert.equal(cleanExcerpt(markdown), '# Useful page\n\nThe useful content.');
});

test('rejects non-web URL schemes before calling Firecrawl', async () => {
  delete process.env.FIRECRAWL_API_KEY;
  const response = await POST(scrapeRequest({ url: 'file:///private/example' }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error, /http:\/\/ and https:\/\//);
});

test('rejects local and private-network URLs before calling Firecrawl', async () => {
  delete process.env.FIRECRAWL_API_KEY;
  for (const url of ['http://localhost/page', 'http://127.0.0.1/page', 'http://10.0.0.2/page', 'http://[::1]/page']) {
    const response = await POST(scrapeRequest({ url }));
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.match(payload.error, /private-network|internal/);
  }
});

test('returns a readable error when the server-side key is missing', async () => {
  delete process.env.FIRECRAWL_API_KEY;
  const response = await POST(scrapeRequest({ url: 'https://example.com/article' }));
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.match(payload.error, /FIRECRAWL_API_KEY/);
});

test('scrapes one URL and returns only the normalized page shape', async () => {
  process.env.FIRECRAWL_API_KEY = 'test-secret-key';
  let receivedRequest;
  global.fetch = async (url, options) => {
    receivedRequest = { url, options };
    return Response.json({
      success: true,
      data: {
        markdown: 'Clean article content',
        metadata: {
          title: 'Example article',
          description: 'Example description',
          sourceURL: 'https://www.example.com/article'
        }
      }
    });
  };

  const response = await POST(scrapeRequest({ url: 'https://example.com/article' }));
  const payload = await response.json();
  const sentBody = JSON.parse(receivedRequest.options.body);

  assert.equal(response.status, 200);
  assert.equal(receivedRequest.url, 'https://api.firecrawl.dev/v2/scrape');
  assert.equal(receivedRequest.options.headers.Authorization, 'Bearer test-secret-key');
  assert.deepEqual(sentBody.formats, ['markdown']);
  assert.equal(sentBody.url, 'https://example.com/article');
  assert.deepEqual(Object.keys(payload.page), ['title', 'domain', 'url', 'description', 'content']);
  assert.equal(JSON.stringify(payload).includes('test-secret-key'), false);
});

test('turns a Firecrawl failure into a retryable message', async () => {
  process.env.FIRECRAWL_API_KEY = 'test-secret-key';
  global.fetch = async () => Response.json({ success: false, error: 'Rate limited' }, { status: 429 });

  const response = await POST(scrapeRequest({ url: 'https://example.com/article' }));
  const payload = await response.json();

  assert.equal(response.status, 429);
  assert.match(payload.error, /busy|usage limit/);
});
