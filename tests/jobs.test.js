import test from 'node:test';
import assert from 'node:assert/strict';
import { POST, JOB_SCHEMA, rankJobs } from '../api/jobs/scan.js';

const originalFetch = global.fetch;
const originalApiKey = process.env.FIRECRAWL_API_KEY;

function scanRequest(urls) {
  return new Request('http://localhost/api/jobs/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls })
  });
}

function extractedJob(overrides = {}) {
  return {
    title: 'Graduate Data Analyst',
    employer: 'Example Agency',
    location: 'London',
    jobUrl: '/jobs/graduate-data-analyst',
    postedDate: '2026-09-10',
    employmentType: 'Full time',
    description: 'A graduate role working with public-service data.',
    juniorEvidence: ['Open to recent graduates.'],
    transferableSkills: ['Data analysis', 'Stakeholder communication'],
    futureRelevantSignals: ['Digital public services'],
    learningSignals: ['Structured training'],
    seniorityWarnings: [],
    ...overrides
  };
}

function firecrawlSuccess(jobs) {
  const markdown = jobs.flatMap((job) => [
    job.jobUrl ? `[${job.title}](${job.jobUrl})` : job.title,
    job.employer,
    job.location,
    job.postedDate,
    job.employmentType,
    job.description,
    ...job.juniorEvidence,
    ...job.transferableSkills,
    ...job.futureRelevantSignals,
    ...job.learningSignals,
    ...job.seniorityWarnings
  ]).join('\n');
  const links = jobs.map((job) => job.jobUrl).filter(Boolean).map((jobUrl) => new URL(jobUrl, 'https://jobs.example.gov/search').href);
  return Response.json({ success: true, data: { markdown, links, json: { jobs } } });
}

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.FIRECRAWL_API_KEY;
  else process.env.FIRECRAWL_API_KEY = originalApiKey;
});

test('rejects missing, excessive, malformed, and private source URLs', async () => {
  for (const urls of [
    [],
    Array.from({ length: 6 }, (_, index) => `https://example${index}.com/jobs`),
    ['not a url'],
    ['http://localhost:3000/jobs'],
    ['http://192.168.1.5/jobs']
  ]) {
    const response = await POST(scanRequest(urls));
    assert.equal(response.status, 400);
  }
});

test('scans one source with Firecrawl JSON extraction and exactly three reasons', async () => {
  process.env.FIRECRAWL_API_KEY = 'test-secret-key';
  let firecrawlRequest;
  global.fetch = async (url, options) => {
    firecrawlRequest = { url, options };
    return firecrawlSuccess([extractedJob()]);
  };

  const response = await POST(scanRequest(['https://jobs.example.gov/search']));
  const payload = await response.json();
  const body = JSON.parse(firecrawlRequest.options.body);

  assert.equal(response.status, 200);
  assert.equal(firecrawlRequest.url, 'https://api.firecrawl.dev/v2/scrape');
  assert.equal(firecrawlRequest.options.headers.Authorization, 'Bearer test-secret-key');
  assert.deepEqual(body.formats.slice(0, 2), ['markdown', 'links']);
  assert.equal(body.formats[2].type, 'json');
  assert.deepEqual(body.formats[2].schema, JOB_SCHEMA);
  assert.equal(body.onlyMainContent, true);
  assert.equal(payload.sources[0].status, 'extracted');
  assert.equal(payload.jobs.length, 1);
  assert.equal(payload.jobs[0].reasons.length, 3);
  assert.equal(payload.jobs[0].jobUrl, 'https://jobs.example.gov/jobs/graduate-data-analyst');
  assert.equal(JSON.stringify(payload).includes('test-secret-key'), false);
});

test('accepts five source URLs and keeps at most five ranked results', async () => {
  process.env.FIRECRAWL_API_KEY = 'test-secret-key';
  let requests = 0;
  global.fetch = async (_url, options) => {
    requests += 1;
    const requestedUrl = new URL(JSON.parse(options.body).url);
    return firecrawlSuccess([extractedJob({
      title: `Junior Analyst ${requestedUrl.hostname}`,
      jobUrl: `https://${requestedUrl.hostname}/role`
    })]);
  };

  const urls = Array.from({ length: 5 }, (_, index) => `https://jobs${index}.example.gov/search`);
  const response = await POST(scanRequest(urls));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(requests, 5);
  assert.equal(payload.sources.length, 5);
  assert.equal(payload.jobs.length, 5);
});

test('continues when one valid public source cannot be extracted', async () => {
  process.env.FIRECRAWL_API_KEY = 'test-secret-key';
  global.fetch = async (_url, options) => {
    const requestedUrl = JSON.parse(options.body).url;
    if (requestedUrl.includes('broken')) return Response.json({ success: false }, { status: 502 });
    return firecrawlSuccess([extractedJob()]);
  };

  const response = await POST(scanRequest([
    'https://broken.example.gov/jobs',
    'https://working.example.gov/jobs'
  ]));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.sources.map((source) => source.status), ['could_not_extract', 'extracted']);
  assert.equal(payload.jobs.length, 1);
});

test('strongly deprioritizes clearly senior roles', () => {
  const jobs = [
    { ...extractedJob({ title: 'Senior Director of Data', juniorEvidence: [], seniorityWarnings: ['Requires 8 years of experience.'] }), sourceUrl: 'https://example.gov/jobs', sourceDomain: 'example.gov' },
    { ...extractedJob({ title: 'Junior Data Assistant' }), sourceUrl: 'https://example.gov/jobs', sourceDomain: 'example.gov' }
  ];

  const ranked = rankJobs(jobs);
  assert.equal(ranked[0].title, 'Junior Data Assistant');
  assert.ok(ranked[0].score > ranked[1].score);
  ranked.forEach((job) => assert.equal(job.reasons.length, 3));
});

test('drops structured jobs and links that are not grounded in visible page output', async () => {
  process.env.FIRECRAWL_API_KEY = 'test-secret-key';
  global.fetch = async () => Response.json({
    success: true,
    data: {
      markdown: '# Careers\nNo vacancies are currently advertised.',
      links: ['https://example.gov/careers'],
      json: { jobs: [extractedJob()] }
    }
  });

  const response = await POST(scanRequest(['https://example.gov/careers']));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.jobs.length, 0);
  assert.equal(payload.sources[0].status, 'no_jobs_found');
});

test('uses the exact source page instead of an unrelated extracted link', async () => {
  process.env.FIRECRAWL_API_KEY = 'test-secret-key';
  const job = extractedJob({ jobUrl: 'https://example.gov/benefits' });
  global.fetch = async () => Response.json({
    success: true,
    data: {
      markdown: `${job.title}\n${job.employer}\n${job.location}\n${job.postedDate}\n${job.employmentType}\n${job.description}\n${job.juniorEvidence[0]}\n${job.transferableSkills.join('\n')}\n${job.futureRelevantSignals[0]}\n${job.learningSignals[0]}\n[Benefits](https://example.gov/benefits)`,
      links: ['https://example.gov/benefits'],
      json: { jobs: [job] }
    }
  });

  const response = await POST(scanRequest(['https://example.gov/job/123']));
  const payload = await response.json();
  assert.equal(payload.jobs[0].jobUrl, 'https://example.gov/job/123');
});
