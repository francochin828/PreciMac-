const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape';
const CONTENT_LIMIT = 2_600;
const REQUEST_TIMEOUT_MS = 25_000;

function validateWebUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('A page URL is required.');
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid webpage URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http:// and https:// webpage URLs are allowed.');
  }

  if (url.username || url.password) {
    throw new Error('URLs containing usernames or passwords are not allowed.');
  }

  return url;
}

function readableFirecrawlError(status, payload) {
  if (status === 429) return 'Firecrawl is busy or has reached its usage limit.';
  if (status === 401 || status === 403) return 'Firecrawl authorization failed.';
  return payload?.error || 'Firecrawl could not retrieve this page.';
}

function cleanExcerpt(markdown) {
  const boilerplate = /^(checking your browser|verifying|stuck\?|success!?$|verification (failed|expired)|refresh$|troubleshoot$|cloudflare|privacy\s*[•|]|close$|skip to content|share on |share over email|copy share link|image credits:)/i;
  const pageChrome = /^(quicklook|sign in|create account|enable accessibility|open accessibility menu)$/i;
  const stopContent = /^(#{1,3}\s*)?(most popular|topics|related stories|related content:?|you may also like)$|^show (more|less)$|^_?when you purchase|^loading the next article|^recaptcha|\|\s*[^|]{0,60}podcast$|^\d+\s+seconds? of \d+\s+minutes?/i;
  let lines = String(markdown || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\\*$/g, '').replace(/\\+$/g, '').trim())
    .filter((line) => line && !/^[-*]?\s*\\+$/.test(line) && !/^[-*]$/.test(line))
    .filter((line) => !boilerplate.test(line) && !pageChrome.test(line));

  const articleHeading = lines.findIndex((line) => /^#\s+/.test(line));
  if (articleHeading > 0) lines = lines.slice(articleHeading);

  const stopIndex = lines.findIndex((line, index) => index > 0 && stopContent.test(line));
  if (stopIndex > 0) lines = lines.slice(0, stopIndex);

  return lines
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, CONTENT_LIMIT);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'The request body must be valid JSON.' }, { status: 400 });
  }

  let requestedUrl;
  try {
    requestedUrl = validateWebUrl(body?.url);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'Deep Read is not configured yet. Add FIRECRAWL_API_KEY and try again.' },
      { status: 503 }
    );
  }

  let firecrawlResponse;
  try {
    firecrawlResponse = await fetch(FIRECRAWL_SCRAPE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: requestedUrl.href,
        formats: ['markdown'],
        onlyMainContent: true,
        removeBase64Images: true,
        timeout: 20_000
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch {
    return Response.json(
      { error: 'Firecrawl is temporarily unreachable.' },
      { status: 502 }
    );
  }

  let payload = {};
  try {
    payload = await firecrawlResponse.json();
  } catch {
    // The readable status-based error below handles non-JSON upstream responses.
  }

  if (!firecrawlResponse.ok || !payload.success || !payload.data) {
    return Response.json(
      { error: readableFirecrawlError(firecrawlResponse.status, payload) },
      { status: firecrawlResponse.status === 429 ? 429 : 502 }
    );
  }

  const metadata = payload.data.metadata || {};
  const resultUrl = metadata.sourceURL || metadata.url || requestedUrl.href;
  const resultDomain = new URL(resultUrl).hostname.replace(/^www\./, '');

  return Response.json({
    page: {
      title: metadata.title || requestedUrl.hostname,
      domain: resultDomain,
      url: resultUrl,
      description: metadata.description || '',
      content: cleanExcerpt(payload.data.markdown)
    }
  });
}

export { cleanExcerpt, validateWebUrl };
