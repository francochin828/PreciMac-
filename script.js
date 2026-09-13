import {
  TIMEFRAMES,
  buildShoppingList,
  calculateMealTotals,
  calculateTargets,
  filterIngredients,
  normalizeManualTargets,
  scalePlan
} from './macro-engine.js';

const STORAGE_KEY = 'precimac.savedMeals.v1';
const MACROS = ['calories', 'protein', 'carbs', 'fats'];

const elements = {
  appStatus: document.querySelector('#app-status'),
  macroForm: document.querySelector('#macro-form'),
  manualFields: document.querySelector('#manual-fields'),
  calculatedFields: document.querySelector('#calculated-fields'),
  methodNote: document.querySelector('#target-method-note'),
  timeframeSummary: document.querySelector('#timeframe-summary'),
  customPreference: document.querySelector('#custom-preference'),
  ingredientGrid: document.querySelector('#ingredient-grid'),
  ingredientCount: document.querySelector('#ingredient-count'),
  ingredientEmpty: document.querySelector('#ingredient-empty'),
  selectedItems: document.querySelector('#selected-items'),
  mealEmpty: document.querySelector('#meal-empty'),
  goalContext: document.querySelector('#goal-context'),
  shoppingTimeframe: document.querySelector('#shopping-timeframe'),
  shoppingList: document.querySelector('#shopping-list'),
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
  saved: []
};

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
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
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
  elements.ingredientCount.textContent = `${visible.length} of ${state.ingredients.length} ingredients`;
  elements.ingredientEmpty.hidden = visible.length !== 0;
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
    elements.copyList.disabled = true;
    return;
  }
  elements.shoppingList.textContent = buildShoppingList({
    items,
    ingredients: state.ingredients,
    timeframeKey: state.timeframe,
    preference: elements.customPreference.value
  });
  elements.copyList.disabled = false;
}

function renderPlan() {
  const items = selectedArray();
  const rows = items.map(createSelectedRow).filter(Boolean);
  elements.selectedItems.replaceChildren(...rows);
  elements.mealEmpty.hidden = rows.length !== 0;
  renderTotals(items);
  renderShoppingList(items);
  renderIngredients();
}

function addIngredient(id) {
  state.selected.set(id, (state.selected.get(id) || 0) + 1);
  elements.copyStatus.textContent = '';
  renderPlan();
}

function changeQuantity(id, step) {
  const next = Math.round(((state.selected.get(id) || 0) + step) * 2) / 2;
  if (next <= 0) state.selected.delete(id);
  else state.selected.set(id, next);
  renderPlan();
}

function applyTargetMode(mode) {
  state.targetMode = mode;
  const calculating = mode === 'calculate';
  elements.manualFields.hidden = calculating;
  elements.manualFields.disabled = calculating;
  elements.calculatedFields.hidden = !calculating;
  elements.calculatedFields.disabled = !calculating;
  elements.methodNote.textContent = calculating
    ? 'Quick estimate uses a moderate-activity, sex-neutral Mifflin-St Jeor baseline.'
    : 'Using the exact daily targets you enter.';
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
    } else {
      state.targets = calculateTargets({
        weightKg: document.querySelector('#calc-weight').value,
        heightCm: document.querySelector('#calc-height').value,
        age: document.querySelector('#calc-age').value,
        goal: document.querySelector('#calc-goal').value
      });
      document.querySelector('#manual-protein').value = state.targets.protein;
      document.querySelector('#manual-carbs').value = state.targets.carbs;
      document.querySelector('#manual-fats').value = state.targets.fats;
      document.querySelector('#manual-calories').value = state.targets.calories;
    }
    setStatus(`Targets applied: ${state.targets.calories} kcal · ${state.targets.protein} g protein · ${state.targets.carbs} g carbs · ${state.targets.fats} g fats.`, 'success');
    renderPlan();
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
  document.querySelectorAll('input[name="target-mode"]').forEach((input) => input.addEventListener('change', () => applyTargetMode(input.value)));
  elements.macroForm.addEventListener('submit', applyTargets);
  document.querySelectorAll('input[name="timeframe"]').forEach((input) => input.addEventListener('change', () => { state.timeframe = input.value; renderPlan(); }));
  document.querySelectorAll('input[name="diet-filter"]').forEach((input) => input.addEventListener('change', () => { state.filters[input.value] = input.checked; renderIngredients(); }));
  elements.customPreference.addEventListener('input', () => renderShoppingList(selectedArray()));
  elements.ingredientGrid.addEventListener('click', (event) => { const id = event.target.closest('[data-add-ingredient]')?.dataset.addIngredient; if (id) addIngredient(id); });
  elements.selectedItems.addEventListener('click', (event) => {
    const removeId = event.target.closest('[data-remove-ingredient]')?.dataset.removeIngredient;
    if (removeId) { state.selected.delete(removeId); renderPlan(); return; }
    const stepButton = event.target.closest('[data-quantity-step]');
    if (stepButton) changeQuantity(stepButton.dataset.ingredientId, Number(stepButton.dataset.quantityStep));
  });
  elements.copyList.addEventListener('click', copyShoppingList);
  elements.saveMealForm.addEventListener('submit', saveMeal);
  elements.savedMeals.addEventListener('click', (event) => { const id = event.target.closest('[data-load-meal]')?.dataset.loadMeal; if (id) loadMeal(id); });
}

async function initialize() {
  bindEvents();
  state.saved = readStoredMeals();
  renderSavedMeals();
  try {
    const response = await fetch('./data/ingredients.json');
    if (!response.ok) throw new Error('Ingredient data could not be loaded.');
    const ingredients = await response.json();
    if (!Array.isArray(ingredients) || ingredients.length === 0) throw new Error('Ingredient data is empty.');
    state.ingredients = ingredients;
    renderPlan();
    setStatus(`${ingredients.length} local ingredients ready. Calculations stay on this device.`, 'success');
  } catch (error) {
    elements.ingredientCount.textContent = 'Unavailable';
    elements.ingredientEmpty.hidden = false;
    elements.ingredientEmpty.textContent = 'The local ingredient dataset could not be loaded. Refresh to retry.';
    setStatus(error.message, 'error');
  }
}

initialize();
