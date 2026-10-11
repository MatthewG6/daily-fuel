import { KEY, emptyState, validateState } from './data.js';
export function readState(store) {
  const raw = store.getItem(KEY);
  return raw == null ? emptyState() : validateState(JSON.parse(raw));
}
export function writeState(store, state) {
  store.setItem(KEY, JSON.stringify(validateState(state)));
}
