export const TIMEFRAMES = Object.freeze({
  meal: { label: '1 meal', days: 0.25, mealRepeats: 1 },
  day: { label: '1 day', days: 1, mealRepeats: 4 },
  week: { label: '1 week', days: 7, mealRepeats: 28 },
  month: { label: '1 month', days: 30, mealRepeats: 120 }
});

const GOAL_FACTORS = Object.freeze({ cut: 0.85, maintain: 1, bulk: 1.1 });
const PROTEIN_FACTORS = Object.freeze({ cut: 2.2, maintain: 2, bulk: 1.8 });

function finitePositive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be greater than zero.`);
  return number;
}

function round(value, places = 0) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizeManualTargets(values) {
  return {
    calories: round(finitePositive(values.calories, 'Calories')),
    protein: round(finitePositive(values.protein, 'Protein')),
    carbs: round(finitePositive(values.carbs, 'Carbs')),
    fats: round(finitePositive(values.fats, 'Fats'))
  };
}

export function normalizeSavedMeals(value, limit = 30) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, limit).flatMap((meal, index) => {
    if (!meal || typeof meal !== 'object') return [];
    const name = typeof meal.name === 'string' ? meal.name.trim().slice(0, 48) : '';
    const items = Array.isArray(meal.items)
      ? meal.items.flatMap((item) => {
        const quantity = Number(item?.quantity);
        return typeof item?.id === 'string' && Number.isFinite(quantity) && quantity > 0
          ? [{ id: item.id, quantity: round(quantity, 1) }]
          : [];
      })
      : [];
    if (!name || !items.length) return [];

    try {
      return [{
        id: typeof meal.id === 'string' && meal.id ? meal.id : `stored-${index}`,
        name,
        items,
        targets: normalizeManualTargets(meal.targets || {}),
        timeframe: TIMEFRAMES[meal.timeframe] ? meal.timeframe : 'day',
        preference: typeof meal.preference === 'string' ? meal.preference.slice(0, 120) : ''
      }];
    } catch {
      return [];
    }
  });
}

export function calculateTargets({ weightKg, heightCm, age, goal }) {
  const weight = finitePositive(weightKg, 'Weight');
  const height = finitePositive(heightCm, 'Height');
  const years = finitePositive(age, 'Age');
  const goalFactor = GOAL_FACTORS[goal];
  if (!goalFactor) throw new Error('Choose cut, maintain, or bulk.');
  const maintenance = (10 * weight + 6.25 * height - 5 * years - 78) * 1.45;
  const calories = Math.max(1200, round((maintenance * goalFactor) / 10) * 10);
  const protein = round(weight * PROTEIN_FACTORS[goal]);
  const fats = round((calories * 0.25) / 9);
  const carbs = Math.max(0, round((calories - protein * 4 - fats * 9) / 4));
  return { calories, protein, carbs, fats };
}

export function filterIngredients(ingredients, filters = {}) {
  return ingredients.filter((ingredient) => {
    const tags = ingredient.tags || [];
    if (filters.dairyFree && tags.includes('dairy')) return false;
    if (filters.porkFree && tags.includes('pork')) return false;
    if (filters.vegetarian && !tags.includes('vegetarian')) return false;
    if (filters.highProtein && ingredient.protein < 15) return false;
    return true;
  });
}

export function calculateMealTotals(items, ingredients) {
  const lookup = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const totals = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  items.forEach(({ id, quantity }) => {
    const ingredient = lookup.get(id);
    const amount = Number(quantity);
    if (!ingredient || !Number.isFinite(amount) || amount <= 0) return;
    Object.keys(totals).forEach((macro) => { totals[macro] += ingredient[macro] * amount; });
  });
  return Object.fromEntries(Object.entries(totals).map(([macro, value]) => [macro, round(value, 1)]));
}

export function scalePlan(mealTotals, dailyTargets, timeframeKey) {
  const timeframe = TIMEFRAMES[timeframeKey] || TIMEFRAMES.day;
  const planned = Object.fromEntries(Object.entries(mealTotals).map(([key, value]) => [key, round(value * timeframe.mealRepeats, 1)]));
  const targets = Object.fromEntries(Object.entries(dailyTargets).map(([key, value]) => [key, round(value * timeframe.days, 1)]));
  return { timeframe, planned, targets };
}

export function buildShoppingList({ items, ingredients, timeframeKey, preference = '' }) {
  const timeframe = TIMEFRAMES[timeframeKey] || TIMEFRAMES.day;
  const lookup = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const lines = [`PRECIMAC — ${timeframe.label.toUpperCase()}`, `${timeframe.mealRepeats} meal serving${timeframe.mealRepeats === 1 ? '' : 's'}`, ''];
  items.forEach(({ id, quantity }) => {
    const ingredient = lookup.get(id);
    if (!ingredient) return;
    const servings = round(Number(quantity) * timeframe.mealRepeats, 1);
    const totalGrams = round(servings * ingredient.servingGrams);
    lines.push(`- ${ingredient.name}: ${totalGrams} g (${servings} × ${ingredient.servingGrams} g)`);
  });
  const note = String(preference).trim();
  if (note) lines.push('', `Prep note: ${note}`);
  return lines.join('\n');
}
