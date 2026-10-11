import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-serif-display/400.css';
import './style.css';
import { KEY, NUTRIENTS, MEALS, dateKey, shiftDate, totals, emptyState, validateState, parseLabel, productFood, copyDay } from './data.js';
import { readState, writeState } from './storage.js';
import { icon } from './icons.js';
import { createBarcodeScanner } from './camera.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const num = value => Math.round(value || 0).toLocaleString();
const gram = value => value == null ? '—' : `${Math.round(value * 10) / 10}g`;
let state, storageProblem = false, rawRecovery = null;
try { state = readState(localStorage); } catch { state = emptyState(); storageProblem = true; try { rawRecovery = localStorage.getItem(KEY); } catch {} }
let tab = 'today', selectedDate = dateKey(), search = '', foodFilter = 'all', persistent = null, scannerControls = null, scanSession = 0, toastTimer, installPrompt;
let offlineStatus = 'Preparing offline access…';
const modal = $('#modal');
function toast(message, action) {
  clearTimeout(toastTimer);
  $('#toast').innerHTML = `${esc(message)}${action ? '<button id="toast-action">Undo</button>' : ''}`;
  $('#toast').classList.add('visible');
  if (action) $('#toast-action').onclick = () => { action(); $('#toast').classList.remove('visible'); };
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), action ? 8000 : 4500);
}
function commit(next, recovery = false) {
  if (storageProblem && !recovery) { toast('Restore a backup in Settings before changing this unreadable log.'); return false; }
  try { writeState(localStorage, next); state = next; storageProblem = false; render(); return true; }
  catch { toast('Could not save on this device. Your previous log is unchanged. Export a backup in Settings.'); return false; }
}
function modify(change) { const next = structuredClone(state); change(next); return commit(next); }
function stopScan() {
  scannerControls?.stop(); scannerControls = null;
  scanSession++;
  $('#scanner-video')?.srcObject?.getTracks().forEach(track => track.stop());
}
function closeModal() { stopScan(); modal.close(); }
modal.addEventListener('close', stopScan);
modal.addEventListener('cancel', stopScan);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopScan(); });
window.addEventListener('pagehide', stopScan);
function showModal(title, content, subtitle = '') {
  stopScan();
  modal.innerHTML = `<div class="dialog-head"><div><p class="eyebrow">DAILY FUEL</p><h2>${esc(title)}</h2>${subtitle ? `<p class="muted">${esc(subtitle)}</p>` : ''}</div><button type="button" class="icon-button" data-close aria-label="Close dialog">${icon('close')}</button></div>${content}`;
  if (!modal.open) modal.showModal();
  $('[data-close]').onclick = closeModal;
}
function prettyDate(key, options = { month: 'short', day: 'numeric' }) { return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, options); }
function dateTitle() { return selectedDate === dateKey() ? 'Today, at a glance.' : `${prettyDate(selectedDate)}, at a glance.`; }
function navigation() {
  return `<nav class="bottom-nav" aria-label="Main navigation">${[['today', 'home', 'Today'], ['foods', 'book', 'Foods'], ['history', 'chart', 'History'], ['settings', 'settings', 'Settings']].map(([id, symbol, title]) => `<button data-tab="${id}" class="nav-item ${tab === id ? 'active' : ''}" ${tab === id ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${title}</span></button>`).join('')}</nav>`;
}
function render() {
  $('#app').innerHTML = `<div class="app-shell"><header class="brand-bar"><button class="brand" data-tab="today"><span class="brand-mark">${icon('leaf')}</span>daily fuel<span class="brand-dot">.</span></button><span class="device-tag">${icon('shield')} ${navigator.onLine ? 'On your device' : 'Offline · saved foods ready'}</span></header><main>${storageProblem ? '<div class="notice warning">Your existing log could not be read. It has been preserved. Open Settings to export the original file or restore a backup.</div>' : ''}${tab === 'today' ? todayView() : tab === 'foods' ? foodsView() : tab === 'history' ? historyView() : settingsView()}</main>${navigation()}</div>`;
  bindCommon();
  if (tab === 'foods') bindFoods();
  if (tab === 'settings') { bindSettings(); $('#offline-status').textContent = offlineStatus; }
}
function nutrientCard(name, label, total, color) {
  const goal = state.goals[name];
  return `<div class="macro"><div class="macro-label"><span class="color-dot" style="background:${color}"></span>${label}</div><p><strong>${num(total)}</strong><span> / ${goal ? `${num(goal)}g` : 'no target'}</span></p><div class="mini-track"><span style="width:${goal ? Math.min(100, total / goal * 100) : 0}%;background:${color}"></span></div></div>`;
}
function todayView() {
  const entries = state.entries.filter(entry => entry.date === selectedDate);
  const t = totals(entries), ratio = Math.min(1, t.calories / state.goals.calories);
  const remaining = state.goals.calories - t.calories;
  const proteinGoal = state.goals.protein;
  return `<section class="page-intro"><div><p class="eyebrow">A LITTLE CLARITY. EVERY DAY.</p><h1>${dateTitle()}</h1><p class="intro-copy">Good food. A little intention. Your own pace.</p></div><div class="date-picker"><button class="icon-button rotate" data-date-shift="-1" aria-label="Previous day">${icon('chevron')}</button><label class="date-display"><span>${selectedDate === dateKey() ? 'Today' : prettyDate(selectedDate)}</span><input aria-label="Log date" type="date" id="log-date" value="${selectedDate}" max="${dateKey()}"></label><button class="icon-button" data-date-shift="1" aria-label="Next day" ${selectedDate >= dateKey() ? 'disabled' : ''}>${icon('chevron')}</button></div></section>
  ${!state.onboarded ? `<button class="welcome-banner" data-goals><span class="welcome-symbol">${icon('sun')}</span><span><strong>Make this day yours.</strong><span>Set your calorie and protein goals to get started.</span></span>${icon('arrow')}</button>` : ''}
  <section class="dashboard-grid" aria-label="Daily nutrition"><div class="calorie-card"><div class="card-top"><p class="eyebrow">YOUR DAILY ENERGY</p><button class="text-button" data-goals>Set goals ${icon('arrow')}</button></div><div class="energy-content"><div class="ring" style="--progress:${ratio * 360}deg"><div class="ring-center"><span class="ring-leaf">${icon('leaf')}</span><strong>${num(t.calories)}</strong><span>kcal eaten</span></div></div><div class="energy-info"><p class="remaining-label">${remaining >= 0 ? 'Room for more' : 'Above your target'}</p><strong>${num(Math.abs(remaining))}<span> kcal</span></strong><p>of ${num(state.goals.calories)} kcal daily goal</p><div class="goal-legend"><span></span>${entries.length ? 'Every meal adds up.' : 'A fresh start for your day.'}</div></div></div><div class="macro-row">${nutrientCard('carbs', 'Carbs', t.carbs, 'var(--accent)')}${nutrientCard('fat', 'Fat', t.fat, 'var(--pink)')}${nutrientCard('fiber', 'Fiber', t.fiber, 'var(--lavender)')}</div></div>
  <div class="protein-card"><div class="card-top"><p class="eyebrow">PROTEIN, PRIORITIZED</p><span class="pill">${proteinGoal ? `${num(proteinGoal)}g goal` : 'No target'}</span></div><div class="protein-number">${num(t.protein)}<span>g</span></div><p class="protein-copy">${!proteinGoal ? 'Set a target that works for you.' : t.protein >= proteinGoal ? 'Your protein goal is met.' : `${num(Math.max(0, proteinGoal - t.protein))}g to your daily goal.`}</p><div class="protein-track"><span style="width:${proteinGoal ? Math.min(100, t.protein / proteinGoal * 100) : 0}%"></span></div><div class="protein-footer">${icon('check')} One meal at a time.</div><div class="protein-art" aria-hidden="true"><span></span><span></span><span></span></div></div></section>
  <section class="quick-actions" aria-label="Add food"><button class="primary quick-primary" data-add>${icon('plus')}<span>Add food<small>Make it a meal</small></span>${icon('arrow')}</button><button data-scan class="quick-secondary">${icon('barcode')}<span>Scan barcode<small>Find a packaged food</small></span></button><button data-label class="quick-secondary">${icon('camera')}<span>Read a label<small>Photo to nutrition</small></span></button></section>
  ${state.entries.length && (!state.lastBackup || shiftDate(state.lastBackup, 7) <= dateKey()) ? '<div class="backup-banner"><span>A little backup goes a long way. Save a copy of your log.</span><button data-tab="settings">Back up</button></div>' : ''}
  <section class="food-diary"><div class="section-heading"><div><p class="eyebrow">THE SMALL THINGS ADD UP</p><h2>Your food diary</h2></div><button class="text-button" data-copy>${icon('copy')} Copy yesterday</button></div>${entries.some(entry => NUTRIENTS.slice(1).some(key => entry.food[key] == null)) ? '<p class="incomplete">Some foods have missing macros. Totals include known values only.</p>' : ''}<div class="meal-grid">${MEALS.map((meal, index) => { const foods = entries.filter(entry => entry.meal === meal); return `<article class="meal-card"><div class="meal-head"><div><span class="meal-num">0${index + 1}</span><h3>${meal}</h3></div><span class="meal-total">${num(totals(foods).calories)} kcal</span><button class="icon-button small" data-add="${meal}" aria-label="Add ${meal.toLowerCase()}">${icon('plus')}</button></div>${foods.length ? `<div class="entries">${foods.map(entry => `<button class="entry" data-edit="${entry.id}"><span class="food-avatar">${esc(entry.food.name.slice(0, 1).toUpperCase())}</span><span class="entry-description"><strong>${esc(entry.food.name)}</strong><span>${Math.round(entry.quantity * 100) / 100} × ${esc(entry.food.serving)} · ${gram(entry.food.protein == null ? null : entry.food.protein * entry.quantity)} protein</span></span><span class="entry-energy">${num(entry.food.calories * entry.quantity)}<small>kcal</small></span></button>`).join('')}</div>` : `<button class="meal-empty" data-add="${meal}"><span>A little something for ${meal.toLowerCase()}?</span><span>Add your first food ${icon('plus')}</span></button>`}</article>`; }).join('')}</div></section><footer class="page-footer">A record of your day. No judgment attached.</footer>`;
}
function foodRow(food) {
  return `<div class="library-food"><button class="food-select" data-food="${food.id}"><span class="food-avatar">${esc(food.name.slice(0, 1).toUpperCase())}</span><span><strong>${esc(food.name)}</strong><small>${esc(food.serving)} · ${num(food.calories)} kcal · ${gram(food.protein)} protein</small></span>${icon('plus')}</button><button class="icon-button favorite ${food.favorite ? 'is-favorite' : ''}" data-favorite="${food.id}" aria-label="${food.favorite ? 'Unfavorite' : 'Favorite'} ${esc(food.name)}">${icon('star')}</button></div>`;
}
function foodsView() {
  const foods = state.foods.filter(food => (foodFilter !== 'favorites' || food.favorite) && `${food.name} ${food.brand || ''} ${food.barcode || ''}`.toLowerCase().includes(search.toLowerCase())).slice().reverse();
  return `<section class="page-intro"><div><p class="eyebrow">YOUR EVERYDAY ROTATION</p><h1>Good food, on repeat.</h1><p class="intro-copy">Your saved foods. Ready whenever you are.</p></div><button class="primary" data-custom>${icon('plus')} Create food</button></section><div class="library-toolbar"><label class="search-box">${icon('search')}<input type="search" id="food-search" placeholder="Search foods, brands, or barcodes" value="${esc(search)}" aria-label="Search saved foods"></label><div class="segmented"><button data-filter="all" class="${foodFilter === 'all' ? 'selected' : ''}">All foods</button><button data-filter="favorites" class="${foodFilter === 'favorites' ? 'selected' : ''}">${icon('star')} Favorites</button></div></div><section class="library-list">${foods.length ? foods.map(foodRow).join('') : `<div class="empty-state"><span class="empty-icon">${icon('book')}</span><h2>${state.foods.length ? 'No matching foods.' : 'Your food library starts here.'}</h2><p>${state.foods.length ? 'Try another search or switch to all foods.' : 'Log a food or scan a barcode. It will be saved here for next time.'}</p><button class="primary" data-add>${icon('plus')} Add a food</button></div>`}</section><p class="footnote">Saved foods stay on your device and can be used offline.</p>`;
}
function historyView() {
  const days = Array.from({ length: 7 }, (_, i) => { const date = shiftDate(dateKey(), i - 6), entries = state.entries.filter(entry => entry.date === date); return { date, count: entries.length, ...totals(entries) }; });
  const logged = days.filter(day => day.count), average = logged.length ? logged.reduce((sum, day) => sum + day.calories, 0) / logged.length : 0;
  const max = Math.max(state.goals.calories, ...days.map(day => day.calories), 1);
  const allDates = [...new Set(state.entries.map(entry => entry.date))].sort().reverse();
  return `<section class="page-intro"><div><p class="eyebrow">A LITTLE PERSPECTIVE</p><h1>See your rhythm.</h1><p class="intro-copy">A week of small choices, all in one place.</p></div></section><section class="history-card"><div class="section-heading"><div><h2>The last seven days</h2><p class="muted">${logged.length ? `${num(average)} kcal average across ${logged.length} logged ${logged.length === 1 ? 'day' : 'days'}` : 'Start logging to see your daily pattern.'}</p></div><span class="pill">${num(state.goals.calories)} kcal target</span></div><div class="week-chart" role="img" aria-label="Calories across the last seven days">${days.map(day => `<button class="chart-day" data-open-date="${day.date}" aria-label="${prettyDate(day.date)}: ${day.count ? `${num(day.calories)} calories` : 'not logged'}"><span class="bar-number">${day.count ? num(day.calories) : '—'}</span><span class="bar-space"><span class="bar ${day.date === dateKey() ? 'today-bar' : ''}" style="height:${day.count ? Math.max(3, day.calories / max * 100) : 3}%"></span></span><span>${prettyDate(day.date, { weekday: 'short' })}</span><small>${prettyDate(day.date, { day: 'numeric' })}</small></button>`).join('')}</div><p class="footnote">Unlogged days are excluded from the average. Target shown is your current goal.</p></section><div class="section-heading"><h2>Your past days</h2></div><section class="day-list">${allDates.length ? allDates.map(date => { const entries = state.entries.filter(entry => entry.date === date), t = totals(entries); return `<button class="history-day" data-open-date="${date}"><span><strong>${prettyDate(date, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</strong><small>${entries.length} ${entries.length === 1 ? 'food' : 'foods'} logged · ${num(t.protein)}g protein</small></span><span>${num(t.calories)} <small>kcal</small>${icon('chevron')}</span></button>`; }).join('') : '<div class="empty-state compact"><h3>Your story is still beginning.</h3><p>Logged days will appear here.</p></div>'}</section>`;
}
function settingsView() {
  return `<section class="page-intro"><div><p class="eyebrow">MAKE IT YOURS</p><h1>Your goals. Your pace.</h1><p class="intro-copy">A few thoughtful settings for your everyday routine.</p></div></section><section class="settings-grid"><article class="settings-card"><div class="section-heading"><h2>Daily goals</h2><button class="text-button" data-goals>Edit ${icon('edit')}</button></div><div class="goal-lines">${NUTRIENTS.map(key => `<div><span>${key.charAt(0).toUpperCase() + key.slice(1)}</span><strong>${state.goals[key] ? num(state.goals[key]) + (key === 'calories' ? ' kcal' : ' g') : 'No target'}</strong></div>`).join('')}</div><p class="footnote">These are editable starting values, not personalized nutrition recommendations.</p></article><article class="settings-card"><span class="settings-symbol">${icon('shield')}</span><h2>Saved on your device</h2><p>Your meals, goals, and saved foods stay here. No account, no cloud upload.</p><div class="storage-status"><span class="status-dot"></span>${persistent === true ? 'Persistent storage granted' : persistent === false ? 'Standard device storage' : 'Checking storage protection…'}</div><p class="footnote">${persistent === true ? 'Protected against automatic browser eviction. Explicitly clearing website data can still erase your log.' : 'Request protection against automatic browser eviction. The browser decides whether to grant it.'}</p><button class="secondary full" id="persist-storage">${icon('shield')} Protect saved data</button></article><article class="settings-card"><span class="settings-symbol">${icon('download')}</span><h2>A backup is peace of mind.</h2><p>Export your complete log to Files. Restore it here whenever you need it.</p><div class="button-row"><button class="primary" id="export-data">${icon('download')} Export backup</button><label class="secondary file-button">Import backup<input id="import-data" type="file" accept="application/json,.json"></label></div>${rawRecovery ? '<button class="text-button" id="export-recovery">Download unreadable original</button>' : ''}<p class="footnote">${state.lastBackup ? `Last export: ${prettyDate(state.lastBackup, { month: 'short', day: 'numeric', year: 'numeric' })}.` : 'No backup exported yet. A weekly backup is a good habit.'}</p></article><article class="settings-card"><span class="settings-symbol">${icon('home')}</span><h2>A place on your home screen.</h2><p id="offline-status" class="storage-status" role="status"></p><p>Install Daily Fuel for a focused app experience and easy access.</p>${installPrompt ? '<button class="primary" id="install-app">Install Daily Fuel</button>' : '<div class="install-steps"><strong>iPhone</strong><span>Safari → Share → Add to Home Screen</span><strong>Android</strong><span>Chrome menu → Add to Home screen / Install app</span></div>'}<p class="footnote">Use the installed app consistently. Browser tabs and home-screen apps can have separate storage on some devices.</p></article></section><article class="about-card"><span class="brand">daily fuel<span class="brand-dot">.</span></span><p>A little clarity for your everyday nutrition.</p><p class="footnote">Barcode nutrition from <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a>, available under <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL</a>. Always check serving sizes and product labels. Label photos are processed on your device; the OCR runtime and language model download over the internet.</p></article>`;
}
function bindCommon() {
  document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { tab = button.dataset.tab; render(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  document.querySelectorAll('[data-goals]').forEach(button => button.onclick = goalsDialog);
  document.querySelectorAll('[data-add]').forEach(button => button.onclick = () => addDialog(button.dataset.add || defaultMeal()));
  document.querySelectorAll('[data-custom]').forEach(button => button.onclick = () => foodForm({}, { saveOnly: true }));
  document.querySelectorAll('[data-scan]').forEach(button => button.onclick = barcodeDialog);
  document.querySelectorAll('[data-label]').forEach(button => button.onclick = labelDialog);
  document.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => { const entry = state.entries.find(item => item.id === button.dataset.edit); foodForm(entry.food, { entry, meal: entry.meal }); });
  document.querySelectorAll('[data-food]').forEach(button => button.onclick = () => foodForm(state.foods.find(food => food.id === button.dataset.food), { meal: defaultMeal() }));
  document.querySelectorAll('[data-favorite]').forEach(button => button.onclick = () => { modify(next => { const food = next.foods.find(item => item.id === button.dataset.favorite); food.favorite = !food.favorite; }); });
  document.querySelectorAll('[data-open-date]').forEach(button => button.onclick = () => { selectedDate = button.dataset.openDate; tab = 'today'; render(); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-date-shift]').forEach(button => button.onclick = () => { selectedDate = shiftDate(selectedDate, Number(button.dataset.dateShift)); render(); });
  if ($('#log-date')) $('#log-date').onchange = event => { if (event.target.value && event.target.value <= dateKey()) { selectedDate = event.target.value; render(); } };
  if ($('[data-copy]')) $('[data-copy]').onclick = copyDialog;
}
function bindFoods() {
  $('#food-search').oninput = event => { search = event.target.value; const cursor = event.target.selectionStart; render(); $('#food-search').focus(); try { $('#food-search').setSelectionRange(cursor, cursor); } catch {} };
  document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { foodFilter = button.dataset.filter; render(); });
}
function defaultMeal() { const hour = new Date().getHours(); return hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 21 ? 'Dinner' : 'Snacks'; }
function goalsDialog() {
  showModal('A target that works for you.', `<form id="goals-form"><p class="notice">Choose your own targets. Starting values are examples; you can change them any time.</p><div class="form-grid">${NUTRIENTS.map(key => `<label>${key.charAt(0).toUpperCase() + key.slice(1)} <span class="unit">${key === 'calories' ? 'kcal / day' : 'g / day'}</span><input name="${key}" type="number" inputmode="decimal" min="${key === 'calories' ? 1 : 0}" max="10000" step="1" value="${state.goals[key]}" required></label>`).join('')}</div><p class="footnote">Use 0 to turn off a protein, carbs, fat, or fiber target.</p><button class="primary full" type="submit">Save my goals ${icon('check')}</button></form>`);
  $('#goals-form').onsubmit = event => { event.preventDefault(); const values = new FormData(event.target); if (modify(next => { NUTRIENTS.forEach(key => next.goals[key] = Number(values.get(key))); next.onboarded = true; })) { closeModal(); toast('Your goals are saved.'); requestPersistence(); } };
}
function addDialog(meal) {
  const recent = state.foods.slice().reverse().slice(0, 8);
  showModal(`Add to ${meal.toLowerCase()}.`, `<div class="add-options"><button class="option-card" id="manual-food">${icon('edit')}<span><strong>Enter a food</strong><small>Calories, macros, and a serving</small></span>${icon('chevron')}</button><button class="option-card" id="scan-food">${icon('barcode')}<span><strong>Scan a barcode</strong><small>Look up a packaged food</small></span>${icon('chevron')}</button><button class="option-card" id="label-food">${icon('camera')}<span><strong>Read a nutrition label</strong><small>Review values from a photo</small></span>${icon('chevron')}</button></div>${recent.length ? `<h3 class="recent-heading">Recently saved</h3><div class="recent-foods">${recent.map(food => `<button class="option-card" data-recent="${food.id}"><span class="food-avatar">${esc(food.name.slice(0, 1).toUpperCase())}</span><span><strong>${esc(food.name)}</strong><small>${num(food.calories)} kcal · ${gram(food.protein)} protein / ${esc(food.serving)}</small></span>${icon('plus')}</button>`).join('')}</div>` : '<p class="footnote">Foods you log will be saved here for next time.</p>'}`);
  $('#manual-food').onclick = () => foodForm({}, { meal });
  $('#scan-food').onclick = () => barcodeDialog(meal);
  $('#label-food').onclick = () => labelDialog(meal);
  document.querySelectorAll('[data-recent]').forEach(button => button.onclick = () => foodForm(state.foods.find(food => food.id === button.dataset.recent), { meal }));
}
function foodForm(food = {}, options = {}) {
  const { entry, saveOnly = false, meal = defaultMeal(), ocrText } = options;
  const id = food.id || crypto.randomUUID();
  showModal(entry ? 'Fine-tune this food.' : food.source ? 'Check it, then log it.' : saveOnly ? 'Save something good.' : 'Something good to eat.', `<form id="food-form"><div class="form-grid"><label class="full-field">Food name<input name="name" value="${esc(food.name || '')}" placeholder="e.g. Greek yogurt" maxlength="200" required></label><label class="full-field">Nutrition is for this serving<input name="serving" value="${esc(food.serving || '1 serving')}" maxlength="200" required></label><label class="full-field">Serving weight <span class="unit">grams · optional</span><input name="grams" type="number" inputmode="decimal" min="0.01" max="100000" step="any" value="${food.grams || ''}" placeholder="For logging by weight"></label>${NUTRIENTS.map(key => `<label>${key.charAt(0).toUpperCase() + key.slice(1)} <span class="unit">${key === 'calories' ? 'kcal' : 'g'}</span><input name="${key}" type="number" inputmode="decimal" min="0" max="10000" step="any" value="${food[key] == null ? '' : Math.round(food[key] * 100) / 100}" ${key === 'calories' ? 'required' : ''} placeholder="${key === 'calories' ? 'Required' : 'Unknown'}"></label>`).join('')}</div>${food.source ? `<p class="notice">${esc(food.source)}${food.brand ? ' · ' + esc(food.brand) : ''}. Check every value and serving size against the package. Blank macros are unknown.</p>` : '<p class="footnote">All values above are per serving. Leave unknown macros blank.</p>'}${ocrText ? `<details class="ocr-details"><summary>View recognized label text</summary><pre>${esc(ocrText)}</pre></details>` : ''}${!saveOnly ? `<div class="portion-section"><h3>Your portion</h3><div class="form-grid"><label>Amount<input name="quantity" type="number" inputmode="decimal" min="0.01" max="10000" step="any" value="${entry?.quantity || 1}" required></label><label>Unit<select name="unit"><option value="servings">Servings</option><option value="grams">Grams</option></select></label><label>Meal<select name="meal">${MEALS.map(item => `<option ${item === meal ? 'selected' : ''}>${item}</option>`).join('')}</select></label><label>Date<input name="date" type="date" value="${entry?.date || selectedDate}" max="${dateKey()}" required></label></div><div class="portion-preview" id="portion-preview"></div></div>` : ''}<label class="checkbox-label"><input type="checkbox" name="favorite" ${food.favorite ? 'checked' : ''}> Add to favorites</label><p id="form-error" class="form-error" role="alert"></p><button class="primary full" type="submit">${entry ? 'Save changes' : saveOnly ? 'Save food' : 'Add to diary'} ${icon('check')}</button>${entry ? '<button class="danger-button full" type="button" id="remove-entry">Remove this entry</button>' : ''}</form>`);
  const form = $('#food-form');
  const preview = () => {
    if (saveOnly) return;
    const values = new FormData(form), grams = Number(values.get('grams'));
    const amount = Number(values.get('quantity'));
    const quantity = values.get('unit') === 'grams' ? grams > 0 ? amount / grams : null : amount;
    $('#portion-preview').innerHTML = quantity == null ? 'Add a serving weight above to log by grams.' : `<strong>${num(Number(values.get('calories')) * quantity)} kcal</strong><span>${values.get('protein') === '' ? 'Unknown' : gram(Number(values.get('protein')) * quantity)} protein · ${Math.round(quantity * 100) / 100} servings</span>`;
  };
  form.addEventListener('input', preview); preview();
  form.onsubmit = event => {
    event.preventDefault();
    const values = new FormData(form), grams = values.get('grams') === '' ? null : Number(values.get('grams'));
    if (!saveOnly && values.get('unit') === 'grams' && !grams) { $('#form-error').textContent = 'Add the serving weight in grams to use a gram portion.'; return; }
    const reviewed = { ...food, id, name: String(values.get('name')).trim(), serving: String(values.get('serving')).trim(), grams, favorite: values.has('favorite'), ...Object.fromEntries(NUTRIENTS.map(key => [key, values.get(key) === '' ? null : Number(values.get(key))])) };
    if (!reviewed.name || !reviewed.serving) { $('#form-error').textContent = 'Enter a food name and serving description.'; return; }
    const quantity = saveOnly ? 1 : Number(values.get('quantity')) / (values.get('unit') === 'grams' ? grams : 1);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) { $('#form-error').textContent = 'Choose a portion between 0 and 10,000 servings.'; return; }
    const next = structuredClone(state);
    // Preserve earlier entry snapshots even when the saved library food changes.
    const index = next.foods.findIndex(item => item.id === id);
    if (index >= 0) next.foods[index] = reviewed; else next.foods.push(reviewed);
    if (!saveOnly) {
      const record = { id: entry?.id || crypto.randomUUID(), food: structuredClone(reviewed), date: String(values.get('date')), meal: String(values.get('meal')), quantity };
      const entryIndex = next.entries.findIndex(item => item.id === record.id);
      if (entryIndex >= 0) next.entries[entryIndex] = record; else next.entries.push(record);
    }
    if (commit(next)) { closeModal(); toast(saveOnly ? 'Food saved for next time.' : entry ? 'Entry updated.' : 'Added to your diary.'); requestPersistence(); }
  };
  if (entry) $('#remove-entry').onclick = () => {
    const removed = structuredClone(entry);
    if (modify(next => { next.entries = next.entries.filter(item => item.id !== entry.id); })) { closeModal(); toast('Entry removed.', () => modify(next => { if (!next.entries.some(item => item.id === removed.id)) next.entries.push(removed); })); }
  };
}
function copyDialog() {
  const from = shiftDate(selectedDate, -1), records = copyDay(state.entries, from, selectedDate);
  if (!records.length) { toast('No foods logged on the previous day.'); return; }
  showModal('A familiar kind of day.', `<p>Copy ${records.length} ${records.length === 1 ? 'food' : 'foods'} from ${prettyDate(from)} into ${prettyDate(selectedDate)}?</p><p class="notice">This adds to your existing diary for that day. Portions and meals stay the same.</p><button class="primary full" id="confirm-copy">Copy ${records.length} foods ${icon('copy')}</button>`);
  $('#confirm-copy').onclick = () => { if (modify(next => next.entries.push(...records))) { closeModal(); toast('Previous day copied.'); } };
}
async function lookupBarcode(code, meal) {
  const cleaned = code.replace(/[\s-]/g, '');
  if (!/^\d{8,14}$/.test(cleaned)) { toast('Enter an 8–14 digit food barcode.'); return; }
  const saved = state.foods.find(food => food.barcode === cleaned);
  if (saved) { foodForm(saved, { meal }); return; }
  if (!navigator.onLine) { toast('Connect to the internet to look up a new barcode. Saved foods work offline.'); return; }
  const status = $('#barcode-status');
  if (status) status.textContent = 'Looking up your food…';
  const session = scanSession;
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${cleaned}.json?fields=product_name,generic_name,brands,serving_size,serving_quantity,nutriments`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Lookup unavailable');
    const data = await response.json();
    if (!modal.open || session !== scanSession) return;
    if (data.status !== 1 || !data.product) {
      showModal('Let’s add this one.', `<p>This barcode isn’t in the food database yet. You can enter the nutrition from its label and save it for next time.</p><button class="primary full" id="unknown-manual">Enter nutrition ${icon('edit')}</button>`);
      $('#unknown-manual').onclick = () => foodForm({ barcode: cleaned }, { meal });
      return;
    }
    const food = productFood(data.product, cleaned);
    foodForm(food, { meal });
  } catch {
    if (modal.open && session === scanSession && status?.isConnected) status.textContent = 'Lookup failed. Try again, use a saved food, or enter this food manually.';
  }
}
function barcodeDialog(meal = defaultMeal()) {
  showModal('Scan. Check. Enjoy.', `<p class="muted">Point the back camera at a food barcode, or type its number below.</p><div class="scanner-frame"><video id="scanner-video" autoplay playsinline webkit-playsinline muted aria-label="Barcode camera preview"></video><div class="scan-guide"></div><button class="primary" id="start-camera">${icon('camera')} Start camera</button></div><div class="scanner-actions"><button class="secondary full" id="stop-camera" type="button" hidden>Stop camera</button></div><p id="barcode-status" class="footnote" role="status">Camera access starts only when you tap Start camera.</p><form id="barcode-form"><label>Barcode number<input name="barcode" inputmode="numeric" pattern="[0-9 -]{8,20}" placeholder="e.g. 737628064502" required></label><button class="primary full" type="submit">Look up food ${icon('search')}</button></form><button class="text-button full" id="barcode-manual">Enter food manually instead</button><p class="footnote">Nutrition lookup by Open Food Facts. New lookups require internet.</p>`);
  $('#barcode-form').onsubmit = event => { event.preventDefault(); stopScan(); lookupBarcode(String(new FormData(event.target).get('barcode')), meal); };
  $('#barcode-manual').onclick = () => foodForm({}, { meal });
  $('#stop-camera').onclick = stopScan;
  $('#start-camera').onclick = event => {
    const button = event.currentTarget;
    if (button.dataset.cameraPhase === 'needs-play' && scannerControls) { scannerControls.resume(); return; }
    stopScan();
    const session = scanSession;
    const status = $('#barcode-status'), stopButton = $('#stop-camera');
    scannerControls = createBarcodeScanner({
      video: $('#scanner-video'), mediaDevices: navigator.mediaDevices,
      loadReader: async () => { const { BrowserMultiFormatReader } = await import('@zxing/browser'); return new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 200 }); },
      onState: ({ phase, message }) => {
        if (session !== scanSession || !button.isConnected || !modal.open) return;
        button.dataset.cameraPhase = phase;
        button.disabled = ['requesting','starting','loading'].includes(phase);
        button.hidden = ['loading','scanning'].includes(phase);
        stopButton.hidden = ['idle','error'].includes(phase);
        const action = phase === 'needs-play' ? 'Play camera' : phase === 'error' ? 'Retry camera' : button.disabled ? 'Starting camera…' : 'Start camera';
        button.innerHTML = `${icon('camera')} ${action}`;
        const messages = { idle:'Camera stopped. Tap Start camera to scan again, or type the barcode below.', requesting:'Requesting camera access… Respond to the permission prompt.', starting:'Starting the camera preview…', loading:'Camera ready. Preparing the barcode scanner…', scanning:'Camera is live. Keep the barcode inside the frame. Good light helps.' };
        status.textContent = message || messages[phase];
      },
      onResult: code => { if (session === scanSession && modal.open) { stopScan(); lookupBarcode(code, meal); } },
    });
    scannerControls.start();
  };
}
function labelDialog(meal = defaultMeal()) {
  showModal('From label to log.', `<div class="label-intro"><span class="empty-icon">${icon('camera')}</span><p>A clear, close photo of the nutrition panel works best. Include the serving size.</p></div><label class="primary full file-button" id="label-upload">${icon('camera')} Choose or take a photo<input id="label-image" type="file" accept="image/*"></label><p id="ocr-status" class="notice" role="status">The photo is read on your device. First use downloads the recognition engine and English model.</p><button class="text-button full" id="label-manual">Enter nutrition manually instead</button>`);
  $('#label-manual').onclick = () => foodForm({}, { meal });
  $('#label-image').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('Choose a photo smaller than 20 MB.'); return; }
    const session = scanSession;
    const status = $('#ocr-status');
    event.target.disabled = true;
    status.textContent = 'Preparing the label reader…';
    let worker;
    try {
      const { createWorker } = await import('tesseract.js');
      if (session !== scanSession || !modal.open) return;
      worker = await createWorker('eng', 1, { logger: message => { if (status.isConnected && session === scanSession) status.textContent = `${message.status === 'recognizing text' ? 'Reading your label' : 'Preparing recognition'}${Number.isFinite(message.progress) ? ` · ${Math.round(message.progress * 100)}%` : '…'}`; } });
      const result = await worker.recognize(file);
      if (session === scanSession && modal.open) {
        const food = parseLabel(result.data.text);
        food.source = 'Label scan — review required';
        foodForm(food, { meal, ocrText: result.data.text });
      }
    } catch {
      if (session === scanSession && status.isConnected) { status.textContent = 'Could not read this photo. Try a clearer JPEG/PNG photo with internet available, or enter the values manually.'; if ($('#label-image')) $('#label-image').disabled = false; }
    } finally { if (worker) await worker.terminate(); }
  };
}
function download(content, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function exportBackup() {
  download(JSON.stringify(state, null, 2), `daily-fuel-backup-${dateKey()}.json`);
  modify(next => next.lastBackup = dateKey());
  toast('Backup downloaded. Keep the file somewhere safe.');
}
async function requestPersistence() {
  try { persistent = navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { persistent = false; }
  if (tab === 'settings') render();
  return persistent;
}
function bindSettings() {
  $('#export-data').onclick = exportBackup;
  $('#persist-storage').onclick = async () => { const granted = await requestPersistence(); toast(granted ? 'Storage protection granted by your browser.' : 'Protection wasn’t granted. Installing to the home screen may help; keep backups.'); };
  if ($('#export-recovery')) $('#export-recovery').onclick = () => download(rawRecovery, 'daily-fuel-unreadable-original.json');
  if ($('#install-app')) $('#install-app').onclick = async () => { await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; render(); };
  $('#import-data').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    event.target.value = '';
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('This backup is too large.');
      const imported = validateState(JSON.parse(await file.text()));
      showModal('Restore your saved days.', `<p>This backup contains <strong>${imported.entries.length} meal entries</strong> and <strong>${imported.foods.length} saved foods</strong>.</p><p class="notice">Restoring replaces your current log and goals. Download a safety backup first, then restore.</p><button class="secondary full" id="safety-backup">${icon('download')} Download current log first</button><button class="primary full" id="confirm-import" disabled>Restore this backup</button>`);
      $('#safety-backup').onclick = () => { download(storageProblem && rawRecovery ? rawRecovery : JSON.stringify(state, null, 2), `daily-fuel-before-restore-${dateKey()}.json`); $('#confirm-import').disabled = false; $('#safety-backup').textContent = 'Safety backup downloaded'; };
      $('#confirm-import').onclick = () => { if (commit(imported, true)) { rawRecovery = null; closeModal(); toast('Backup restored on this device.'); } };
    } catch (error) { toast(error instanceof SyntaxError ? 'This file is not valid JSON. Your log is unchanged.' : error.message); }
  };
}
window.addEventListener('online', render); window.addEventListener('offline', render);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; if (tab === 'settings') render(); });
window.addEventListener('storage', event => { if (event.key === KEY) { try { state = readState(localStorage); storageProblem = false; render(); } catch { storageProblem = true; render(); } } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && selectedDate > dateKey()) { selectedDate = dateKey(); render(); } });
render();
navigator.storage?.persisted?.().then(result => { persistent = result; if (tab === 'settings') render(); }).catch(() => { persistent = false; });
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => {
    navigator.serviceWorker.ready.then(() => { offlineStatus = navigator.serviceWorker.controller ? "Offline ready · app is cached" : "App cached · reopen once to enable offline access"; if (tab === "settings") render(); });
    if (registration.waiting) showUpdate(registration);
    registration.addEventListener('updatefound', () => { registration.installing?.addEventListener('statechange', event => { if (event.target.state === 'installed' && navigator.serviceWorker.controller) showUpdate(registration); }); });
  }).catch(() => { offlineStatus = "Offline setup failed · reload with internet available"; if (tab === "settings") render(); toast('Offline setup couldn’t finish. Keep this page online and try reloading.'); });
}
if (!('serviceWorker' in navigator)) offlineStatus = 'Offline access is unavailable in this browser';
function showUpdate(registration) {
  const existing = $('#update-banner'); if (existing) return;
  const banner = document.createElement('div'); banner.id = 'update-banner'; banner.className = 'update-banner'; banner.innerHTML = '<span>A fresh version is ready.</span><button>Update app</button>';
  document.body.append(banner);
  banner.querySelector('button').onclick = () => { navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); registration.waiting?.postMessage('SKIP_WAITING'); };
}
