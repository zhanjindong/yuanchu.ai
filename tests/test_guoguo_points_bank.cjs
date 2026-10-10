'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '../product/guoguo-points-bank.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Execute the real page script with a small DOM and entirely local API/storage mocks.
// Timers and audio are disabled; generated markup is inspected as HTML strings.
function makeElement(id = '') {
  const listeners = new Map();
  const classes = new Set();
  return {
    id, value: '', textContent: '', innerHTML: '', dataset: {}, style: {},
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle(name, active) { active ? classes.add(name) : classes.delete(name); },
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    async dispatch(type) {
      for (const listener of listeners.get(type) || []) {
        await listener({ target: this, currentTarget: this });
      }
      // Confirm's click listener starts an async operation without returning it.
      await new Promise(setImmediate);
    },
    querySelectorAll: () => [],
    appendChild() {},
    remove() {},
  };
}

async function loadBank(points = 100) {
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)]
    .map(([, id]) => [id, makeElement(id)]));
  const storage = new Map([
    ['guoguo_admin_session_v1', JSON.stringify({
      username: 'test-admin', token: 'test-token', expiresAt: Date.now() + 60_000,
    })],
  ]);
  const writes = [];
  const context = vm.createContext({
    document: {
      getElementById: id => elements.get(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => makeElement(),
      body: makeElement(),
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    fetch: async (_url, options) => {
      if (options.method === 'PUT') writes.push(JSON.parse(options.body).state);
      return { ok: true, json: async () => ({}) };
    },
    location: { hostname: 'localhost' },
    window: { innerWidth: 400 },
    navigator: {},
    console: { log() {}, warn() {}, error() {} },
    structuredClone,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0,
  });
  vm.runInContext(script + `\n;globalThis.bank = {
    get state() { return state; }, onActionClick, render
  };`, context, { filename: 'guoguo-points-bank.html' });
  await new Promise(setImmediate);
  const bank = context.bank;
  bank.state.points = points;
  bank.state.goals = [];
  bank.state.history = [];
  return {
    bank, writes,
    element: id => elements.get(id),
    click: id => elements.get(id).dispatch('click'),
    storedState: () => JSON.parse(storage.get('guoguo_points_bank_v1')),
  };
}

async function addRule(app, kind, points) {
  await app.click(kind === 'earn' ? 'addEarnBtn' : 'addDeductBtn');
  app.element('ruleKindInput').value = kind;
  app.element('ruleNameInput').value = '回归测试规则';
  app.element('rulePointsInput').value = String(points);
  await app.click('ruleSave');
  return app.bank.state.rules[kind === 'earn' ? 'earn' : 'deduct'].at(-1);
}

async function confirmRule(app, rule, expectedBalance, expectedDelta) {
  const before = app.bank.state.points;
  app.bank.onActionClick(rule.id);
  assert.equal(app.bank.state.points, before, 'preview must not change the balance');
  assert.equal(app.element('confirmModal').classList.contains('show'), true);
  assert.match(app.element('confirmDiff').innerHTML,
    new RegExp(`class="confirm-diff-to">${expectedBalance}</span>`));
  await app.click('confirmOk');
  assert.equal(app.bank.state.points, expectedBalance);
  assert.equal(app.bank.state.history[0].delta, expectedDelta);
  assert.equal(app.bank.state.history[0].ruleId, rule.id);
  assert.equal(app.storedState().points, expectedBalance);
  assert.equal(app.writes.at(-1).history[0].delta, expectedDelta);
}

test('new deduct rule saves -10 and confirmation applies 100 → 90 with a -10 history entry', async () => {
  const app = await loadBank();
  const rule = await addRule(app, 'deduct', 10);
  assert.equal(rule.points, -10);
  assert.equal(app.storedState().rules.deduct.at(-1).points, -10);
  assert.equal(app.writes.at(-1).rules.deduct.at(-1).points, -10);
  await confirmRule(app, rule, 90, -10);
});

test('legacy positive deduct rules show -10 in both lists and still deduct 10', async () => {
  const app = await loadBank();
  const rule = { id: 'legacy', kind: 'deduct', points: 10, name: '旧扣分规则', emoji: '📉' };
  app.bank.state.rules.deduct = [rule];
  app.bank.render();
  assert.match(app.element('deductGrid').innerHTML, /class="action-card-points">-10<\/div>/);
  assert.match(app.element('deductRulesList').innerHTML, /class="rule-item-pts">-10<\/div>/);
  await confirmRule(app, rule, 90, -10);
});

test('default negative deduct rules still deduct 10', async () => {
  const app = await loadBank();
  const rule = app.bank.state.rules.deduct.find(rule => rule.points === -10);
  await confirmRule(app, rule, 90, -10);
});

test('deduction beyond the balance stops at zero and records only the actual deduction', async () => {
  const app = await loadBank(3);
  const rule = await addRule(app, 'deduct', 10);
  await confirmRule(app, rule, 0, -3);
  await confirmRule(app, rule, 0, 0);
});

test('new earn rules remain positive and add points', async () => {
  const app = await loadBank();
  const rule = await addRule(app, 'earn', 10);
  assert.equal(rule.points, 10);
  await confirmRule(app, rule, 110, 10);
});

test('zero rules ignore a previously entered value and clear the balance', async () => {
  const app = await loadBank();
  const rule = await addRule(app, 'zero', 10);
  assert.equal(rule.points, 0);
  await confirmRule(app, rule, 0, -100);
  assert.equal(app.bank.state.history[0].effect, '清零');
});
