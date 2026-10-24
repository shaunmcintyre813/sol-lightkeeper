import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the real activation handler with synthetic origin-wide CacheStorage.
// This is a regression check, not a browser or installed-device offline test.
const source = readFileSync(new URL('../dist/sw.js', import.meta.url), 'utf8');
const prefix = 'sol-lightkeeper-';
const foreignCaches = [
  'bubble-pop-%2Fbubble-pop%2F-v10',
  'foliage-fortune-v3.1',
  'aether-drift-v2.0.0',
  'antigravity-neon-pulse-v1.1.1',
  'antigravity-hypershift-v1.2.0',
  'sol-lightkeeper-v6',
  'moonline-shell-v2',
  'unrelated-cache',
  `other-${prefix}previous`,
].filter(name => !name.startsWith(prefix));

function worker() {
  const handlers = new Map();
  const names = new Set();
  const deleted = [];
  const messages = [];
  let claims = 0;
  const context = vm.createContext({
    URL,
    self: {
      location: new URL('https://shaunmcintyre813.github.io/sol-lightkeeper/sw.js'),
      registration: { scope: 'https://shaunmcintyre813.github.io/sol-lightkeeper/' },
      skipWaiting: async () => {},
      clients: {
        claim: async () => { claims++; },
        matchAll: async () => [{ postMessage: message => messages.push(message) }],
      },
      addEventListener: (name, handler) => handlers.set(name, handler),
    },
    caches: {
      keys: async () => [...names],
      delete: async name => { deleted.push(name); return names.delete(name); },
    },
  });
  vm.runInContext(source, context, { timeout: 1000 });
  const current = vm.runInContext('CACHE', context);
  return {
    current, names, deleted, messages,
    get claims() { return claims; },
    async activate(initialNames) {
      initialNames.forEach(name => names.add(name));
      const pending = [];
      assert.equal(typeof handlers.get('activate'), 'function');
      handlers.get('activate')({ waitUntil: promise => pending.push(promise) });
      await Promise.all(pending);
    },
  };
}

test('activation removes only own obsolete caches and retains current/foreign caches', async () => {
  const state = worker();
  const obsolete = [`${prefix}previous-1`, `${prefix}previous-2`];
  assert.ok(state.current.startsWith(prefix));
  await state.activate([state.current, ...obsolete, ...foreignCaches]);
  assert.equal(state.names.has(state.current), true, 'Current cache was removed');
  assert.equal(state.deleted.filter(name => !name.startsWith(prefix)).length, 0,
    'Caches from another game were deleted');
  assert.deepEqual([...state.deleted].sort(), [...obsolete].sort());
  assert.deepEqual([...state.names].sort(), [state.current, ...foreignCaches].sort());
  assert.equal(state.claims, 1);
});

test('first install leaves existing games alone', async () => {
  const state = worker();
  await state.activate([state.current, ...foreignCaches]);
  assert.equal(state.deleted.length, 0, 'Foreign caches were treated as old app caches');
  assert.equal(state.names.size, foreignCaches.length + 1);
  assert.equal(state.claims, 1);
  assert.equal(state.messages.length, 0, 'First install announced a false update');
});

test('activation with empty storage does not invent an update', async () => {
  const state = worker();
  await state.activate([]);
  assert.deepEqual(state.deleted, []);
  assert.equal(state.claims, 1);
  assert.equal(state.messages.length, 0);
});
