const loadButton = document.querySelector('#load-news');
const filterInput = document.querySelector('#story-filter');
const articleList = document.querySelector('#article-list');
const articleCount = document.querySelector('#article-count');
const newsStatus = document.querySelector('#news-status');
const emptyState = document.querySelector('#empty-state');
const deepReadPanel = document.querySelector('#deep-read');
const deepReadDomain = document.querySelector('#deep-read-domain');
const deepReadContent = document.querySelector('#deep-read-content');

let loadedArticles = [];

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
  deepReadButton.textContent = 'Deep Read';
  deepReadButton.addEventListener('click', () => runDeepRead(article, deepReadButton));

  actions.append(originalLink, deepReadButton);
  card.append(meta, title, summary, actions);
  return card;
}

function renderArticles(articles) {
  articleList.replaceChildren(...articles.map(createArticleCard));
  articleCount.textContent = `${articles.length} ${articles.length === 1 ? 'story' : 'stories'}`;
  emptyState.hidden = articles.length !== 0;
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
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'The news feeds could not be loaded.');
    }

    loadedArticles = payload.articles;
    filterInput.disabled = false;
    filterInput.value = '';
    renderArticles(loadedArticles);

    if (payload.warnings?.length) {
      setNewsStatus(`Loaded ${loadedArticles.length} stories. ${payload.warnings.join(' ')}`, 'error');
    } else {
      setNewsStatus(`Loaded ${loadedArticles.length} current stories from all three RSS feeds.`, 'success');
    }
  } catch (error) {
    loadedArticles = [];
    renderArticles([]);
    setNewsStatus(`${error.message} Please try again.`, 'error');
  } finally {
    loadButton.disabled = false;
    loadButton.textContent = 'Load Latest News';
  }
}

function showDeepReadLoading(article) {
  deepReadPanel.hidden = false;
  deepReadDomain.textContent = article.source;
  deepReadContent.replaceChildren();

  const loading = document.createElement('p');
  loading.className = 'deep-read-loading';
  loading.textContent = `Retrieving “${article.title}”…`;
  deepReadContent.append(loading);
  deepReadPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showDeepReadResult(result) {
  deepReadDomain.textContent = result.domain;

  const body = document.createElement('div');
  body.className = 'deep-read-body';

  const title = document.createElement('h4');
  title.textContent = result.title;

  const description = document.createElement('p');
  description.textContent = result.description || result.content;

  const content = document.createElement('p');
  content.textContent = result.description ? result.content : '';

  const link = document.createElement('a');
  link.href = result.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Open Original Article ↗';

  body.append(title, description);
  if (content.textContent) body.append(content);
  body.append(link);
  deepReadContent.replaceChildren(body);
}

function showDeepReadError(message) {
  const error = document.createElement('div');
  error.className = 'deep-read-body';

  const title = document.createElement('h4');
  title.textContent = 'Deep Read could not finish';

  const detail = document.createElement('p');
  detail.textContent = `${message} Please retry this article.`;

  error.append(title, detail);
  deepReadContent.replaceChildren(error);
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
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Firecrawl could not retrieve this article.');
    }

    showDeepReadResult(payload.page);
  } catch (error) {
    showDeepReadError(error.message);
  } finally {
    document.querySelectorAll('.deep-read-button').forEach((item) => {
      item.disabled = false;
      item.textContent = 'Deep Read';
    });
  }
}

loadButton.addEventListener('click', loadLatestNews);
filterInput.addEventListener('input', applyFilter);
