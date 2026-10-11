import test from 'node:test';
import assert from 'node:assert/strict';
import * as data from '../src/data.js';
const { totals, scaledFood, dateKey, shiftDate, emptyState, validateState, parseLabel, productFood } = data;

const food = { id: 'food-1', name: 'Yogurt', serving: '100 g', grams: 100, calories: 200, protein: 20, carbs: 15, fat: 6, fiber: null };
const entry = { id: 'entry-1', date: '2026-10-10', meal: 'Breakfast', food, quantity: 1.5 };

test('portions and totals keep fractional servings and unknown nutrients', () => {
  assert.deepEqual(totals([entry]), { calories: 300, protein: 30, carbs: 22.5, fat: 9, fiber: 0 });
  assert.equal(scaledFood(food, .75).calories, 150);
  assert.equal(scaledFood(food, .75).fiber, null);
  assert.equal(food.calories, 200);
});
test('calendar dates cross month/year boundaries locally', () => {
  assert.equal(shiftDate('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDate('2024-02-28', 1), '2024-02-29');
  assert.equal(dateKey(new Date(2026, 9, 10, 23, 59)), '2026-10-10');
});
test('valid backup round trips and malformed data is rejected', () => {
  const state = { ...emptyState(), entries: [entry], foods: [food] };
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))), state);
  const optionalZero = { ...state, goals: { ...state.goals, protein: 0 } };
  assert.equal(validateState(optionalZero).goals.protein, 0);
  for (const invalid of [
    { ...state, version: 9 },
    { ...state, goals: { ...state.goals, calories: 0 } },
    { ...state, entries: [{ ...entry, date: '2026-02-30' }] },
    { ...state, entries: [{ ...entry, quantity: -1 }] },
    { ...state, entries: [{ ...entry, quantity: '2' }] },
    { ...state, foods: [{ ...food, calories: Infinity }] },
    { ...state, entries: [entry, entry] },
  ]) assert.throws(() => validateState(invalid));
});
test('label extraction distinguishes grams from percent daily value and leaves missing values unknown', () => {
  const result = parseLabel('Nutrition Facts\nServing size 2/3 cup (55g)\nCalories 230\nTotal Fat 8g 10%\nTotal Carbohydrate 37g 13%\nDietary Fiber 4g 14%\nProtein 3g');
  assert.equal(result.calories, 230);
  assert.equal(result.grams, 55);
  assert.equal(result.protein, 3);
  assert.equal(result.carbs, 37);
  assert.equal(result.fat, 8);
  assert.equal(result.fiber, 4);
  assert.equal(parseLabel('Protein 12%').protein, null);
  assert.equal(parseLabel('Unreadable label').calories, null);
});
test('barcode lookup maps per-serving values with per-100g fallback consistently', () => {
  const result = productFood({ product_name: 'Oats', serving_quantity: 40, serving_size: '40 g', nutriments: { 'energy-kcal_100g': 375, proteins_100g: 10, carbohydrates_serving: 27 } }, '12345678');
  assert.equal(result.calories, 150);
  assert.equal(result.protein, 4);
  assert.equal(result.carbs, 27);
  assert.equal(result.fat, null);
  assert.equal(result.grams, 40);
  const hundred = productFood({ nutriments: { 'energy-kj_100g': 418.4, proteins_100g: 2 } }, '12345678');
  assert.ok(Math.abs(hundred.calories - 100) < .001);
  assert.equal(hundred.serving, '100 g');
});
test('copy previous day creates distinct IDs and independent historical snapshots', () => {
  const copied = data.copyDay([entry], '2026-10-10', '2026-10-11');
  assert.equal(copied.length, 1);
  assert.notEqual(copied[0].id, entry.id);
  assert.equal(copied[0].date, '2026-10-11');
  assert.equal(copied[0].quantity, 1.5);
  copied[0].food.name = 'Changed';
  assert.equal(entry.food.name, 'Yogurt');
  assert.deepEqual(data.copyDay([entry], '2026-10-09', '2026-10-11'), []);
});
