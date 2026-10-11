export const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'fiber'];
export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
export const KEY = 'daily-fuel:v1';
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDate(key, amount) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}
export function emptyState() {
  return { version: 1, goals: { calories: 2000, protein: 120, carbs: 250, fat: 65, fiber: 25 }, onboarded: false, foods: [], entries: [] };
}
export function totals(entries) {
  return entries.reduce((result, entry) => {
    NUTRIENTS.forEach(key => { result[key] += (entry.food[key] || 0) * entry.quantity; });
    return result;
  }, Object.fromEntries(NUTRIENTS.map(key => [key, 0])));
}
export function scaledFood(food, factor) {
  return { ...food, ...Object.fromEntries(NUTRIENTS.map(key => [key, food[key] == null ? null : food[key] * factor])) };
}
export function copyDay(entries, from, to) {
  return entries.filter(entry => entry.date === from).map(entry => ({ ...structuredClone(entry), id: crypto.randomUUID(), date: to }));
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(new Date(`${value}T12:00:00`)) === value;
}
function validFood(food) {
  return food && typeof food.id === 'string' && typeof food.name === 'string' && food.name.trim().length > 0 && food.name.length <= 200 && typeof food.serving === 'string' && food.serving.length <= 200 &&
    typeof food.calories === 'number' && Number.isFinite(food.calories) && food.calories >= 0 && food.calories <= 10000 &&
    NUTRIENTS.slice(1).every(key => food[key] == null || (typeof food[key] === 'number' && Number.isFinite(food[key]) && food[key] >= 0 && food[key] <= 10000)) &&
    (food.grams == null || (typeof food.grams === 'number' && Number.isFinite(food.grams) && food.grams > 0 && food.grams <= 100000));
}
export function validateState(state) {
  if (!state || state.version !== 1 || !state.goals || !Array.isArray(state.foods) || !Array.isArray(state.entries)) throw new Error('This is not a Daily Fuel backup.');
  if (!NUTRIENTS.every(key => typeof state.goals[key] === 'number' && Number.isFinite(state.goals[key]) && state.goals[key] >= (key === 'calories' ? 1 : 0) && state.goals[key] <= 10000)) throw new Error('The goals in this backup are invalid.');
  if (state.foods.length > 50000 || state.entries.length > 100000 || !state.foods.every(validFood) || !state.entries.every(entry => entry && typeof entry.id === 'string' && validDate(entry.date) && MEALS.includes(entry.meal) && validFood(entry.food) && typeof entry.quantity === 'number' && Number.isFinite(entry.quantity) && entry.quantity > 0 && entry.quantity <= 10000)) throw new Error('The food records in this backup are invalid.');
  if (new Set(state.entries.map(entry => entry.id)).size !== state.entries.length || new Set(state.foods.map(food => food.id)).size !== state.foods.length) throw new Error('This backup contains duplicate records.');
  return { ...state, onboarded: Boolean(state.onboarded) };
}
export function parseLabel(text) {
  const read = pattern => {
    const match = text.match(pattern);
    return match ? Number(match[1].replace(',', '.')) : null;
  };
  const servingMatch = text.match(/serving size\s*:?\s*([^\n]+)/i);
  const serving = servingMatch ? servingMatch[1].trim().slice(0, 100) : '1 serving';
  return {
    serving, grams: read(/serving size[^\n]*?\(?\s*(\d+(?:[.,]\d+)?)\s*g\b/i),
    calories: read(/\bcalories\s*:?\s*(\d+(?:[.,]\d+)?)/i),
    protein: read(/\bprotein\s*:?\s*(\d+(?:[.,]\d+)?)\s*g\b/i),
    carbs: read(/(?:total carbohydrate|total carbs?|carbohydrates?)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g\b/i),
    fat: read(/(?:total fat|fat)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g\b/i),
    fiber: read(/(?:dietary fib(?:er|re)|fib(?:er|re))\s*:?\s*(\d+(?:[.,]\d+)?)\s*g\b/i),
  };
}
export function productFood(product, barcode) {
  const nutriments = product.nutriments || {};
  const servingGrams = Number(product.serving_quantity);
  const perServing = Number.isFinite(servingGrams) && servingGrams > 0;
  const suffix = perServing ? '_serving' : '_100g';
  const factor = perServing ? servingGrams / 100 : 1;
  const read = nutrient => {
    const value = nutriments[nutrient + suffix] ?? (nutriments[nutrient + '_100g'] != null ? nutriments[nutrient + '_100g'] * factor : null);
    return value == null || !Number.isFinite(Number(value)) ? null : Number(value);
  };
  let calories = read('energy-kcal');
  if (calories == null && read('energy-kj') != null) calories = read('energy-kj') / 4.184;
  return {
    id: crypto.randomUUID(), name: product.product_name || product.generic_name || `Product ${barcode}`,
    serving: perServing ? (product.serving_size || `${servingGrams} g`) : '100 g', grams: perServing ? servingGrams : 100,
    calories, protein: read('proteins'), carbs: read('carbohydrates'), fat: read('fat'), fiber: read('fiber'),
    barcode, brand: product.brands || '', source: 'Open Food Facts', favorite: false,
  };
}
