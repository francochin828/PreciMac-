import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeUsdaFood } from '../api/foods/search.js';

test('USDA search results normalize into the Precimac ingredient contract', () => {
  const food = normalizeUsdaFood({
    fdcId: 12345,
    description: 'Chicken breast, roasted',
    dataType: 'Foundation',
    foodNutrients: [
      { nutrientId: 1008, nutrientName: 'Energy', value: 165 },
      { nutrientId: 1003, nutrientName: 'Protein', value: 31.02 },
      { nutrientId: 1005, nutrientName: 'Carbohydrate', value: 0 },
      { nutrientId: 1004, nutrientName: 'Total lipid (fat)', value: 3.57 },
    ],
  });

  assert.deepEqual(food, {
    id: 'usda-12345',
    fdcId: 12345,
    source: 'USDA',
    dataType: 'Foundation',
    brandOwner: '',
    name: 'Chicken breast, roasted',
    nameZh: 'Chicken breast, roasted',
    category: 'USDA food',
    servingGrams: 100,
    calories: 165,
    protein: 31,
    carbs: 0,
    fats: 3.6,
    tags: [],
  });
});

test('malformed USDA records are excluded', () => {
  assert.equal(normalizeUsdaFood({ description: 'No identifier' }), null);
});
