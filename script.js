(() => {
'use strict';

const {
  TIMEFRAMES,
  buildBasket,
  buildChineseSearchString,
  buildShoppingList,
  calculateMealTotals,
  calculateTargets,
  filterIngredients,
  generateMealPlan,
  normalizeManualTargets,
  normalizeSavedMeals,
  scalePlan
} = globalThis.PrecimacEngine;

const STORAGE_KEY = 'precimac.savedMeals.v1';
const USDA_FOODS_KEY = 'precimac.usdaFoods.v1';
const MACROS = ['calories', 'protein', 'carbs', 'fats'];

const elements = {
  appStatus: document.querySelector('#app-status'),
  macroForm: document.querySelector('#macro-form'),
  manualFields: document.querySelector('#manual-fields'),
  calculatedFields: document.querySelector('#calculated-fields'),
  formActionRow: document.querySelector('#form-action-row'),
  methodNote: document.querySelector('#target-method-note'),
  calculatorStep: document.querySelector('#calculator-step'),
  calculatorProgress: document.querySelector('#calculator-progress'),
  calculatorQuestion: document.querySelector('#calculator-question'),
  calculatorHint: document.querySelector('#calculator-hint'),
  calculatorAnswer: document.querySelector('#calculator-answer'),
  calculatorError: document.querySelector('#calculator-error'),
  calculatorBack: document.querySelector('#calculator-back'),
  calculatorNext: document.querySelector('#calculator-next'),
  timeframeSummary: document.querySelector('#timeframe-summary'),
  customPreference: document.querySelector('#custom-preference'),
  ingredientGrid: document.querySelector('#ingredient-grid'),
  ingredientCount: document.querySelector('#ingredient-count'),
  ingredientEmpty: document.querySelector('#ingredient-empty'),
  foodSearchInput: document.querySelector('#food-search-input'),
  foodSearchLoader: document.querySelector('#food-search-loader'),
  foodSearchStatus: document.querySelector('#food-search-status'),
  foodSearchResults: document.querySelector('#food-search-results'),
  selectedItems: document.querySelector('#selected-items'),
  mealEmpty: document.querySelector('#meal-empty'),
  goalContext: document.querySelector('#goal-context'),
  shoppingTimeframe: document.querySelector('#shopping-timeframe'),
  shoppingList: document.querySelector('#shopping-list'),
  basketItems: document.querySelector('#basket-items'),
  basketCount: document.querySelector('#basket-count'),
  copyList: document.querySelector('#copy-list'),
  copyStatus: document.querySelector('#copy-status'),
  saveMealForm: document.querySelector('#save-meal-form'),
  mealName: document.querySelector('#meal-name'),
  saveStatus: document.querySelector('#save-status'),
  savedMeals: document.querySelector('#saved-meals'),
  savedEmpty: document.querySelector('#saved-empty')
};

const state = {
  ingredients: [],
  selected: new Map(),
  targets: { calories: 2310, protein: 180, carbs: 240, fats: 70 },
  targetMode: 'manual',
  timeframe: 'day',
  filters: { dairyFree: false, porkFree: false, vegetarian: false, highProtein: false },
  saved: [],
  checkedBasketItems: new Set(),
  calculatorIndex: 0,
  calculatorComplete: false,
  foodSearchController: null,
  foodSearchTimer: null,
  calculatorAnswers: {
    goal: 'maintain',
    sex: 'neutral',
    age: 30,
    weightKg: 80,
    heightCm: 180,
    activityLevel: 'moderate',
    pace: 'standard'
  }
};

const PRESETS = Object.freeze({
  cut: { calories: 1800, protein: 180, carbs: 150, fats: 53 },
  maintain: { calories: 2310, protein: 180, carbs: 240, fats: 70 },
  bulk: { calories: 3000, protein: 200, carbs: 350, fats: 89 }
});

const CALCULATOR_QUESTIONS = Object.freeze([
  { key: 'goal', question: 'What are you working toward?', hint: 'This sets the direction of your calorie target.', options: [['cut', 'Lose body fat', 'A controlled calorie deficit'], ['maintain', 'Maintain', 'Keep body weight broadly stable'], ['bulk', 'Build muscle', 'A controlled calorie surplus']] },
  { key: 'sex', question: 'Which equation input should we use?', hint: 'The Mifflin–St Jeor equation uses a sex-specific constant. Choose neutral if neither option fits or you prefer not to say.', options: [['male', 'Male', 'Uses the male equation constant'], ['female', 'Female', 'Uses the female equation constant'], ['neutral', 'Neutral estimate', 'Uses the midpoint of both constants']] },
  { key: 'age', question: 'How old are you?', hint: 'This calculator is intended for adults aged 18 and over.', type: 'number', min: 18, max: 100, step: 1, unit: 'years' },
  { key: 'weightKg', question: 'What is your current weight?', hint: 'Use your recent typical weight, not a single unusual measurement.', type: 'number', min: 30, max: 300, step: 0.1, unit: 'kg' },
  { key: 'heightCm', question: 'What is your height?', hint: 'Enter your height without shoes.', type: 'number', min: 120, max: 230, step: 1, unit: 'cm' },
  { key: 'activityLevel', question: 'What does a normal week look like?', hint: 'Include work, walking, training, and sport—not just gym sessions.', options: [['sedentary', 'Mostly seated', 'Desk-based day with little structured exercise'], ['light', 'Lightly active', 'Regular walking or training 1–3 days a week'], ['moderate', 'Moderately active', 'Training 3–5 days a week'], ['very', 'Very active', 'Hard training 6–7 days a week or a physical job'], ['athlete', 'Athlete-level', 'Very hard training plus a highly active day']] },
  { key: 'pace', question: 'How quickly do you want to move?', hint: 'A gentler pace is easier to sustain. You can adjust the result after two to three weeks of real-world tracking.', options: [['gentle', 'Gentle', 'Small calorie adjustment'], ['standard', 'Standard', 'Moderate calorie adjustment'], ['fast', 'Faster', 'Larger calorie adjustment']] }
]);

function setStatus(message, type = '') {
  elements.appStatus.textContent = message;
  elements.appStatus.className = `app-status ${type}`.trim();
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function displayNumber(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
}

function selectedArray() {
  return [...state.selected].map(([id, quantity]) => ({ id, quantity }));
}

function readStoredMeals() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return normalizeSavedMeals(parsed);
  } catch {
    return [];
  }
}

function persistMeals() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved.slice(0, 30)));
    return true;
  } catch {
    elements.saveStatus.textContent = 'This browser could not save the meal locally.';
    return false;
  }
}

function readStoredUsdaFoods() {
  try {
    const foods = JSON.parse(localStorage.getItem(USDA_FOODS_KEY) || '[]');
    return Array.isArray(foods) ? foods.filter(isUsdaIngredient).slice(0, 100) : [];
  } catch {
    return [];
  }
}

function isUsdaIngredient(food) {
  return Boolean(food && /^usda-\d+$/.test(food.id) && food.source === 'USDA' &&
    typeof food.name === 'string' && food.name.length <= 180 &&
    typeof food.nameZh === 'string' && typeof food.category === 'string' && Array.isArray(food.tags) &&
    ['servingGrams', ...MACROS].every((key) => Number.isFinite(food[key]) && food[key] >= 0));
}

function persistUsdaFoods() {
  try {
    const foods = state.ingredients.filter((food) => food.source === 'USDA').slice(-100);
    localStorage.setItem(USDA_FOODS_KEY, JSON.stringify(foods));
  } catch {
    // Search remains usable when browser storage is unavailable.
  }
}

function createIngredientCard(ingredient) {
  const card = makeElement('article', 'ingredient-card');
  const category = makeElement('p', 'ingredient-category', ingredient.category);
  const title = makeElement('h3', '', ingredient.name);
  const serving = makeElement('p', 'serving-label', `Per ${ingredient.servingGrams} g serving`);
  const macros = makeElement('div', 'ingredient-macros');
  [['P', ingredient.protein], ['C', ingredient.carbs], ['F', ingredient.fats]].forEach(([label, value]) => {
    const item = makeElement('span');
    const strong = makeElement('strong', '', `${displayNumber(value)}g`);
    item.append(document.createTextNode(`${label} `), strong);
    macros.append(item);
  });
  const footer = makeElement('div', 'ingredient-footer');
  footer.append(makeElement('strong', '', `${displayNumber(ingredient.calories)} kcal`));
  const addButton = makeElement('button', 'add-button', state.selected.has(ingredient.id) ? 'Add another' : 'Add');
  addButton.type = 'button';
  addButton.dataset.addIngredient = ingredient.id;
  footer.append(addButton);
  card.append(category, title, serving, macros, footer);
  return card;
}

function renderIngredients() {
  const visible = filterIngredients(state.ingredients, state.filters);
  elements.ingredientGrid.replaceChildren(...visible.map(createIngredientCard));
  elements.ingredientGrid.setAttribute('aria-busy', 'false');
  elements.ingredientCount.textContent = `${visible.length} of ${state.ingredients.length} ingredients`;
  elements.ingredientEmpty.hidden = visible.length !== 0;
}

function syncIngredientButton(id) {
  const button = [...elements.ingredientGrid.querySelectorAll('[data-add-ingredient]')]
    .find((candidate) => candidate.dataset.addIngredient === id);
  if (button) button.textContent = state.selected.has(id) ? 'Add another' : 'Add';
}

function createFoodSearchResult(food) {
  const row = makeElement('article', 'food-search-result');
  const identity = makeElement('div', 'food-search-identity');
  const detail = food.brandOwner ? `${food.dataType || 'Branded'} · ${food.brandOwner}` : (food.dataType || 'USDA food');
  identity.append(makeElement('strong', '', food.name), makeElement('small', '', detail));
  const macros = makeElement('span', 'food-search-macros', `${displayNumber(food.calories)} kcal · ${displayNumber(food.protein)}P · ${displayNumber(food.carbs)}C · ${displayNumber(food.fats)}F`);
  const button = makeElement('button', 'secondary-button', state.selected.has(food.id) ? 'Add another' : 'Add');
  button.type = 'button';
  button.dataset.addUsdaFood = food.id;
  row.append(identity, macros, button);
  row.dataset.food = JSON.stringify(food);
  return row;
}

function setFoodSearchLoading(isLoading) {
  elements.foodSearchLoader.hidden = !isLoading;
  elements.foodSearchInput.setAttribute('aria-busy', String(isLoading));
}

async function searchUsdaFoods(query) {
  if (location.protocol === 'file:') {
    elements.foodSearchStatus.textContent = 'Live USDA search is available on the deployed Precimac website.';
    elements.foodSearchResults.replaceChildren();
    return;
  }
  elements.foodSearchController?.abort();
  const controller = new AbortController();
  state.foodSearchController = controller;
  setFoodSearchLoading(true);
  elements.foodSearchStatus.textContent = `Searching USDA for “${query}”…`;
  try {
    const response = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'USDA search is temporarily unavailable.');
    elements.foodSearchResults.replaceChildren(...payload.foods.map(createFoodSearchResult));
    elements.foodSearchStatus.textContent = payload.foods.length
      ? `${payload.foods.length} USDA suggestion${payload.foods.length === 1 ? '' : 's'} found. Select Add to use one in your meal.`
      : `No USDA foods found for “${query}”. Try a broader name.`;
  } catch (error) {
    if (error.name !== 'AbortError') {
      elements.foodSearchResults.replaceChildren();
      elements.foodSearchStatus.textContent = error.message || 'USDA search is temporarily unavailable.';
    }
  } finally {
    if (state.foodSearchController === controller) setFoodSearchLoading(false);
  }
}

function queueUsdaSearch() {
  clearTimeout(state.foodSearchTimer);
  const query = elements.foodSearchInput.value.trim();
  if (query.length < 2) {
    elements.foodSearchController?.abort();
    setFoodSearchLoading(false);
    elements.foodSearchResults.replaceChildren();
    elements.foodSearchStatus.textContent = 'Type at least 2 characters for live USDA suggestions.';
    return;
  }
  state.foodSearchTimer = setTimeout(() => searchUsdaFoods(query), 350);
}

function addUsdaFood(button) {
  const row = button.closest('[data-food]');
  if (!row) return;
  try {
    const food = JSON.parse(row.dataset.food);
    if (!isUsdaIngredient(food)) throw new Error('Invalid USDA food result.');
    if (!state.ingredients.some((ingredient) => ingredient.id === food.id)) {
      state.ingredients.push(food);
      persistUsdaFoods();
      renderIngredients();
    }
    addIngredient(food.id);
    button.textContent = 'Add another';
    elements.foodSearchStatus.textContent = `${food.name} added to your meal.`;
  } catch {
    elements.foodSearchStatus.textContent = 'That USDA result could not be added. Please try another food.';
  }
}

function createSelectedRow(item) {
  const ingredient = state.ingredients.find((entry) => entry.id === item.id);
  if (!ingredient) return null;
  const row = makeElement('div', 'selected-row');
  const identity = makeElement('div');
  identity.append(makeElement('strong', '', ingredient.name), makeElement('span', '', `${ingredient.servingGrams} g serving`));
  const controls = makeElement('div', 'quantity-controls');
  const decrease = makeElement('button', '', '−');
  decrease.type = 'button';
  decrease.dataset.quantityStep = '-0.5';
  decrease.dataset.ingredientId = item.id;
  decrease.setAttribute('aria-label', `Decrease ${ingredient.name}`);
  const quantity = makeElement('output', '', `${displayNumber(item.quantity)}×`);
  quantity.setAttribute('aria-label', `${displayNumber(item.quantity)} servings`);
  const increase = makeElement('button', '', '+');
  increase.type = 'button';
  increase.dataset.quantityStep = '0.5';
  increase.dataset.ingredientId = item.id;
  increase.setAttribute('aria-label', `Increase ${ingredient.name}`);
  const remove = makeElement('button', 'remove-button', 'Remove');
  remove.type = 'button';
  remove.dataset.removeIngredient = item.id;
  controls.append(decrease, quantity, increase, remove);
  row.append(identity, controls);
  return row;
}

function renderTotals(items) {
  const totals = calculateMealTotals(items, state.ingredients);
  MACROS.forEach((macro) => {
    document.querySelector(`#total-${macro}`).textContent = displayNumber(totals[macro]);
  });
  const plan = scalePlan(totals, state.targets, state.timeframe);
  MACROS.forEach((macro) => {
    const progress = document.querySelector(`#${macro}-progress`);
    const label = document.querySelector(`#${macro}-progress-label`);
    const target = Math.max(plan.targets[macro], 1);
    progress.max = target;
    progress.value = Math.min(plan.planned[macro], target);
    progress.dataset.over = plan.planned[macro] > target ? 'true' : 'false';
    const unit = macro === 'calories' ? 'kcal' : 'g';
    label.textContent = `${displayNumber(plan.planned[macro])} / ${displayNumber(plan.targets[macro])} ${unit}`;
  });
}

function renderShoppingList(items) {
  const timeframe = TIMEFRAMES[state.timeframe];
  elements.shoppingTimeframe.textContent = timeframe.label;
  elements.timeframeSummary.textContent = `${timeframe.label} · ${timeframe.mealRepeats} meal serving${timeframe.mealRepeats === 1 ? '' : 's'}`;
  elements.goalContext.textContent = `${timeframe.label} plan`;
  if (!items.length) {
    elements.shoppingList.textContent = 'Add ingredients to generate your list.';
    elements.basketItems.replaceChildren(makeElement('p', 'empty-message', 'Generate a plan to build your basket.'));
    elements.basketCount.textContent = '0 products';
    elements.copyList.disabled = true;
    return;
  }
  const basket = buildBasket({ items, ingredients: state.ingredients, timeframeKey: state.timeframe });
  const basketRows = basket.map((item) => {
    const label = makeElement('label', 'basket-row');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.basketItem = item.id;
    checkbox.checked = state.checkedBasketItems.has(item.id);
    const name = makeElement('span');
    name.append(makeElement('strong', '', item.nameZh), makeElement('small', '', item.name));
    const quantity = makeElement('output', '', item.grams >= 1000 ? `${displayNumber(item.grams / 1000)} kg` : `${item.grams} g`);
    label.append(checkbox, name, quantity);
    return label;
  });
  elements.basketItems.replaceChildren(...basketRows);
  elements.basketCount.textContent = `${basket.length} product${basket.length === 1 ? '' : 's'}`;
  const chineseList = buildChineseSearchString(basket);
  const note = elements.customPreference.value.trim();
  elements.shoppingList.textContent = note ? `${chineseList}\n备注：${note}` : chineseList;
  elements.copyList.disabled = false;
}

function generatePlan({ announce = true } = {}) {
  const localIngredients = state.ingredients.filter((ingredient) => ingredient.source !== 'USDA');
  const items = generateMealPlan({ ingredients: localIngredients, targets: state.targets, filters: state.filters });
  state.selected = new Map(items.map((item) => [item.id, item.quantity]));
  state.checkedBasketItems.clear();
  renderIngredients();
  renderPlan();
  if (announce) {
    setStatus(`Plan generated from your targets: ${items.length} ingredients, ready to edit.`, 'success');
    document.querySelector('#builder-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function applyPreset(key) {
  const preset = PRESETS[key];
  if (!preset) return;
  state.targets = { ...preset };
  MACROS.forEach((macro) => { document.querySelector(`#manual-${macro}`).value = preset[macro]; });
  document.querySelector('input[name="target-mode"][value="manual"]').checked = true;
  applyTargetMode('manual');
  document.querySelectorAll('[data-preset]').forEach((button) => button.dataset.active = button.dataset.preset === key ? 'true' : 'false');
  generatePlan();
}

function renderPlan() {
  const items = selectedArray();
  const rows = items.map(createSelectedRow).filter(Boolean);
  elements.selectedItems.replaceChildren(...rows);
  elements.mealEmpty.hidden = rows.length !== 0;
  renderTotals(items);
  renderShoppingList(items);
}

function addIngredient(id) {
  state.selected.set(id, (state.selected.get(id) || 0) + 1);
  elements.copyStatus.textContent = '';
  renderPlan();
  syncIngredientButton(id);
}

function changeQuantity(id, step) {
  const next = Math.round(((state.selected.get(id) || 0) + step) * 2) / 2;
  if (next <= 0) state.selected.delete(id);
  else state.selected.set(id, next);
  renderPlan();
  syncIngredientButton(id);
}

function activeCalculatorQuestions() {
  return state.calculatorAnswers.goal === 'maintain'
    ? CALCULATOR_QUESTIONS.filter((question) => question.key !== 'pace')
    : CALCULATOR_QUESTIONS;
}

function createCalculatorChoice(question, option) {
  const [value, title, description] = option;
  const label = makeElement('label', 'calculator-choice');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'calculator-answer';
  input.value = value;
  input.checked = state.calculatorAnswers[question.key] === value;
  const content = makeElement('span');
  content.append(makeElement('strong', '', title), makeElement('small', '', description));
  label.append(input, content);
  return label;
}

function renderCalculatorQuestion() {
  const questions = activeCalculatorQuestions();
  state.calculatorIndex = Math.min(state.calculatorIndex, questions.length - 1);
  const question = questions[state.calculatorIndex];
  elements.calculatorStep.textContent = `Question ${state.calculatorIndex + 1} of ${questions.length}`;
  elements.calculatorProgress.max = questions.length;
  elements.calculatorProgress.value = state.calculatorIndex + 1;
  elements.calculatorQuestion.textContent = question.question;
  elements.calculatorHint.textContent = question.hint;
  elements.calculatorError.textContent = '';
  elements.calculatorBack.disabled = state.calculatorIndex === 0;
  elements.calculatorNext.textContent = state.calculatorIndex === questions.length - 1 ? 'Calculate my targets' : 'Continue';

  if (question.type === 'number') {
    const label = makeElement('label', 'calculator-number');
    label.append(makeElement('span', '', question.unit));
    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'calculator-number-input';
    input.min = question.min;
    input.max = question.max;
    input.step = question.step;
    input.value = state.calculatorAnswers[question.key];
    input.setAttribute('aria-label', `${question.question} in ${question.unit}`);
    label.prepend(input);
    elements.calculatorAnswer.replaceChildren(label);
    input.focus();
    return;
  }

  elements.calculatorAnswer.replaceChildren(...question.options.map((option) => createCalculatorChoice(question, option)));
}

function renderCalculatorResult() {
  elements.calculatorStep.textContent = 'Calculation complete';
  elements.calculatorProgress.value = elements.calculatorProgress.max;
  elements.calculatorQuestion.textContent = 'Your starting daily target is ready.';
  elements.calculatorHint.textContent = 'Use it consistently, compare it with two to three weeks of real results, and adjust if needed.';
  const result = makeElement('div', 'calculator-result');
  [['Calories', state.targets.calories, 'kcal'], ['Protein', state.targets.protein, 'g'], ['Carbs', state.targets.carbs, 'g'], ['Fats', state.targets.fats, 'g']].forEach(([label, value, unit]) => {
    const card = makeElement('div');
    card.append(makeElement('span', '', label), makeElement('strong', '', displayNumber(value)), makeElement('small', '', unit));
    result.append(card);
  });
  elements.calculatorAnswer.replaceChildren(result);
  elements.calculatorError.textContent = '';
  elements.calculatorBack.disabled = false;
  elements.calculatorNext.textContent = 'View my generated plan';
}

function finishCalculator() {
  state.targets = calculateTargets(state.calculatorAnswers);
  MACROS.forEach((macro) => { document.querySelector(`#manual-${macro}`).value = state.targets[macro]; });
  state.calculatorComplete = true;
  renderCalculatorResult();
  setStatus(`Calculated target: ${state.targets.calories} kcal · ${state.targets.protein} g protein · ${state.targets.carbs} g carbs · ${state.targets.fats} g fats.`, 'success');
  generatePlan({ announce: false });
}

function advanceCalculator() {
  if (state.calculatorComplete) {
    document.querySelector('#builder-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const questions = activeCalculatorQuestions();
  const question = questions[state.calculatorIndex];
  let value;
  if (question.type === 'number') {
    const input = document.querySelector('#calculator-number-input');
    value = Number(input.value);
    if (!Number.isFinite(value) || value < question.min || value > question.max) {
      elements.calculatorError.textContent = `Enter a value between ${question.min} and ${question.max} ${question.unit}.`;
      input.focus();
      return;
    }
  } else {
    value = document.querySelector('input[name="calculator-answer"]:checked')?.value;
    if (!value) {
      elements.calculatorError.textContent = 'Choose one option to continue.';
      return;
    }
  }
  state.calculatorAnswers[question.key] = value;
  const updatedQuestions = activeCalculatorQuestions();
  if (state.calculatorIndex >= updatedQuestions.length - 1) finishCalculator();
  else {
    state.calculatorIndex += 1;
    renderCalculatorQuestion();
  }
}

function previousCalculatorQuestion() {
  if (state.calculatorComplete) state.calculatorComplete = false;
  else state.calculatorIndex = Math.max(0, state.calculatorIndex - 1);
  renderCalculatorQuestion();
}

function applyTargetMode(mode) {
  state.targetMode = mode;
  const calculating = mode === 'calculate';
  elements.manualFields.hidden = calculating;
  elements.manualFields.disabled = calculating;
  elements.calculatedFields.hidden = !calculating;
  elements.calculatedFields.disabled = !calculating;
  elements.formActionRow.hidden = calculating;
  elements.methodNote.textContent = calculating
    ? 'Guided estimate using the Mifflin–St Jeor equation and your activity level.'
    : 'Using the exact daily targets you enter.';
  if (calculating) {
    if (state.calculatorComplete) renderCalculatorResult();
    else renderCalculatorQuestion();
  }
}

function applyTargets(event) {
  event.preventDefault();
  try {
    if (state.targetMode === 'manual') {
      state.targets = normalizeManualTargets({
        protein: document.querySelector('#manual-protein').value,
        carbs: document.querySelector('#manual-carbs').value,
        fats: document.querySelector('#manual-fats').value,
        calories: document.querySelector('#manual-calories').value
      });
    } else state.targets = calculateTargets(state.calculatorAnswers);
    setStatus(`Targets applied: ${state.targets.calories} kcal · ${state.targets.protein} g protein · ${state.targets.carbs} g carbs · ${state.targets.fats} g fats.`, 'success');
    generatePlan();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function renderSavedMeals() {
  const cards = state.saved.map((meal) => {
    const card = makeElement('article', 'saved-meal');
    const text = makeElement('div');
    text.append(makeElement('strong', '', meal.name), makeElement('span', '', `${meal.items.length} ingredient${meal.items.length === 1 ? '' : 's'} · ${TIMEFRAMES[meal.timeframe]?.label || '1 day'}`));
    const load = makeElement('button', 'text-button', 'Load');
    load.type = 'button';
    load.dataset.loadMeal = meal.id;
    card.append(text, load);
    return card;
  });
  elements.savedMeals.replaceChildren(...cards);
  elements.savedEmpty.hidden = cards.length !== 0;
}

function saveMeal(event) {
  event.preventDefault();
  const name = elements.mealName.value.trim();
  const items = selectedArray();
  if (!name || !items.length) {
    elements.saveStatus.textContent = 'Add ingredients and enter a meal name first.';
    return;
  }
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  state.saved.unshift({ id, name, items, targets: state.targets, timeframe: state.timeframe, preference: elements.customPreference.value });
  if (!persistMeals()) return;
  elements.mealName.value = '';
  elements.saveStatus.textContent = `Saved “${name}” on this device.`;
  renderSavedMeals();
}

function loadMeal(id) {
  const meal = state.saved.find((entry) => entry.id === id);
  if (!meal) return;
  const validIds = new Set(state.ingredients.map((ingredient) => ingredient.id));
  state.selected = new Map(meal.items.filter((item) => validIds.has(item.id)).map((item) => [item.id, item.quantity]));
  state.targets = normalizeManualTargets(meal.targets);
  state.timeframe = TIMEFRAMES[meal.timeframe] ? meal.timeframe : 'day';
  elements.customPreference.value = meal.preference || '';
  MACROS.forEach((macro) => { document.querySelector(`#manual-${macro}`).value = state.targets[macro]; });
  document.querySelector('input[name="target-mode"][value="manual"]').checked = true;
  document.querySelector(`input[name="timeframe"][value="${state.timeframe}"]`).checked = true;
  applyTargetMode('manual');
  elements.saveStatus.textContent = `Loaded “${meal.name}”.`;
  renderIngredients();
  renderPlan();
}

async function copyShoppingList() {
  try {
    await navigator.clipboard.writeText(elements.shoppingList.textContent);
    elements.copyStatus.textContent = 'Shopping list copied.';
  } catch {
    elements.copyStatus.textContent = 'Clipboard access was unavailable. Select the list and copy it manually.';
  }
}

function bindEvents() {
  document.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', () => applyPreset(button.dataset.preset)));
  document.querySelectorAll('input[name="target-mode"]').forEach((input) => input.addEventListener('change', () => applyTargetMode(input.value)));
  elements.calculatorNext.addEventListener('click', advanceCalculator);
  elements.calculatorBack.addEventListener('click', previousCalculatorQuestion);
  elements.calculatorAnswer.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); advanceCalculator(); } });
  elements.macroForm.addEventListener('submit', applyTargets);
  document.querySelectorAll('input[name="timeframe"]').forEach((input) => input.addEventListener('change', () => { state.timeframe = input.value; renderPlan(); }));
  document.querySelectorAll('input[name="diet-filter"]').forEach((input) => input.addEventListener('change', () => {
    state.filters[input.value] = input.checked;
    generatePlan({ announce: false });
    setStatus('Dietary filters applied. Your meal and basket were regenerated.', 'success');
  }));
  elements.customPreference.addEventListener('input', () => renderShoppingList(selectedArray()));
  elements.ingredientGrid.addEventListener('click', (event) => { const id = event.target.closest('[data-add-ingredient]')?.dataset.addIngredient; if (id) addIngredient(id); });
  elements.foodSearchInput.addEventListener('input', queueUsdaSearch);
  elements.foodSearchResults.addEventListener('click', (event) => { const button = event.target.closest('[data-add-usda-food]'); if (button) addUsdaFood(button); });
  elements.selectedItems.addEventListener('click', (event) => {
    const removeId = event.target.closest('[data-remove-ingredient]')?.dataset.removeIngredient;
    if (removeId) { state.selected.delete(removeId); renderPlan(); syncIngredientButton(removeId); return; }
    const stepButton = event.target.closest('[data-quantity-step]');
    if (stepButton) changeQuantity(stepButton.dataset.ingredientId, Number(stepButton.dataset.quantityStep));
  });
  elements.copyList.addEventListener('click', copyShoppingList);
  elements.basketItems.addEventListener('change', (event) => {
    const id = event.target.closest('[data-basket-item]')?.dataset.basketItem;
    if (!id) return;
    if (event.target.checked) state.checkedBasketItems.add(id);
    else state.checkedBasketItems.delete(id);
  });
  elements.saveMealForm.addEventListener('submit', saveMeal);
  elements.savedMeals.addEventListener('click', (event) => { const id = event.target.closest('[data-load-meal]')?.dataset.loadMeal; if (id) loadMeal(id); });
}

function initialize() {
  bindEvents();
  state.saved = readStoredMeals();
  renderSavedMeals();
  try {
    const ingredients = globalThis.PrecimacIngredients;
    if (!Array.isArray(ingredients) || ingredients.length === 0) throw new Error('Ingredient data is empty.');
    const storedUsdaFoods = readStoredUsdaFoods();
    state.ingredients = [...ingredients, ...storedUsdaFoods.filter((food) => !ingredients.some((item) => item.id === food.id))];
    renderIngredients();
    generatePlan({ announce: false });
    setStatus(`${ingredients.length} local ingredients ready. Your starter basket has been generated.`, 'success');
  } catch (error) {
    elements.ingredientCount.textContent = 'Unavailable';
    elements.ingredientGrid.setAttribute('aria-busy', 'false');
    elements.ingredientEmpty.hidden = false;
    elements.ingredientEmpty.textContent = 'The local ingredient dataset could not be loaded. Refresh to retry.';
    setStatus(error.message, 'error');
  }
}

initialize();
})();
