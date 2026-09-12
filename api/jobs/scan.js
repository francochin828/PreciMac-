import { validateWebUrl } from '../scrape.js';

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape';
const MAX_SOURCES = 5;
const MAX_JOBS_PER_SOURCE = 8;
const REQUEST_TIMEOUT_MS = 115_000;

export const config = { maxDuration: 120 };

const STRING_FIELDS = ['title', 'employer', 'location', 'jobUrl', 'postedDate', 'employmentType', 'description'];
const ARRAY_FIELDS = ['juniorEvidence', 'transferableSkills', 'futureRelevantSignals', 'learningSignals', 'seniorityWarnings'];
const EARLY_SIGNALS = [
  'junior', 'graduate', 'entry-level', 'entry level', 'trainee', 'internship', 'intern',
  'assistant', 'associate', 'coordinator', 'analyst', '0-2 years', '0–2 years',
  'no prior experience', 'no experience required'
];
const SENIOR_SIGNALS = ['senior', 'lead', 'principal', 'head', 'director', 'executive', '5+ years'];

const JOB_SCHEMA = {
  type: 'object',
  properties: {
    jobs: {
      type: 'array',
      maxItems: MAX_JOBS_PER_SOURCE,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          employer: { type: 'string' },
          location: { type: 'string' },
          jobUrl: { type: 'string' },
          postedDate: { type: 'string' },
          employmentType: { type: 'string' },
          description: { type: 'string' },
          juniorEvidence: { type: 'array', items: { type: 'string' } },
          transferableSkills: { type: 'array', items: { type: 'string' } },
          futureRelevantSignals: { type: 'array', items: { type: 'string' } },
          learningSignals: { type: 'array', items: { type: 'string' } },
          seniorityWarnings: { type: 'array', items: { type: 'string' } }
        },
        required: [...STRING_FIELDS, ...ARRAY_FIELDS],
        additionalProperties: false
      }
    }
  },
  required: ['jobs'],
  additionalProperties: false
};

const EXTRACTION_PROMPT = `Extract up to ${MAX_JOBS_PER_SOURCE} job opportunities visibly listed on this exact page. Focus on actual job postings, not navigation or promotional content. For each job return title, employer, location, direct job URL if visible, date, employment type, a short factual description, evidence that it is junior/graduate/entry-level, transferable skills, future-relevant technology/digital/data/policy/innovation signals, learning/training signals, and any evidence that the role is actually senior. Copy short evidence phrases exactly from the visible page text so they can be verified. Use empty strings or arrays when evidence is unavailable. Do not infer unsupported facts.`;

function cleanString(value, limit = 500) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

function cleanArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanString(item, 180)).filter(Boolean))].slice(0, 6);
}

function normalizedText(value) {
  return cleanString(value, 100_000).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isVisibleEvidence(value, pageText) {
  const needle = normalizedText(value);
  return Boolean(needle && pageText.includes(needle));
}

function findGroundedJobUrl(markdown, title, sourceUrl, pageLinks) {
  const normalizedTitle = normalizedText(title);
  const links = String(markdown || '').matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);

  for (const match of links) {
    const label = normalizedText(match[1]);
    if (!label || (!label.includes(normalizedTitle) && !normalizedTitle.includes(label))) continue;
    try {
      const resolved = new URL(match[2], sourceUrl);
      if (['http:', 'https:'].includes(resolved.protocol) && pageLinks.has(resolved.href)) return resolved.href;
    } catch {
      // Ignore malformed extracted links.
    }
  }

  return sourceUrl;
}

function normalizeJob(rawJob, sourceUrl, sourceDomain, markdown, pageLinks) {
  if (!rawJob || typeof rawJob !== 'object') return null;

  const job = Object.fromEntries(STRING_FIELDS.map((field) => [field, cleanString(rawJob[field])]));
  const pageText = normalizedText(markdown);
  if (!job.title || !isVisibleEvidence(job.title, pageText)) return null;

  ['employer', 'location', 'postedDate', 'employmentType', 'description'].forEach((field) => {
    if (!isVisibleEvidence(job[field], pageText)) job[field] = '';
  });

  ARRAY_FIELDS.forEach((field) => {
    job[field] = cleanArray(rawJob[field]).filter((item) => isVisibleEvidence(item, pageText));
  });

  job.jobUrl = findGroundedJobUrl(markdown, job.title, sourceUrl, pageLinks);

  return { ...job, sourceUrl, sourceDomain };
}

function uniqueEvidence(items) {
  return [...new Set(items.map((item) => cleanString(item, 180)).filter(Boolean))];
}

function detectSignals(job) {
  const searchable = `${job.title} ${job.description}`.toLowerCase();
  const juniorEvidence = uniqueEvidence([
    ...job.juniorEvidence,
    ...EARLY_SIGNALS.filter((signal) => searchable.includes(signal)).map((signal) => `The listing uses “${signal}”.`)
  ]);
  const seniorityWarnings = uniqueEvidence([
    ...job.seniorityWarnings,
    ...SENIOR_SIGNALS.filter((signal) => searchable.includes(signal)).map((signal) => `The listing uses “${signal}”.`)
  ]);

  return { juniorEvidence, seniorityWarnings };
}

function scoreJob(job) {
  const { juniorEvidence, seniorityWarnings } = detectSignals(job);
  const early = Math.min(40, juniorEvidence.length * 16);
  const skills = Math.min(30, job.transferableSkills.length * 8);
  const future = Math.min(20, job.futureRelevantSignals.length * 7);
  const learning = Math.min(10, job.learningSignals.length * 5);
  const seniorPenalty = Math.min(60, seniorityWarnings.length * 30);
  return { score: Math.max(0, early + skills + future + learning - seniorPenalty), juniorEvidence, seniorityWarnings };
}

function evidenceSentence(items, fallback) {
  if (!items.length) return fallback;
  return items.slice(0, 2).join(' ');
}

function rankJobs(jobs) {
  const deduplicated = new Map();

  jobs.forEach((job) => {
    const scored = scoreJob(job);
    const key = `${job.title}|${job.employer}|${job.location}`.toLowerCase();
    const candidate = { ...job, ...scored };
    const current = deduplicated.get(key);
    if (!current || candidate.score > current.score) deduplicated.set(key, candidate);
  });

  return [...deduplicated.values()]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 5)
    .map((job, index) => ({
      rank: index + 1,
      title: job.title,
      employer: job.employer,
      location: job.location,
      jobUrl: job.jobUrl,
      sourceUrl: job.sourceUrl,
      sourceDomain: job.sourceDomain,
      postedDate: job.postedDate,
      employmentType: job.employmentType,
      score: job.score,
      reasons: [
        {
          heading: 'Accessible start',
          text: evidenceSentence(job.juniorEvidence, 'No explicit junior-access signal was extracted; review the requirements carefully.')
        },
        {
          heading: 'Skills you can build',
          text: evidenceSentence(job.transferableSkills, 'No specific transferable skill was visible in the extracted listing.')
        },
        {
          heading: 'Career exposure',
          text: evidenceSentence(
            [...job.futureRelevantSignals, ...job.learningSignals],
            'No specific future-facing or learning signal was visible in the extracted listing.'
          )
        }
      ]
    }));
}

function validateUrls(value) {
  if (!Array.isArray(value)) throw new Error('Provide job-page URLs in an array.');
  if (value.length < 1 || value.length > MAX_SOURCES) throw new Error('Provide between 1 and 5 job-page URLs.');

  const urls = [];
  const seen = new Set();
  value.forEach((item) => {
    const url = validateWebUrl(item);
    const key = url.href;
    if (!seen.has(key)) {
      seen.add(key);
      urls.push(url);
    }
  });
  return urls;
}

async function extractSource(url, apiKey) {
  const sourceDomain = url.hostname.replace(/^www\./, '');

  try {
    const response = await fetch(FIRECRAWL_SCRAPE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url.href,
        formats: ['markdown', 'links', { type: 'json', prompt: EXTRACTION_PROMPT, schema: JOB_SCHEMA }],
        onlyMainContent: true,
        timeout: 110_000
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // Handled as an extraction failure below.
    }

    if (!response.ok || !payload.success || !payload.data) {
      return {
        source: { url: url.href, domain: sourceDomain, status: 'could_not_extract', message: 'This page could not be cleanly extracted. Try another public job page.', count: 0 },
        jobs: []
      };
    }

    const rawJobs = Array.isArray(payload.data.json?.jobs) ? payload.data.json.jobs : [];
    const markdown = typeof payload.data.markdown === 'string' ? payload.data.markdown : '';
    const pageLinks = new Set(
      (Array.isArray(payload.data.links) ? payload.data.links : [])
        .map((link) => {
          try {
            return new URL(link, url.href).href;
          } catch {
            return '';
          }
        })
        .filter(Boolean)
    );
    const jobs = rawJobs
      .slice(0, MAX_JOBS_PER_SOURCE)
      .map((job) => normalizeJob(job, url.href, sourceDomain, markdown, pageLinks))
      .filter(Boolean);

    return {
      source: {
        url: url.href,
        domain: sourceDomain,
        status: jobs.length ? 'extracted' : 'no_jobs_found',
        message: jobs.length ? `${jobs.length} visible ${jobs.length === 1 ? 'role' : 'roles'} extracted.` : 'No usable job listings were found on this page.',
        count: jobs.length
      },
      jobs
    };
  } catch {
    return {
      source: { url: url.href, domain: sourceDomain, status: 'could_not_extract', message: 'This page could not be cleanly extracted. Try another public job page.', count: 0 },
      jobs: []
    };
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'The request body must be valid JSON.' }, { status: 400 });
  }

  let urls;
  try {
    urls = validateUrls(body?.urls);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Job Scout is not configured yet. Add FIRECRAWL_API_KEY and try again.' }, { status: 503 });
  }

  const results = await Promise.all(urls.map((url) => extractSource(url, apiKey)));
  const sources = results.map((result) => result.source);
  const jobs = rankJobs(results.flatMap((result) => result.jobs));

  if (sources.every((source) => source.status === 'could_not_extract')) {
    return Response.json(
      { error: 'None of the supplied pages could be cleanly extracted. Try another public job page.', sources, jobs: [] },
      { status: 502 }
    );
  }

  return Response.json({ sources, jobs });
}

export { JOB_SCHEMA, extractSource, rankJobs, validateUrls };
