import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';

const FEEDS = [
  { source: 'WIRED', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
  { source: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { source: 'VentureBeat', url: 'https://venturebeat.com/category/ai/feed/' }
];

const ITEMS_PER_SOURCE = 6;
const MAX_ARTICLES = 18;
const FETCH_TIMEOUT_MS = 12_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true
});

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';
  return String(value['#text'] || value['@_href'] || '');
}

function cleanText(value) {
  return textValue(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function stableId(source, url, title) {
  return createHash('sha256').update(`${source}:${url}:${title}`).digest('hex').slice(0, 20);
}

function normalizedDate(item) {
  const rawDate = textValue(item.pubDate || item.isoDate || item.published || item.updated);
  if (!rawDate) return '';

  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function normalizedLink(item) {
  const link = item.link;
  if (Array.isArray(link)) {
    const alternate = link.find((entry) => entry?.['@_rel'] === 'alternate') || link[0];
    return textValue(alternate);
  }
  return textValue(link);
}

function normalizeItem(source, item) {
  const title = cleanText(item.title) || 'Untitled article';
  const url = normalizedLink(item) || textValue(item.guid || item.id);

  if (!url || !/^https?:\/\//i.test(url)) return null;

  return {
    id: stableId(source, url, title),
    source,
    title,
    url,
    publishedAt: normalizedDate(item),
    summary: cleanText(item.description || item.summary || item['content:encoded'])
  };
}

function extractItems(document) {
  const rssItems = document?.rss?.channel?.item;
  const atomEntries = document?.feed?.entry;
  return asArray(rssItems || atomEntries);
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      'User-Agent': 'AI-News-Briefing/1.0'
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`${feed.source} returned HTTP ${response.status}.`);
  }

  const xml = await response.text();
  const items = extractItems(parser.parse(xml));
  if (!items.length) throw new Error(`${feed.source} returned no readable RSS items.`);

  return items
    .map((item) => normalizeItem(feed.source, item))
    .filter(Boolean)
    .slice(0, ITEMS_PER_SOURCE);
}

export async function GET() {
  const settledFeeds = await Promise.allSettled(FEEDS.map(fetchFeed));
  const articles = [];
  const warnings = [];

  settledFeeds.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    } else {
      warnings.push(result.reason?.message || `${FEEDS[index].source} could not be loaded.`);
    }
  });

  articles.sort((first, second) => {
    const firstDate = first.publishedAt ? Date.parse(first.publishedAt) : 0;
    const secondDate = second.publishedAt ? Date.parse(second.publishedAt) : 0;
    return secondDate - firstDate;
  });

  if (!articles.length) {
    return Response.json(
      { articles: [], warnings, error: 'All three RSS feeds are temporarily unavailable.' },
      { status: 502 }
    );
  }

  return Response.json({ articles: articles.slice(0, MAX_ARTICLES), warnings });
}

export { FEEDS, cleanText, fetchFeed };
