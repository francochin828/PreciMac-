import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
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

test('runtime code uses only the bundled ingredient dataset', async () => {
  const [html, script, engine] = await Promise.all([
    read('index.html'),
    read('script.js'),
    read('macro-engine.js'),
  ]);
  const runtime = `${html}\n${script}\n${engine}`;

  assert.match(script, /fetch\(['"]\.\/data\/ingredients\.json['"]\)/);
  assert.doesNotMatch(runtime, /https?:\/\//i);
  assert.doesNotMatch(runtime, /firecrawl/i);
  assert.doesNotMatch(runtime, /\/api\//i);
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
  assert.doesNotMatch(envExample, /firecrawl|api[_-]?key/i);
});

test('there are no serverless API handlers', async () => {
  let apiEntries = [];

  try {
    apiEntries = await readdir(new URL('api/', root), {
      recursive: true,
      withFileTypes: true,
    });
  } catch (error) {
    assert.equal(error.code, 'ENOENT');
  }

  const apiFiles = apiEntries.filter((entry) => entry.isFile());
  assert.deepEqual(apiFiles, []);
});
