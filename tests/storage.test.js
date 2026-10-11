import test from 'node:test';
import assert from 'node:assert/strict';
import * as storage from '../src/storage.js';
import { emptyState, KEY } from '../src/data.js';
class MemoryStore {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}
test('saved goals and records load from the same device store', () => {
  const store = new MemoryStore();
  const state = emptyState();
  state.goals.calories = 2300;
  storage.writeState(store, state);
  assert.equal(storage.readState(store).goals.calories, 2300);
  assert.equal(store.getItem(KEY), JSON.stringify(state));
});
test('corrupt local data is preserved and surfaced instead of overwritten', () => {
  const store = new MemoryStore();
  store.setItem(KEY, '{corrupt');
  assert.throws(() => storage.readState(store), SyntaxError);
  assert.equal(store.getItem(KEY), '{corrupt');
});
test('failed write propagates and existing data is untouched', () => {
  const store = new MemoryStore();
  storage.writeState(store, emptyState());
  const original = store.getItem(KEY);
  store.setItem = () => { throw new Error('quota'); };
  assert.throws(() => storage.writeState(store, { ...emptyState(), onboarded: true }), /quota/);
  assert.equal(store.getItem(KEY), original);
});
