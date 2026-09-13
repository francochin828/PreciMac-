import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('the application remains dependency-free', async () => {
  const packageJson = JSON.parse(await read('package.json'));

  assert.deepEqual(packageJson.dependencies ?? {}, {});
  assert.deepEqual(packageJson.devDependencies ?? {}, {});
});

test('runtime code keeps Firecrawl excluded and uses only the approved USDA API', async () => {
  const [html, script, engine, ingredientScript, api] = await Promise.all([
    read('index.html'),
    read('script.js'),
    read('macro-engine.js'),
    read('data/ingredients.js'),
    read('api/foods/search.js'),
  ]);
  const runtime = `${html}\n${script}\n${engine}\n${ingredientScript}`;

  assert.match(html, /src="data\/ingredients\.js"/);
  assert.match(ingredientScript, /globalThis\.PrecimacIngredients/);
  assert.doesNotMatch(runtime, /firecrawl/i);
  assert.match(script, /\/api\/foods\/search/);
  assert.match(api, /https:\/\/api\.nal\.usda\.gov\/fdc\/v1\/foods\/search/);
  assert.doesNotMatch(`${runtime}\n${api}`, /api\.firecrawl\.dev/i);
});

test('browser-ready ingredient data matches the JSON source', async () => {
  const source = JSON.parse(await read('data/ingredients.json'));
  const browserData = await read('data/ingredients.js');
  const openingBracket = browserData.indexOf('[');
  const closingBracket = browserData.lastIndexOf(']');

  assert.deepEqual(JSON.parse(browserData.slice(openingBracket, closingBracket + 1)), source);
});

test('saved meals stay local and user content uses safe DOM APIs', async () => {
  const script = await read('script.js');

  assert.match(script, /precimac\.savedMeals\.v1/);
  assert.match(script, /localStorage/);
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
});

test('local secrets and deployment metadata are ignored', async () => {
  const [gitignore, envExample] = await Promise.all([
    read('.gitignore'),
    read('.env.example'),
  ]);

  assert.match(gitignore, /^\.env\.local$/m);
  assert.match(gitignore, /^\.env\.\*\.local$/m);
  assert.match(gitignore, /^\.vercel\/$/m);
  assert.match(gitignore, /^node_modules\/$/m);
  assert.match(envExample, /^USDA_API_KEY=$/m);
  assert.doesNotMatch(envExample, /firecrawl/i);
});

test('USDA credentials remain server-side', async () => {
  const [script, api] = await Promise.all([read('script.js'), read('api/foods/search.js')]);
  assert.doesNotMatch(script, /USDA_API_KEY|DEMO_KEY|api\.nal\.usda\.gov/);
  assert.match(api, /process\.env\.USDA_API_KEY/);
  assert.match(api, /process\.env\.USDA_API_KEY \|\| 'DEMO_KEY'/);
});
