'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '../product/guoguo-points-bank.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Execute the real page script with local DOM/API/storage mocks. Controllable
// timers make interaction cancellation testable without waiting on wall time.
function makeElement(id = '', notifyMutation = () => {}) {
  const listeners = new Map();
  const classes = new Set();
  const attributes = new Map();
  const children = new Map();
  let markup = '';
  const element = {
    id, value: '', textContent: '', dataset: {}, style: {}, hidden: false,
    get innerHTML() { return markup; },
    set innerHTML(value) { markup = value; children.clear(); },
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); notifyMutation(element); },
      remove(...names) { names.forEach(name => classes.delete(name)); notifyMutation(element); },
      contains: name => classes.has(name),
      toggle(name, active = !classes.has(name)) {
        active ? classes.add(name) : classes.delete(name);
        notifyMutation(element);
        return active;
      },
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) || []).filter(item => item !== listener));
    },
    async dispatch(type, extra = {}) {
      for (const listener of listeners.get(type) || []) {
        await listener({ target: this, currentTarget: this, ...extra });
      }
      // Some listeners start an async operation without returning its promise.
      await new Promise(setImmediate);
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute: name => attributes.get(name) ?? null,
    querySelectorAll(selector) {
      // Only dynamic goal buttons are needed by these tests. Reuse the same
      // nodes so rendering's event handlers also run when the test clicks one.
      const match = selector.match(/^\[data-(redeem|del-goal)\]$/);
      if (!match) return [];
      if (!children.has(selector)) {
        const attr = match[1];
        const dataKey = attr.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        children.set(selector, [...markup.matchAll(new RegExp(`data-${attr}="([^"]+)"`, 'g'))]
          .map(([, value]) => {
            const child = makeElement();
            child.dataset[dataKey] = value;
            return child;
          }));
      }
      return children.get(selector);
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    appendChild() {}, remove() {}, focus() {},
  };
  return element;
}

async function loadBank(points = 100, { loggedIn = true, reducedMotion = false } = {}) {
  const observers = new Map();
  const notifyMutation = element => {
    for (const [callback, targets] of observers) {
      if (targets.some(target => target.element === element || target.options.subtree)) queueMicrotask(callback);
    }
  };
  const elements = new Map([...html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)]
    .map(([tag, id]) => {
      const element = makeElement(id, notifyMutation);
      const classes = tag.match(/\bclass="([^"]+)"/);
      if (classes) element.classList.add(...classes[1].split(/\s+/));
      return [id, element];
    }));
  const storage = new Map(loggedIn ? [
    ['guoguo_admin_session_v1', JSON.stringify({
      username: 'test-admin', token: 'test-token', expiresAt: Date.now() + 60_000,
    })],
  ] : []);
  const writes = [];
  const timers = new Map();
  let now = Date.now();
  let nextTimer = 0;
  let putResponse = async () => ({ ok: true, json: async () => ({}) });
  const document = Object.assign(makeElement(), {
    hidden: false,
    getElementById: id => elements.get(id),
    querySelector: selector => selector === '.modal-mask.show'
      ? [...elements.values()].find(el => el.classList.contains('modal-mask') && el.classList.contains('show')) || null
      : null,
    querySelectorAll: selector => selector === '.modal-mask'
      ? [...elements.values()].filter(el => el.classList.contains('modal-mask'))
      : [],
    createElement: () => makeElement(),
    body: makeElement(),
  });
  const mediaQuery = Object.assign(makeElement(), { matches: reducedMotion });
  const context = vm.createContext({
    document,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    fetch: async (_url, options) => {
      if (options.method === 'PUT') {
        writes.push(JSON.parse(options.body).state);
        return putResponse();
      }
      return { ok: true, json: async () => ({}) };
    },
    location: { hostname: 'localhost' },
    window: Object.assign(makeElement(), {
      innerWidth: 400,
      matchMedia: () => mediaQuery,
    }),
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(element, options = {}) {
        const targets = observers.get(this.callback) || [];
        targets.push({ element, options });
        observers.set(this.callback, targets);
      }
      disconnect() { observers.delete(this.callback); }
    },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    },
    navigator: {},
    console: { log() {}, warn() {}, error() {} },
    confirm: () => true,
    structuredClone,
    setTimeout(callback, delay = 0) {
      const id = ++nextTimer;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout: id => timers.delete(id),
    setInterval: () => 0,
  });
  vm.runInContext(script + `\n;globalThis.bank = {
    get state() { return state; }, onActionClick, render, doChangePoints,
    get pet() { return typeof PetCompanion === 'undefined' ? null : PetCompanion; }
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
    failWrites() { putResponse = async () => { throw new Error('mock network failure'); }; },
    deferWrites() {
      let resolve;
      const response = new Promise(done => { resolve = done; });
      putResponse = () => response;
      return () => resolve({ ok: true, json: async () => ({}) });
    },
    async setHidden(hidden) {
      document.hidden = hidden;
      await document.dispatch('visibilitychange');
    },
    async setReducedMotion(matches) {
      mediaQuery.matches = matches;
      await mediaQuery.dispatch('change', { matches });
    },
    async advance(ms) {
      const end = now + ms;
      let count = 0;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        assert.ok(++count < 1000, 'timer callbacks must not spin indefinitely');
        const [id, timer] = next;
        timers.delete(id);
        now = timer.at;
        await timer.callback();
        await new Promise(setImmediate);
      }
      now = end;
    },
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

function recordMoods(app) {
  const dataset = app.element('petCompanion').dataset;
  let mood = dataset.mood;
  const transitions = [];
  Object.defineProperty(dataset, 'mood', {
    get: () => mood,
    set(value) { if (value !== mood) transitions.push(value); mood = value; },
  });
  return transitions;
}

test('guests can pet the dog without changing points, history, or cloud data', async () => {
  const app = await loadBank(100, { loggedIn: false });
  const before = JSON.stringify(app.bank.state);
  const transitions = recordMoods(app);
  await app.click('mascot');
  assert.ok(['pet', 'wave', 'tilt'].includes(app.element('petCompanion').dataset.mood));
  assert.ok(app.element('petBubble').textContent.length > 0);
  for (let i = 0; i < 8; i++) await app.click('mascot');
  assert.equal(transitions.length, 1, 'rapid clicks must not restart or queue more reactions');
  await app.advance(2400);
  assert.equal(app.element('petCompanion').dataset.mood, 'idle');
  assert.equal(transitions.filter(mood => ['pet', 'wave', 'tilt'].includes(mood)).length, 1);
  assert.equal(JSON.stringify(app.bank.state), before);
  assert.equal(app.writes.length, 0);
  assert.equal(app.element('loginModal').classList.contains('show'), false);
});

test('business feedback interrupts petting and stale interaction timers cannot reset it', async () => {
  const app = await loadBank();
  await app.click('mascot');
  await app.advance(900);
  assert.equal(app.bank.pet.react('celebrate'), true);
  assert.equal(app.bank.pet.pet(), false, 'petting must not interrupt a points celebration');
  await app.advance(700);
  assert.equal(app.element('petCompanion').dataset.mood, 'celebrate');
  await app.advance(2000);
  assert.equal(app.element('petCompanion').dataset.mood, 'idle');
});

test('the pet waits for the point save to succeed and never celebrates a failed save', async () => {
  const app = await loadBank();
  const resolveSave = app.deferWrites();
  const earning = app.bank.doChangePoints(app.bank.state.rules.earn[0]);
  assert.equal(app.element('petCompanion').dataset.mood, 'idle');
  resolveSave();
  await earning;
  assert.equal(app.element('petCompanion').dataset.mood, 'earn');

  const failed = await loadBank();
  failed.failWrites();
  const transitions = recordMoods(failed);
  await failed.bank.doChangePoints(failed.bank.state.rules.earn[0]);
  assert.equal(failed.element('petCompanion').dataset.mood, 'idle');
  assert.equal(transitions.length, 0);
});

test('deductions encourage, clearing resets, and crossing a goal only celebrates', async () => {
  const deduct = await loadBank();
  await confirmRule(deduct, deduct.bank.state.rules.deduct.find(rule => rule.kind === 'deduct'), 90, -10);
  assert.equal(deduct.element('petCompanion').dataset.mood, 'encourage');

  const clear = await loadBank();
  await confirmRule(clear, clear.bank.state.rules.deduct.find(rule => rule.kind === 'zero'), 0, -100);
  assert.equal(clear.element('petCompanion').dataset.mood, 'reset');

  const goal = await loadBank();
  goal.bank.state.goals = [{ id: 'test-goal', name: '阅读奖励', emoji: '📚', points: 110 }];
  const transitions = recordMoods(goal);
  await confirmRule(goal, goal.bank.state.rules.earn[0], 120, 20);
  assert.equal(goal.element('petCompanion').dataset.mood, 'celebrate');
  assert.deepEqual(transitions, ['celebrate'], 'goal crossing must not flash an earn reaction first');
});

test('hidden pages and open modals pause interaction and discard pending reactions', async () => {
  const app = await loadBank();
  await app.click('mascot');
  await app.setHidden(true);
  assert.equal(app.element('petCompanion').dataset.paused, 'true');
  assert.equal(app.bank.pet.pet(), false);
  assert.equal(app.bank.pet.react('earn'), false);
  await app.advance(2500);
  await app.setHidden(false);
  assert.equal(app.element('petCompanion').dataset.mood, 'idle');
  assert.equal(app.element('petCompanion').dataset.paused, 'false');

  app.bank.onActionClick(app.bank.state.rules.earn[0].id);
  await new Promise(setImmediate);
  assert.equal(app.element('petCompanion').dataset.paused, 'true');
  await app.click('mascot');
  assert.equal(app.element('petCompanion').dataset.mood, 'idle');
  await app.click('confirmCancel');
  assert.equal(app.element('petCompanion').dataset.paused, 'false');
  assert.equal(app.bank.pet.pet(), true);
});

test('reduced motion keeps explicit expressions while avoiding idle animation timers', async () => {
  const app = await loadBank(100, { reducedMotion: true });
  const transitions = recordMoods(app);
  await app.advance(30_000);
  assert.equal(app.element('petCompanion').dataset.mood, 'idle');
  assert.equal(transitions.length, 0);
  await app.click('mascot');
  assert.ok(['pet', 'wave', 'tilt'].includes(app.element('petCompanion').dataset.mood));
  await app.advance(2400);
  assert.equal(app.element('petCompanion').dataset.mood, 'idle');
  await app.setReducedMotion(false);
  await app.advance(30_000);
  assert.ok(transitions.some(mood => ['blink', 'curious'].includes(mood)), 'turning motion back on restores occasional idle expressions');
});

test('manual point adjustments and redemption use the matching successful feedback', async () => {
  const app = await loadBank();
  app.element('adjustPointsInput').value = '5';
  await app.click('adjustSaveBtn');
  assert.equal(app.bank.state.points, 105);
  assert.equal(app.element('petCompanion').dataset.mood, 'earn');

  await app.element('adjustType').dispatch('click', {
    target: { closest: () => ({ dataset: { type: 'minus' } }) },
  });
  app.element('adjustPointsInput').value = '5';
  await app.click('adjustSaveBtn');
  assert.equal(app.bank.state.points, 100);
  assert.equal(app.element('petCompanion').dataset.mood, 'encourage');

  app.bank.state.goals = [{ id: 'test-reward', name: '阅读奖励', emoji: '📚', points: 50 }];
  app.bank.render();
  await app.element('goalsList').querySelectorAll('[data-redeem]')[0].dispatch('click');
  assert.equal(app.bank.state.points, 50);
  assert.equal(app.element('petCompanion').dataset.mood, 'redeem');
});

test('scrolling across the pet does not pet it, while a keyboard click still works', async () => {
  const app = await loadBank(100, { loggedIn: false });
  const button = app.element('mascot');
  await button.dispatch('pointerdown', { clientX: 20, clientY: 20 });
  await button.dispatch('pointermove', { clientX: 20, clientY: 60 });
  await button.dispatch('pointerup');
  await button.dispatch('click', { detail: 1 });
  assert.equal(app.element('petCompanion').dataset.mood, 'idle');
  await button.dispatch('click', { detail: 0 });
  assert.ok(['pet', 'wave', 'tilt'].includes(app.element('petCompanion').dataset.mood));
  assert.equal(app.writes.length, 0);
});
