const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const PAGE_SIZE = 10;

function nutrientAmount(nutrients, ids, fallbackName) {
  const nutrient = nutrients.find((item) => ids.includes(Number(item.nutrientId))) ||
    nutrients.find((item) => String(item.nutrientName || '').toLowerCase().includes(fallbackName));
  const value = Number(nutrient?.value ?? nutrient?.amount ?? 0);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 10) / 10 : 0;
}

export function normalizeUsdaFood(food) {
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const fdcId = Number(food.fdcId);
  if (!Number.isInteger(fdcId) || !food.description) return null;
  return {
    id: `usda-${fdcId}`,
    fdcId,
    source: 'USDA',
    dataType: String(food.dataType || 'USDA food').slice(0, 60),
    brandOwner: String(food.brandOwner || '').trim().slice(0, 100),
    name: String(food.description).trim().slice(0, 180),
    nameZh: String(food.description).trim().slice(0, 180),
    category: 'USDA food',
    servingGrams: 100,
    calories: nutrientAmount(nutrients, [1008, 2047, 2048], 'energy'),
    protein: nutrientAmount(nutrients, [1003], 'protein'),
    carbs: nutrientAmount(nutrients, [1005], 'carbohydrate'),
    fats: nutrientAmount(nutrients, [1004], 'total lipid'),
    tags: []
  };
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  const query = String(request.query?.q || '').trim();
  if (query.length < 2 || query.length > 80) {
    return response.status(400).json({ error: 'Enter a food name between 2 and 80 characters.' });
  }

  const apiKey = process.env.USDA_API_KEY || 'DEMO_KEY';
  const url = new URL(USDA_SEARCH_URL);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', String(PAGE_SIZE));
  url.searchParams.set('pageNumber', '1');

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) {
      const message = upstream.status === 429
        ? 'USDA search limit reached. Please try again shortly.'
        : 'USDA FoodData Central is temporarily unavailable.';
      return response.status(upstream.status === 429 ? 429 : 502).json({ error: message });
    }
    const data = await upstream.json();
    const foods = (Array.isArray(data.foods) ? data.foods : []).map(normalizeUsdaFood).filter(Boolean);
    response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return response.status(200).json({ foods });
  } catch (error) {
    const message = error.name === 'TimeoutError'
      ? 'USDA search timed out. Please try again.'
      : 'USDA search is temporarily unavailable.';
    return response.status(502).json({ error: message });
  }
}
