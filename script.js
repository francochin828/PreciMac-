const loadButton = document.querySelector('#load-news');
const filterInput = document.querySelector('#story-filter');
const articleList = document.querySelector('#article-list');
const articleCount = document.querySelector('#article-count');
const newsStatus = document.querySelector('#news-status');
const emptyState = document.querySelector('#empty-state');
const deepReadPanel = document.querySelector('#deep-read');
const deepReadDomain = document.querySelector('#deep-read-domain');
const deepReadContent = document.querySelector('#deep-read-content');
const explorerForm = document.querySelector('#web-explorer-form');
const explorerInput = document.querySelector('#web-page-url');
const scrapePageButton = document.querySelector('#scrape-page');
const explorerResult = document.querySelector('#explorer-result');
const jobScoutForm = document.querySelector('#job-scout-form');
const jobSourceInputs = [...document.querySelectorAll('.job-source-input')];
const scanJobsButton = document.querySelector('#scan-jobs');
const clearJobsButton = document.querySelector('#clear-jobs');
const jobSourceStatuses = document.querySelector('#job-source-statuses');
const jobResults = document.querySelector('#job-results');
const jobResultCount = document.querySelector('#job-result-count');
const jobResultMessage = document.querySelector('#job-result-message');
const jobCardList = document.querySelector('#job-card-list');

let loadedArticles = [];

async function readJsonResponse(response, fallbackMessage) {
  try {
    return await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }
}

function formatDisplayUrl(value) {
  try {
    const url = new URL(value);
    const domain = url.hostname.replace(/^www\./, '');
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
    const displayValue = `${domain}${path}`;
    return displayValue.length > 76 ? `${displayValue.slice(0, 73)}…` : displayValue;
  } catch {
    return value;
  }
}

function appendInlineFormatting(element, value) {
  const text = value.replace(/\\([\\`*_{}\[\]()#+\-.!])/g, '$1');
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  parts.forEach((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      element.append(strong);
    } else {
      element.append(document.createTextNode(part));
    }
  });
}

function renderExcerpt(container, markdown) {
  container.replaceChildren();
  const lines = String(markdown || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  let activeList = null;

  lines.forEach((line) => {
    const headingMatch = line.match(/^#{1,6}\s+(.+)/);
    const listMatch = line.match(/^[-*]\s+(.+)/);

    if (headingMatch) {
      activeList = null;
      const heading = document.createElement('h5');
      appendInlineFormatting(heading, headingMatch[1]);
      container.append(heading);
      return;
    }

    if (listMatch) {
      if (!activeList) {
        activeList = document.createElement('ul');
        container.append(activeList);
      }
      const item = document.createElement('li');
      appendInlineFormatting(item, listMatch[1]);
      activeList.append(item);
      return;
    }

    activeList = null;
    const paragraph = document.createElement('p');
    appendInlineFormatting(paragraph, line);
    container.append(paragraph);
  });
}

function setNewsStatus(message, type = '') {
  newsStatus.textContent = message;
  newsStatus.className = `status-message ${type}`.trim();
}

function formatDate(value) {
  if (!value) return 'Date unavailable';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function createArticleCard(article) {
  const card = document.createElement('article');
  card.className = 'article-card';

  const meta = document.createElement('div');
  meta.className = 'article-meta';

  const source = document.createElement('span');
  source.className = 'source-label';
  source.textContent = article.source;

  const date = document.createElement('time');
  date.dateTime = article.publishedAt || '';
  date.textContent = formatDate(article.publishedAt);
  meta.append(source, date);

  const title = document.createElement('h3');
  title.textContent = article.title;

  const summary = document.createElement('p');
  summary.className = 'article-summary';
  summary.textContent = article.summary || 'No RSS summary was provided by this publisher.';

  const actions = document.createElement('div');
  actions.className = 'article-actions';

  const originalLink = document.createElement('a');
  originalLink.href = article.url;
  originalLink.target = '_blank';
  originalLink.rel = 'noopener noreferrer';
  originalLink.textContent = 'Read Original Article ↗';

  const deepReadButton = document.createElement('button');
  deepReadButton.className = 'deep-read-button';
  deepReadButton.type = 'button';
  deepReadButton.textContent = '🔎 Deep Read';
  deepReadButton.addEventListener('click', () => runDeepRead(article, deepReadButton));

  actions.append(originalLink, deepReadButton);
  card.append(meta, title, summary, actions);
  return card;
}

function renderArticles(articles) {
  articleList.replaceChildren(...articles.map(createArticleCard));
  articleCount.textContent = `${articles.length} ${articles.length === 1 ? 'story' : 'stories'}`;
  emptyState.hidden = articles.length !== 0 || loadedArticles.length === 0;
}

function applyFilter() {
  const keyword = filterInput.value.trim().toLowerCase();
  const filtered = loadedArticles.filter((article) => {
    const searchableText = `${article.title} ${article.summary}`.toLowerCase();
    return searchableText.includes(keyword);
  });

  renderArticles(filtered);
}

async function loadLatestNews() {
  loadButton.disabled = true;
  loadButton.textContent = 'Loading feeds…';
  filterInput.disabled = true;
  emptyState.hidden = true;
  setNewsStatus('Requesting WIRED, TechCrunch, and VentureBeat…');

  try {
    const response = await fetch('/api/news');
    const payload = await readJsonResponse(response, 'The news service returned an unreadable response.');

    if (!response.ok) {
      throw new Error(payload.error || 'The news feeds could not be loaded.');
    }

    loadedArticles = payload.articles;
    filterInput.disabled = false;
    filterInput.value = '';
    renderArticles(loadedArticles);

    if (payload.warnings?.length) {
      setNewsStatus(`Loaded ${loadedArticles.length} stories. Some sources need attention: ${payload.warnings.join(' ')}`, 'warning');
    } else {
      setNewsStatus(`Loaded ${loadedArticles.length} current stories from all three RSS feeds.`, 'success');
    }
  } catch (error) {
    loadedArticles = [];
    renderArticles([]);
    emptyState.hidden = true;
    setNewsStatus(`${error.message} Please try again.`, 'error');
  } finally {
    loadButton.disabled = false;
    loadButton.textContent = 'Load Latest News';
  }
}

function showDeepReadLoading(article) {
  deepReadPanel.hidden = false;
  deepReadPanel.setAttribute('aria-busy', 'true');
  deepReadDomain.textContent = `🌐 ${article.source}`;
  deepReadContent.replaceChildren();

  const loading = document.createElement('p');
  loading.className = 'deep-read-loading';
  loading.textContent = `Retrieving “${article.title}”…`;
  deepReadContent.append(loading);
  deepReadPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showDeepReadResult(result) {
  deepReadPanel.setAttribute('aria-busy', 'false');
  deepReadDomain.textContent = `🌐 ${result.domain}`;
  const contentText = result.content || '';

  const body = document.createElement('div');
  body.className = 'deep-read-body';

  const title = document.createElement('h4');
  title.textContent = result.title;

  const description = document.createElement('p');
  description.className = 'result-description';
  description.textContent = result.description || 'A clean excerpt retrieved from the original page.';

  const stats = document.createElement('p');
  stats.className = 'result-stats';
  stats.textContent = `📄 ${contentText.length.toLocaleString()} character excerpt`;

  const content = document.createElement('div');
  content.className = 'rich-content rich-content-dark';
  renderExcerpt(content, contentText || 'No readable page content was returned.');

  const link = document.createElement('a');
  link.href = result.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'result-action result-action-dark';
  link.textContent = `Open ${formatDisplayUrl(result.url)} ↗`;

  body.append(title, description, stats, content, link);
  deepReadContent.replaceChildren(body);
  deepReadPanel.tabIndex = -1;
  deepReadPanel.focus({ preventScroll: true });
}

function showDeepReadError(message) {
  deepReadPanel.setAttribute('aria-busy', 'false');
  const error = document.createElement('div');
  error.className = 'deep-read-body';

  const title = document.createElement('h4');
  title.textContent = 'Deep Read could not finish';

  const detail = document.createElement('p');
  detail.textContent = `${message} Please retry this article.`;

  error.append(title, detail);
  deepReadContent.replaceChildren(error);
  deepReadPanel.tabIndex = -1;
  deepReadPanel.focus({ preventScroll: true });
}

async function runDeepRead(article, button) {
  document.querySelectorAll('.deep-read-button').forEach((item) => {
    item.disabled = true;
  });
  button.textContent = 'Retrieving…';
  showDeepReadLoading(article);

  try {
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: article.url })
    });
    const payload = await readJsonResponse(response, 'The Deep Read service returned an unreadable response.');

    if (!response.ok) {
      throw new Error(payload.error || 'Firecrawl could not retrieve this article.');
    }

    showDeepReadResult(payload.page);
  } catch (error) {
    showDeepReadError(error.message);
  } finally {
    document.querySelectorAll('.deep-read-button').forEach((item) => {
      item.disabled = false;
      item.textContent = '🔎 Deep Read';
    });
  }
}

function showExplorerMessage(titleText, detailText, type = '') {
  explorerResult.hidden = false;
  explorerResult.className = `explorer-result ${type}`.trim();
  explorerResult.setAttribute('role', type === 'error' ? 'alert' : 'status');
  explorerResult.setAttribute('aria-busy', type === 'loading' ? 'true' : 'false');

  const title = document.createElement('h3');
  title.textContent = titleText;

  const detail = document.createElement('p');
  detail.textContent = detailText;

  explorerResult.replaceChildren(title, detail);
  if (type === 'error') {
    explorerResult.tabIndex = -1;
    explorerResult.focus({ preventScroll: true });
  }
}

function showExplorerPage(result) {
  explorerResult.hidden = false;
  explorerResult.className = 'explorer-result success';
  explorerResult.setAttribute('role', 'status');
  explorerResult.setAttribute('aria-busy', 'false');
  const contentText = result.content || '';

  const meta = document.createElement('div');
  meta.className = 'result-meta';

  const domain = document.createElement('span');
  domain.textContent = `🌐 ${result.domain}`;

  const stats = document.createElement('span');
  stats.textContent = `📄 ${contentText.length.toLocaleString()} character excerpt`;
  meta.append(domain, stats);

  const title = document.createElement('h3');
  title.textContent = result.title;

  const url = document.createElement('a');
  url.className = 'result-url-link';
  url.href = result.url;
  url.target = '_blank';
  url.rel = 'noopener noreferrer';
  url.textContent = `🔗 ${formatDisplayUrl(result.url)}`;

  const description = document.createElement('p');
  description.className = 'explorer-description';
  description.textContent = result.description || 'No page description was provided.';

  const excerptLabel = document.createElement('p');
  excerptLabel.className = 'result-kicker';
  excerptLabel.textContent = 'Clean page excerpt';

  const content = document.createElement('div');
  content.className = 'rich-content';
  renderExcerpt(content, contentText || 'No readable page content was returned.');

  const link = document.createElement('a');
  link.href = result.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'result-action';
  link.textContent = 'Open Original Page ↗';

  explorerResult.replaceChildren(meta, title, url, description, excerptLabel, content, link);
  explorerResult.tabIndex = -1;
  explorerResult.focus({ preventScroll: true });
}

async function exploreWebPage(event) {
  event.preventDefault();
  const requestedUrl = explorerInput.value.trim();

  if (!requestedUrl) {
    explorerInput.setAttribute('aria-invalid', 'true');
    showExplorerMessage('Enter a webpage URL', 'Paste one public http:// or https:// URL, then try again.', 'error');
    explorerInput.focus();
    return;
  }

  explorerInput.removeAttribute('aria-invalid');
  explorerInput.disabled = true;
  scrapePageButton.disabled = true;
  scrapePageButton.textContent = 'Scraping…';
  showExplorerMessage('Retrieving webpage…', `Firecrawl is reading ${requestedUrl}`, 'loading');

  try {
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: requestedUrl })
    });
    const payload = await readJsonResponse(response, 'The Web Explorer service returned an unreadable response.');

    if (!response.ok) {
      throw new Error(payload.error || 'Firecrawl could not retrieve this webpage.');
    }

    showExplorerPage(payload.page);
  } catch (error) {
    explorerInput.setAttribute('aria-invalid', 'true');
    showExplorerMessage('Web Explorer could not finish', `${error.message} Please check the URL and try again.`, 'error');
  } finally {
    explorerInput.disabled = false;
    scrapePageButton.disabled = false;
    scrapePageButton.textContent = '✨ Scrape Page';
  }
}

function getJobUrls() {
  return jobSourceInputs.map((input) => input.value.trim()).filter(Boolean);
}

function sourceStatusLabel(status) {
  return {
    waiting: 'Waiting',
    scanning: 'Scanning',
    extracted: 'Extracted',
    no_jobs_found: 'No jobs found',
    could_not_extract: 'Could not extract'
  }[status] || 'Waiting';
}

function renderSourceStatuses(sources, initialStatus = 'waiting') {
  const rows = sources.map((source, index) => {
    const status = source.status || initialStatus;
    const row = document.createElement('div');
    row.className = `source-status source-status-${status}`;

    const identity = document.createElement('div');
    const number = document.createElement('strong');
    number.textContent = `Source ${index + 1}`;
    const domain = document.createElement('span');
    domain.textContent = source.domain || formatDisplayUrl(source.url);
    identity.append(number, domain);

    const state = document.createElement('span');
    state.className = 'source-state';
    state.textContent = sourceStatusLabel(status);

    const message = document.createElement('p');
    message.textContent = source.message || (status === 'scanning' ? 'Firecrawl is checking this page…' : 'Ready to scan.');
    row.append(identity, state, message);
    return row;
  });

  jobSourceStatuses.replaceChildren(...rows);
}

function createJobCard(job) {
  const card = document.createElement('article');
  card.className = 'job-card';

  const rank = document.createElement('span');
  rank.className = 'job-rank';
  rank.textContent = `#${job.rank}`;

  const heading = document.createElement('div');
  heading.className = 'job-card-heading';
  const title = document.createElement('h4');
  title.textContent = job.title;
  const employer = document.createElement('p');
  employer.textContent = job.employer || 'Employer not listed';
  heading.append(title, employer);

  const meta = document.createElement('div');
  meta.className = 'job-meta';
  [
    `🌐 ${job.sourceDomain}`,
    job.location ? `📍 ${job.location}` : '',
    job.employmentType ? `⏱ ${job.employmentType}` : '',
    job.postedDate ? `📅 ${job.postedDate}` : ''
  ].filter(Boolean).forEach((value) => {
    const chip = document.createElement('span');
    chip.textContent = value;
    meta.append(chip);
  });

  const reasons = document.createElement('ul');
  reasons.className = 'job-reasons';
  job.reasons.slice(0, 3).forEach((reason) => {
    const item = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = `${reason.heading}: `;
    item.append(label, document.createTextNode(reason.text));
    reasons.append(item);
  });

  const link = document.createElement('a');
  link.className = 'result-action';
  link.href = job.jobUrl || job.sourceUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = job.jobUrl ? 'Open Job Posting ↗' : 'Open Source Page ↗';

  card.append(rank, heading, meta, reasons, link);
  return card;
}

function showJobResults(jobs, message = '', type = '') {
  jobResults.hidden = false;
  jobResults.className = `job-results ${type}`.trim();
  jobResultCount.textContent = `${jobs.length} ${jobs.length === 1 ? 'role' : 'roles'} recommended`;
  jobResultMessage.textContent = message;
  jobResultMessage.hidden = !message;
  jobCardList.replaceChildren(...jobs.map(createJobCard));
  jobResults.tabIndex = -1;
  jobResults.focus({ preventScroll: true });
}

function clearJobScout() {
  jobScoutForm.reset();
  jobSourceInputs.forEach((input) => input.removeAttribute('aria-invalid'));
  jobSourceStatuses.replaceChildren();
  jobCardList.replaceChildren();
  jobResults.hidden = true;
  jobResultMessage.textContent = '';
  jobSourceInputs[0].focus();
}

async function scanJobs(event) {
  event.preventDefault();
  const urls = getJobUrls();

  if (!urls.length) {
    jobSourceInputs[0].setAttribute('aria-invalid', 'true');
    showJobResults([], 'Enter at least one public http:// or https:// job-listing URL.', 'error');
    jobSourceInputs[0].focus();
    return;
  }

  jobSourceInputs.forEach((input) => input.removeAttribute('aria-invalid'));
  renderSourceStatuses(urls.map((url) => ({ url, status: 'scanning' })), 'scanning');
  showJobResults([], 'Comparing visible jobs across the supplied pages…', 'loading');
  jobResults.setAttribute('aria-busy', 'true');
  jobSourceInputs.forEach((input) => { input.disabled = true; });
  scanJobsButton.disabled = true;
  scanJobsButton.textContent = 'Scanning sources…';
  clearJobsButton.disabled = true;

  try {
    const response = await fetch('/api/jobs/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls })
    });
    const payload = await readJsonResponse(response, 'The Job Scout service returned an unreadable response.');

    if (Array.isArray(payload.sources)) renderSourceStatuses(payload.sources);
    if (!response.ok) throw new Error(payload.error || 'The supplied pages could not be scanned.');

    const partialFailures = payload.sources?.filter((source) => source.status === 'could_not_extract').length || 0;
    const message = payload.jobs.length
      ? (partialFailures ? `${partialFailures} source ${partialFailures === 1 ? 'was' : 'were'} skipped; recommendations use the successful pages.` : '')
      : 'No usable junior job listings were found on the supplied pages.';
    showJobResults(payload.jobs, message, partialFailures ? 'warning' : 'success');
  } catch (error) {
    showJobResults([], error.message, 'error');
  } finally {
    jobResults.setAttribute('aria-busy', 'false');
    jobSourceInputs.forEach((input) => { input.disabled = false; });
    scanJobsButton.disabled = false;
    scanJobsButton.textContent = 'Find Junior Opportunities';
    clearJobsButton.disabled = false;
  }
}

loadButton.addEventListener('click', loadLatestNews);
filterInput.addEventListener('input', applyFilter);
explorerForm.addEventListener('submit', exploreWebPage);
jobScoutForm.addEventListener('submit', scanJobs);
clearJobsButton.addEventListener('click', clearJobScout);
