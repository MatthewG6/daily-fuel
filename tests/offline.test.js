import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { precacheUrls } from '../src/offline.js';
test('offline installation never caches a duplicate URL and stays under the repository path', () => {
  const urls = precacheUrls(['index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'assets/app.js'], 'https://example.com/daily-fuel/');
  assert.equal(urls.length, new Set(urls).size);
  assert.ok(urls.every(url => url.startsWith('https://example.com/daily-fuel/')));
  assert.ok(urls.includes('https://example.com/daily-fuel/assets/app.js'));
});
test('offline navigation serves the cached app shell after a network failure', async () => {
  const handlers = {}, cachedShell = { body: 'app shell' };
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const context = { URL, self: { location: new URL('https://example.com/daily-fuel/sw.js'), addEventListener: (name, handler) => handlers[name] = handler }, fetch: () => Promise.reject(new Error('offline')), caches: { match: async url => url === 'https://example.com/daily-fuel/index.html' ? cachedShell : undefined } };
  vm.runInNewContext(source, context);
  let response;
  handlers.fetch({ request: { url: 'https://example.com/daily-fuel/', method: 'GET', mode: 'navigate' }, respondWith: value => response = value, waitUntil: () => {} });
  assert.equal(await response, cachedShell);
  let intercepted = false;
  handlers.fetch({ request: { url: 'https://example.com/water-tracker/', method: 'GET', mode: 'navigate' }, respondWith: () => intercepted = true });
  assert.equal(intercepted, false);
});
