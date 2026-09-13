import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

await import('../macro-engine.js');
const { buildShoppingList, calculateMealTotals, calculateTargets, filterIngredients, normalizeManualTargets, normalizeSavedMeals, scalePlan } = globalThis.PrecimacEngine;

const ingredients = JSON.parse(await readFile(new URL('../data/ingredients.json', import.meta.url), 'utf8'));

test('normalizes manual targets and rejects invalid values', () => {
  assert.deepEqual(normalizeManualTargets({ calories: '2400', protein: '180', carbs: '250', fats: '70' }), { calories: 2400, protein: 180, carbs: 250, fats: 70 });
  assert.throws(() => normalizeManualTargets({ calories: 0, protein: 180, carbs: 250, fats: 70 }), /Calories/);
});

test('calculated target flow responds to cut, maintain, and bulk goals', () => {
  const input = { weightKg: 80, heightCm: 180, age: 30 };
  const cut = calculateTargets({ ...input, goal: 'cut' });
  const maintain = calculateTargets({ ...input, goal: 'maintain' });
  const bulk = calculateTargets({ ...input, goal: 'bulk' });
  assert.ok(cut.calories < maintain.calories);
  assert.ok(bulk.calories > maintain.calories);
  assert.ok(cut.protein > bulk.protein);
});

test('dietary filters exclude dairy and pork and can require vegetarian protein', () => {
  const strict = filterIngredients(ingredients, { dairyFree: true, porkFree: true, vegetarian: true, highProtein: true });
  assert.ok(strict.length > 0);
  assert.ok(strict.every((ingredient) => ingredient.tags.includes('vegetarian')));
  assert.ok(strict.every((ingredient) => !ingredient.tags.includes('dairy') && !ingredient.tags.includes('pork')));
  assert.ok(strict.every((ingredient) => ingredient.protein >= 15));
});

test('meal totals and timeframe scaling remain deterministic', () => {
  const items = [{ id: 'chicken-breast', quantity: 1 }, { id: 'rice', quantity: 2 }];
  const totals = calculateMealTotals(items, ingredients);
  assert.deepEqual(totals, { calories: 588, protein: 45.2, carbs: 84.6, fats: 5.3 });
  const week = scalePlan(totals, { calories: 2000, protein: 160, carbs: 220, fats: 60 }, 'week');
  assert.equal(week.planned.calories, 16464);
  assert.equal(week.targets.calories, 14000);
});

test('shopping list scales quantities and includes a custom prep note', () => {
  const list = buildShoppingList({ items: [{ id: 'chicken-breast', quantity: 1 }], ingredients, timeframeKey: 'day', preference: 'Low sodium' });
  assert.match(list, /Chicken breast: 480 g/);
  assert.match(list, /4 meal servings/);
  assert.match(list, /Prep note: Low sodium/);
});

test('saved meal normalization drops malformed browser data safely', () => {
  const meals = normalizeSavedMeals([
    null,
    { name: '', items: [], targets: {} },
    {
      id: 'valid',
      name: '  Training day  ',
      items: [{ id: 'chicken-breast', quantity: '1.5' }, { id: 'rice', quantity: -2 }],
      targets: { calories: 2400, protein: 180, carbs: 250, fats: 70 },
      timeframe: 'unknown',
      preference: 42
    }
  ]);

  assert.deepEqual(meals, [{
    id: 'valid',
    name: 'Training day',
    items: [{ id: 'chicken-breast', quantity: 1.5 }],
    targets: { calories: 2400, protein: 180, carbs: 250, fats: 70 },
    timeframe: 'day',
    preference: ''
  }]);
});
