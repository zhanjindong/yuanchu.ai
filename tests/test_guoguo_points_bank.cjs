'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const productPath = join(__dirname, '../product');

function pageScripts(pageHtml) {
  return [...pageHtml.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .map(([, attributes, inline]) => {
      const source = attributes.match(/\bsrc="([^"]+)"/);
      // The UI component is exercised separately; this suite focuses on the
      // actual page controller and shared persistence/navigation behavior.
      if (source?.[1] === 'guoguo-fruit-tree.js') return '';
      return source ? readFileSync(join(productPath, source[1]), 'utf8')
        : inline.replace(/const ADMIN_ACCOUNT = \{[^}]+\};/,
          "const ADMIN_ACCOUNT = { username: 'preview-admin', password: 'local-preview' };");
    });
}

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
      if (selector === '.sync-banner-text') {
        if (!children.has(selector)) children.set(selector, [makeElement()]);
        return children.get(selector);
      }
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
    appendChild() {}, remove() {}, focus() {}, scrollIntoView() {},
  };
  return element;
}

async function loadBank(points = 100, {
  loggedIn = true, reducedMotion = false, serverState = null, deferInitialRead = false,
  initialStorage = [], preserveState = false, putHandler = null, initialTime = Date.now(),
  page = 'bank', search = '', treeHandler = null,
} = {}) {
  const pageName = page === 'tree' ? 'guoguo-fruit-tree.html' : 'guoguo-points-bank.html';
  const pageHtml = readFileSync(join(productPath, pageName), 'utf8');
  const observers = new Map();
  const notifyMutation = element => {
    for (const [callback, targets] of observers) {
      if (targets.some(target => target.element === element || target.options.subtree)) queueMicrotask(callback);
    }
  };
  const elements = new Map([...pageHtml.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)]
    .map(([tag, id]) => {
      const element = makeElement(id, notifyMutation);
      const classes = tag.match(/\bclass="([^"]+)"/);
      if (classes) element.classList.add(...classes[1].split(/\s+/));
      for (const [, name, value] of tag.matchAll(/\b(href|aria-label|type)="([^"]*)"/g)) element.setAttribute(name, value);
      return [id, element];
    }));
  const storage = new Map([...(loggedIn ? [
    ['guoguo_admin_session_v1', JSON.stringify({
      username: 'test-admin', token: 'test-token', expiresAt: initialTime + 60_000,
    })],
  ] : []), ...initialStorage]);
  const writes = [];
  const requests = [];
  const tree = { options: null, viewOptions: {}, updates: [], opens: 0, closes: 0 };
  const timers = new Map();
  let now = initialTime;
  let nextTimer = 0;
  let revision = 0;
  let releaseInitialRead;
  const initialReadReady = deferInitialRead ? new Promise(resolve => { releaseInitialRead = resolve; }) : Promise.resolve();
  const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => structuredClone(body) });
  let getResponse = async () => {
    await initialReadReady;
    return response({ ok: true, state: serverState, revision });
  };
  let putResponse = async body => response(putHandler
    ? await putHandler(body)
    : { ok: true, state: body.state, revision: ++revision });
  let treeResponse = async body => treeHandler
    ? response(await treeHandler(body))
    : response({ error: 'Unexpected tree action in test' }, 400);
  const navigations = [];
  const location = {
    hostname: 'localhost', search, pathname: '/product/' + pageName,
    href: 'http://localhost/product/' + pageName + search,
    assign(url) { navigations.push({ method: 'assign', url }); },
    replace(url) { navigations.push({ method: 'replace', url }); },
  };
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
    fetch: async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : null;
      requests.push({ url, method: options.method || 'GET', body });
      let pending;
      if (options.method === 'PUT') {
        writes.push(body.state);
        pending = putResponse(body);
      } else if (options.method === 'POST' && url.endsWith('/api/fruit-tree')) pending = treeResponse(body);
      else pending = getResponse();
      if (!options.signal) return pending;
      return new Promise((resolve, reject) => {
        const abort = () => reject(new Error('mock request aborted'));
        options.signal.addEventListener('abort', abort, { once: true });
        Promise.resolve(pending).then(resolve, reject)
          .finally(() => options.signal.removeEventListener('abort', abort));
      });
    },
    location,
    URLSearchParams,
    window: Object.assign(makeElement(), {
      innerWidth: 400, location,
      matchMedia: () => mediaQuery,
      GuoguoFruitTree: {
        create(options) {
          tree.options = options;
          return {
            update(snapshot, patch = {}) {
              tree.updates.push([snapshot, patch]);
              Object.assign(tree.viewOptions, patch);
            },
            open() { tree.opens++; },
            close() { tree.closes++; },
          };
        },
      },
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
    AbortController,
    setTimeout(callback, delay = 0) {
      const id = ++nextTimer;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout: id => timers.delete(id),
    setInterval(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { at: now + delay, callback, repeat: delay });
      return id;
    },
    clearInterval: id => timers.delete(id),
  });
  for (const source of pageScripts(pageHtml)) vm.runInContext(source, context, { filename: pageName });
  vm.runInContext(`globalThis.bank = {
    get state() { return state; }, render,
    onActionClick: typeof onActionClick === 'undefined' ? null : onActionClick,
    doChangePoints: typeof doChangePoints === 'undefined' ? null : doChangePoints,
    retry: retryApiLoad, commit: withCommit,
    get pet() { return typeof PetCompanion === 'undefined' ? null : PetCompanion; }
  };`, context);
  await new Promise(setImmediate);
  const bank = context.bank;
  if (!preserveState) {
    bank.state.points = points;
    bank.state.goals = [];
    bank.state.history = [];
  }
  return {
    bank, writes, requests, tree, navigations, location,
    pageHtml,
    dispatchWindow: (type, event) => context.window.dispatch(type, event),
    element: id => elements.get(id),
    click: id => elements.get(id).dispatch('click'),
    storedState: () => JSON.parse(storage.get('guoguo_points_bank_v1')),
    storedPending: () => JSON.parse(storage.get('guoguo_points_bank_v1_pending') || 'null'),
    exportStorage: () => [...storage],
    failWrites() { putResponse = async () => { throw new Error('mock network failure'); }; },
    respondToWrites(handler) { putResponse = async body => response(await handler(body)); },
    respondToTree(handler) { treeResponse = async body => response(await handler(body)); },
    respondToReads(body) { getResponse = async () => response(body); },
    rejectWrites(body, status = 409) { putResponse = async () => response(body, status); },
    async finishInitialRead() {
      releaseInitialRead?.();
      await new Promise(setImmediate);
    },
    deferWrites() {
      let resolve;
      let submitted;
      const pending = new Promise(done => { resolve = done; });
      putResponse = body => { submitted = body; return pending; };
      return () => resolve(response({ ok: true, state: submitted.state, revision: ++revision }));
    },
    deferTree() {
      let resolve;
      const pending = new Promise(done => { resolve = done; });
      treeResponse = () => pending;
      return state => resolve(response({ ok: true, state, revision: ++revision }));
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
        if (timer.repeat) timers.set(id, { ...timer, at: now + timer.repeat });
        await timer.callback();
        await new Promise(setImmediate);
      }
      now = end;
    },
  };
}

async function loadTreePage(points = 100, options = {}) {
  const serverState = { points, history: [], goals: [], fruitTree: { status: 'ready', earned: points, boost: 0, growth: points } };
  return loadBank(points, { serverState, ...options, page: 'tree' });
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

test('a failed reward restores the original balance, history, and accumulated growth', async () => {
  const app = await loadBank();
  app.bank.state.fruitTree = { earned: 100, boost: 0, growth: 100 };
  const before = JSON.stringify(app.bank.state);
  app.failWrites();
  await app.bank.doChangePoints(app.bank.state.rules.earn[0]);
  assert.equal(JSON.stringify(app.bank.state), before);
  assert.equal(JSON.stringify(app.storedState()), before, 'the local backup must also roll back');
  assert.equal(app.element('pointsDisplay').textContent, 100);
  assert.equal(app.element('petCompanion').dataset.mood, 'idle');
});

test('a pending reward blocks a repeated action until its cloud save finishes', async () => {
  const app = await loadBank();
  const release = app.deferWrites();
  const first = app.bank.doChangePoints(app.bank.state.rules.earn[0]);
  const repeated = app.bank.doChangePoints(app.bank.state.rules.earn[0]);
  assert.equal(app.writes.length, 1, 'a rapid repeat must not submit a second mutation');
  release();
  await Promise.all([first, repeated]);
  assert.equal(app.bank.state.points, 120);
  assert.equal(app.bank.state.history.length, 1);
});

test('point changes wait until the initial cloud revision is available', async () => {
  const app = await loadBank(100, { deferInitialRead: true });
  await app.bank.doChangePoints(app.bank.state.rules.earn[0]);
  assert.equal(app.writes.length, 0);
  assert.equal(app.requests.filter(request => request.method === 'POST').length, 0);
  assert.equal(app.bank.state.points, 100);
  await app.finishInitialRead();
  await app.bank.doChangePoints(app.bank.state.rules.earn[0]);
  assert.equal(app.writes.length, 1);
  assert.equal(app.bank.state.points, 120);
});

test('successful mutations adopt the complete server state, including fruit-tree growth', async () => {
  const app = await loadBank();
  app.respondToWrites(body => ({
    ok: true, revision: 4,
    state: { ...body.state, points: 112, fruitTree: { earned: 130, boost: 0, growth: 130 } },
  }));
  await app.bank.doChangePoints(app.bank.state.rules.earn[0]);
  assert.equal(app.bank.state.points, 112);
  assert.equal(app.bank.state.fruitTree.growth, 130);
  assert.equal(app.storedState().fruitTree.earned, 130);
  assert.equal(app.element('pointsDisplay').textContent, 112);
  assert.equal(app.requests.find(request => request.method === 'PUT').body.revision, 0);
});

test('a revision conflict adopts current cloud data and uses its revision for the next mutation', async () => {
  const app = await loadBank();
  const cloud = structuredClone(app.bank.state);
  cloud.points = 40;
  cloud.fruitTree = { earned: 170, boost: 0, growth: 170 };
  app.rejectWrites({ ok: false, state: cloud, revision: 7, error: 'revision_conflict' });
  await app.bank.doChangePoints(app.bank.state.rules.earn[0]);
  assert.equal(app.bank.state.points, 40);
  assert.equal(app.bank.state.fruitTree.growth, 170);
  assert.equal(app.bank.state.history.length, 0, 'the rejected local reward must not persist');
  assert.equal(app.element('petCompanion').dataset.mood, 'idle');
  app.respondToWrites(body => ({ ok: true, state: body.state, revision: 8 }));
  await app.bank.doChangePoints(app.bank.state.rules.earn[0]);
  assert.equal(app.bank.state.points, 60);
  assert.equal(app.requests.filter(request => request.method === 'PUT').at(-1).body.revision, 7);
});

test('an uncertain save retries the same operation and cannot award points twice', async () => {
  const app = await loadBank();
  app.bank.state.fruitTree = { earned: 100, boost: 0, growth: 100 };
  const accepted = new Map();
  let applied = 0;
  let disconnect = true;
  app.respondToWrites(body => {
    if (!accepted.has(body.operationId)) {
      applied++;
      accepted.set(body.operationId, {
        ok: true, revision: 1,
        state: { ...body.state, fruitTree: { earned: 120, boost: 0, growth: 120 } },
      });
    }
    if (disconnect) {
      disconnect = false;
      throw new Error('response lost after server committed');
    }
    return accepted.get(body.operationId);
  });
  await app.bank.doChangePoints(app.bank.state.rules.earn[0]);
  assert.equal(app.bank.state.points, 100, 'an uncertain result restores the displayed snapshot');
  assert.equal(app.bank.state.fruitTree.growth, 100);
  await app.bank.doChangePoints(app.bank.state.rules.earn[0]);
  assert.equal(app.writes.length, 1, 'new mutations must wait for the uncertain one to resolve');
  await app.click('syncBadge');
  const puts = app.requests.filter(request => request.method === 'PUT');
  assert.equal(puts.length, 2);
  assert.ok(puts[0].body.operationId);
  assert.deepEqual(puts[1].body, puts[0].body, 'the retry reuses the exact original operation');
  assert.equal(applied, 1);
  assert.equal(app.bank.state.points, 120);
  assert.equal(app.bank.state.fruitTree.growth, 120);
  assert.equal(app.bank.state.history.length, 1);
  assert.equal(app.storedState().points, 120);
});

test('reloading after an uncertain save restores and resolves the original pending operation', async () => {
  const original = await loadBank();
  let committed;
  original.respondToWrites(body => {
    committed = { ok: true, revision: 1, state: structuredClone(body.state) };
    throw new Error('response lost after server committed');
  });
  await original.bank.doChangePoints(original.bank.state.rules.earn[0]);
  assert.equal(original.bank.state.points, 100);
  const pending = original.storedPending();
  assert.equal(pending.endpoint, 'points');
  assert.equal(pending.body.state.points, 120);

  const reloaded = await loadBank(0, {
    initialStorage: original.exportStorage(), preserveState: true,
    putHandler(body) {
      assert.deepEqual(body, pending.body, 'reload must not invent another operation identifier');
      return committed;
    },
  });
  assert.equal(reloaded.writes.length, 1);
  assert.equal(reloaded.bank.state.points, 120);
  assert.equal(reloaded.bank.state.history.length, 1);
  assert.equal(reloaded.storedPending(), null);
  assert.equal(reloaded.storedState().points, 120);
});

test('deductions and redemption keep the badge based on accumulated tree growth', async () => {
  const app = await loadBank(160);
  app.bank.state.fruitTree = { earned: 170, boost: 0, growth: 170 };
  app.bank.render();
  const badge = app.element('levelPill').textContent;
  assert.match(badge, /红苹果/);
  await app.bank.doChangePoints(app.bank.state.rules.deduct.find(rule => rule.points === -10));
  assert.equal(app.bank.state.points, 150);
  assert.equal(app.element('levelPill').textContent, badge);
  app.bank.state.goals = [{ id: 'tree-preserving-reward', name: '小奖励', emoji: '📚', points: 150 }];
  app.bank.render();
  await app.element('goalsList').querySelectorAll('[data-redeem]')[0].dispatch('click');
  assert.equal(app.bank.state.points, 0);
  assert.equal(app.bank.state.fruitTree.growth, 170);
  assert.equal(app.element('levelPill').textContent, badge);
});

test('guests may read the tree subpage and care sends them to the bank login without writing data', async () => {
  const app = await loadTreePage(100, { loggedIn: false });
  const before = JSON.stringify(app.bank.state);
  assert.equal(app.tree.opens, 1);
  assert.equal(app.tree.viewOptions.readOnly, true);
  assert.equal(typeof app.tree.options?.onAction, 'function');
  await assert.rejects(app.tree.options.onAction({ action: 'care', kind: 'water' }), /登录/);
  assert.equal(JSON.stringify(app.bank.state), before);
  assert.equal(app.requests.filter(request => request.method !== 'GET').length, 0);
  assert.deepEqual(app.navigations, [{ method: 'assign', url: 'guoguo-points-bank.html?from=fruit-tree&login=1' }]);
});

test('tree care uses the revisioned API and refreshes both the balance and tree snapshot', async () => {
  const app = await loadTreePage();
  app.bank.state.fruitTree = { earned: 100, boost: 0, growth: 100 };
  const refreshed = structuredClone(app.bank.state);
  refreshed.points = 99;
  refreshed.fruitTree = { earned: 100, boost: 1, growth: 101 };
  app.respondToTree(body => {
    assert.equal(body.action, 'care');
    assert.equal(body.item, 'water');
    assert.equal(body.revision, 0);
    assert.ok(body.operationId);
    return { ok: true, revision: 1, state: refreshed };
  });
  await app.tree.options.onAction({ action: 'care', kind: 'water' });
  assert.equal(app.bank.state.points, 99);
  assert.equal(app.bank.state.fruitTree.earned, 100, 'spending on care is not newly earned points');
  assert.equal(app.bank.state.fruitTree.growth, 101);
  assert.equal(app.tree.updates.at(-1)[0].balance, 99);
  assert.equal(app.storedState().fruitTree.boost, 1);
  assert.equal(app.writes.length, 0, 'care must not bypass the dedicated server action via a state PUT');
});

test('an uncertain care action restores the snapshot and retries without spending twice', async () => {
  const app = await loadTreePage();
  app.bank.state.fruitTree = { earned: 100, boost: 0, growth: 100 };
  const before = JSON.stringify(app.bank.state);
  const refreshed = structuredClone(app.bank.state);
  refreshed.points = 99;
  refreshed.fruitTree = { earned: 100, boost: 1, growth: 101 };
  let operationId;
  let attempts = 0;
  app.respondToTree(body => {
    attempts++;
    if (attempts === 1) {
      operationId = body.operationId;
      throw new Error('response lost after care committed');
    }
    assert.equal(body.operationId, operationId);
    return { ok: true, revision: 1, state: refreshed };
  });
  await assert.rejects(app.tree.options.onAction({ action: 'care', kind: 'water' }));
  assert.equal(JSON.stringify(app.bank.state), before);
  assert.equal(JSON.stringify(app.storedState()), before);
  assert.equal(app.storedPending().endpoint, 'tree');
  await app.bank.retry();
  assert.equal(attempts, 2);
  assert.equal(app.bank.state.points, 99);
  assert.equal(app.bank.state.fruitTree.growth, 101);
  assert.equal(app.storedPending(), null);
  assert.equal(app.writes.length, 0);
});

test('pending tree care blocks both repeated care and point writes', async () => {
  const app = await loadTreePage();
  app.bank.state.fruitTree = { earned: 100, boost: 0, growth: 100 };
  const refreshed = structuredClone(app.bank.state);
  refreshed.points = 99;
  refreshed.fruitTree = { earned: 100, boost: 1, growth: 101 };
  const release = app.deferTree();
  const first = app.tree.options.onAction({ action: 'care', kind: 'water' });
  await assert.rejects(app.tree.options.onAction({ action: 'care', kind: 'water' }), /正在保存/);
  let ranSecondMutation = false;
  const reward = app.bank.commit(() => { ranSecondMutation = true; });
  assert.equal(ranSecondMutation, false, 'shared persistence must also block a point write');
  assert.equal(app.requests.filter(request => request.method === 'POST').length, 1);
  assert.equal(app.writes.length, 0);
  release(refreshed);
  await Promise.all([first, reward]);
  assert.equal(app.bank.state.points, 99);
  assert.equal(app.bank.state.fruitTree.growth, 101);
  assert.equal(app.bank.state.history.length, 0);
});

test('restoring the tree subpage refreshes another device’s changes and clears a stale action error', async () => {
  const app = await loadTreePage();
  app.tree.viewOptions.error = '上次照料未完成';
  const refreshed = structuredClone(app.bank.state);
  refreshed.points = 145;
  refreshed.fruitTree = { status: 'ready', earned: 150, boost: 0, growth: 150 };
  app.respondToReads({ ok: true, state: refreshed, revision: 7 });

  await app.dispatchWindow('pageshow', { persisted: true });
  assert.equal(app.tree.opens, 1);
  assert.equal(app.requests.filter(request => request.method === 'GET').length, 2);
  assert.equal(app.bank.state.points, 145);
  assert.equal(app.bank.state.fruitTree.growth, 150);
  assert.equal(app.tree.updates.at(-1)[0].growth, 150);
  assert.equal(app.tree.updates.at(-1)[0].revision, 7);
  assert.equal(app.tree.viewOptions.error, '');
  assert.equal(app.tree.viewOptions.offline, false);
  assert.equal(app.writes.length, 0, 'returning to an existing tree only reads cloud data');
});

test('care allowances refresh after Beijing midnight without resetting growth or repeatedly fetching', async () => {
  const app = await loadTreePage(100, { initialTime: Date.parse('2026-10-10T15:59:20Z') });
  app.bank.state.fruitTree = {
    status: 'ready', earned: 100, boost: 6, growth: 106,
    care: { date: '2026-10-10', used: ['water', 'sun', 'food'], remainingBonus: 4 },
  };
  const refreshed = structuredClone(app.bank.state);
  refreshed.fruitTree.care = { date: '2026-10-11', used: [], remainingBonus: 4 };
  app.respondToReads({ ok: true, state: refreshed, revision: 1 });

  await app.advance(30_000);
  assert.equal(app.requests.filter(request => request.method === 'GET').length, 1,
    'the UTC date has not changed, and Beijing is still before midnight');
  await app.advance(30_000);
  assert.equal(app.requests.filter(request => request.method === 'GET').length, 2,
    'the next check after Beijing midnight refreshes the daily allowance');
  assert.deepEqual([...app.bank.state.fruitTree.care.used], []);
  assert.equal(app.bank.state.fruitTree.growth, 106);
  assert.deepEqual([...app.tree.updates.at(-1)[0].care.usedKinds], []);
  await app.advance(30_000);
  assert.equal(app.requests.filter(request => request.method === 'GET').length, 2,
    'the refreshed care date stops redundant requests');
  assert.equal(app.writes.length, 0, 'a new day must not create a point transaction');
});

test('a stalled tree-page read times out, keeps actions disabled, and can be retried', async () => {
  const app = await loadTreePage(100, { deferInitialRead: true });
  assert.equal(app.tree.viewOptions.loading, true);
  await assert.rejects(app.tree.options.onAction({ action: 'care', kind: 'water' }), /云端/);
  await app.advance(15_000);
  assert.equal(app.tree.viewOptions.loading, false);
  assert.equal(app.tree.viewOptions.offline, true);
  await assert.rejects(app.tree.options.onAction({ action: 'care', kind: 'water' }), /云端/);
  assert.equal(app.requests.filter(request => request.method !== 'GET').length, 0);
  await app.finishInitialRead();
  assert.equal(app.tree.viewOptions.offline, true,
    'a response arriving after an aborted read must not unlock writes');
  await app.tree.options.onRetry();
  assert.equal(app.tree.viewOptions.offline, false);
  assert.equal(app.tree.viewOptions.error, '');
  const refreshed = structuredClone(app.bank.state);
  refreshed.points = 99;
  refreshed.fruitTree.boost = 1;
  refreshed.fruitTree.growth = 101;
  app.respondToTree(() => ({ ok: true, state: refreshed, revision: 1 }));
  await app.tree.options.onAction({ action: 'care', kind: 'water' });
  assert.equal(app.bank.state.points, 99);
});

test('an expired token on the tree subpage requires login before any mutation', async () => {
  const app = await loadTreePage();
  await app.advance(60_001);
  const before = JSON.stringify(app.bank.state);
  await assert.rejects(app.tree.options.onAction({ action: 'care', kind: 'water' }), /登录/);
  assert.equal(JSON.stringify(app.bank.state), before);
  assert.equal(app.requests.filter(request => request.method !== 'GET').length, 0);
  assert.deepEqual(app.navigations, [{ method: 'assign', url: 'guoguo-points-bank.html?from=fruit-tree&login=1' }]);
});

test('the bank links to a standalone fruit-tree page without creating an overlay', async () => {
  const app = await loadBank();
  assert.equal(app.element('levelPill').getAttribute('href'), 'guoguo-fruit-tree.html');
  assert.match(app.pageHtml, /<a\b[^>]*id="levelPill"/);
  assert.doesNotMatch(app.pageHtml, /src="guoguo-fruit-tree\.js"/);
  assert.equal(app.tree.options, null, 'the bank must not mount the fruit-tree component');
});

test('returning to the bank through browser history refreshes the tree balance and harvest', async () => {
  const app = await loadBank();
  const updated = structuredClone(app.bank.state);
  updated.points = 97;
  updated.fruitTree = { status: 'ready', earned: 170, boost: 3, growth: 173, harvested: 2 };
  app.respondToReads({ ok: true, state: updated, revision: 3 });
  await app.dispatchWindow('pageshow', { persisted: false });
  assert.equal(app.requests.filter(request => request.method === 'GET').length, 1);
  await app.dispatchWindow('pageshow', { persisted: true });
  assert.equal(app.requests.filter(request => request.method === 'GET').length, 2);
  assert.equal(app.bank.state.points, 97);
  assert.equal(app.element('pointsDisplay').textContent, 97);
  assert.equal(app.bank.state.fruitTree.harvested, 2);
  assert.match(app.element('levelPill').textContent, /红苹果/);
  assert.equal(app.writes.length, 0, 'returning home is a read-only refresh');
});

test('a tree login request opens the bank login and returns to the tree only after successful login', async () => {
  const app = await loadBank(100, { loggedIn: false, search: '?from=fruit-tree&login=1' });
  assert.equal(app.element('loginModal').classList.contains('show'), true);
  assert.equal(app.navigations.length, 0);
  app.element('loginUsername').value = 'preview-admin';
  app.element('loginPassword').value = 'wrong';
  await app.click('loginSubmit');
  await app.advance(600);
  assert.equal(app.navigations.length, 0, 'invalid credentials must not return to the tree');
  app.element('loginPassword').value = 'local-preview';
  await app.click('loginSubmit');
  await app.advance(600);
  assert.deepEqual(app.navigations, [{ method: 'replace', url: 'guoguo-fruit-tree.html' }]);
  assert.equal(app.writes.length, 0, 'login must not change points or tree data');
});

test('an already authenticated tree login request returns directly without another dialog', async () => {
  const app = await loadBank(100, { search: '?from=fruit-tree&login=1' });
  assert.deepEqual(app.navigations, [{ method: 'replace', url: 'guoguo-fruit-tree.html' }]);
  assert.equal(app.element('loginModal').classList.contains('show'), false);
});

test('the tree has a real return-home link that also works when opened directly', async () => {
  const app = await loadTreePage();
  const component = readFileSync(join(productPath, 'guoguo-fruit-tree.js'), 'utf8');
  assert.match(component, /<a\b[^>]*id="gt-home"[^>]*href="guoguo-points-bank\.html"/);
  assert.match(app.pageHtml, /<a href="guoguo-points-bank\.html">← 返回首页<\/a>/,
    'the loading state must also offer a working home link');
  assert.equal(app.tree.opens, 1, 'direct loading mounts one tree page');
  assert.equal(app.tree.options.onClose, undefined, 'the page should not navigate via an overlay close callback');
});

test('reloading the tree subpage retains completed care, harvests, and per-fruit maturity', async () => {
  const app = await loadTreePage(300);
  const updated = structuredClone(app.bank.state);
  updated.points = 299;
  updated.fruitTree = {
    status: 'ready', earned: 300, boost: 1, growth: 301,
    harvested: 3, bestLevel: 2, available: 2, bugFruitId: 8,
    care: { date: '2026-10-10', used: ['water'], remainingBonus: 29 },
    fruits: [
      { id: 4, level: 1, name: '红苹果', locked: false },
      { id: 8, level: 2, name: '蜜桃', locked: true },
    ],
  };
  app.respondToTree(() => ({ ok: true, state: updated, revision: 4 }));
  await app.tree.options.onAction({ action: 'care', kind: 'water' });

  const reloaded = await loadTreePage(0, {
    serverState: updated, preserveState: true, initialStorage: app.exportStorage(),
  });
  const snapshot = reloaded.tree.updates.at(-1)[0];
  assert.equal(snapshot.balance, 299);
  assert.equal(snapshot.growth, 301);
  assert.equal(snapshot.harvestedCount, 3);
  assert.equal(snapshot.bestHarvestLevel, 2);
  assert.equal(snapshot.availableCount, 2);
  assert.equal(snapshot.readyCount, 1, 'a bugged fruit remains visible but is not harvestable');
  assert.equal(JSON.stringify(snapshot.fruits), JSON.stringify(updated.fruitTree.fruits));
  assert.deepEqual([...snapshot.care.usedKinds], ['water']);
  assert.equal(reloaded.requests.filter(request => request.method !== 'GET').length, 0,
    'reloading must never repeat a successful care operation');
});

test('returning home with uncertain care resolves its original operation before new point changes', async () => {
  const original = await loadTreePage();
  const updated = structuredClone(original.bank.state);
  updated.points = 99;
  updated.fruitTree.boost = 1;
  updated.fruitTree.growth = 101;
  original.respondToTree(() => { throw new Error('care committed but the connection closed'); });
  await assert.rejects(original.tree.options.onAction({ action: 'care', kind: 'water' }));
  const pending = original.storedPending();
  assert.equal(pending.endpoint, 'tree');

  const bank = await loadBank(0, {
    initialStorage: original.exportStorage(), preserveState: true,
    treeHandler(body) {
      assert.deepEqual(body, pending.body, 'navigation must reuse the original care operation ID');
      return { ok: true, state: updated, revision: 2 };
    },
  });
  assert.equal(bank.storedPending(), null);
  assert.equal(bank.bank.state.points, 99);
  assert.equal(bank.bank.state.fruitTree.growth, 101);
  assert.equal(bank.element('pointsDisplay').textContent, 99);
  assert.equal(bank.requests.filter(request => request.method === 'POST').length, 1);
  assert.equal(bank.writes.length, 0);
  await bank.bank.doChangePoints(bank.bank.state.rules.earn[0]);
  assert.equal(bank.bank.state.points, 119);
  assert.equal(bank.requests.find(request => request.method === 'PUT').body.revision, 2);
});

test('directly opening a new tree initializes the shared state exactly once', async () => {
  const app = await loadTreePage(0, {
    serverState: null, preserveState: true,
    putHandler(body) {
      return { ok: true, revision: 1, state: {
        ...body.state, fruitTree: { status: 'ready', earned: 0, boost: 0, growth: 0 },
      } };
    },
  });
  assert.equal(app.writes.length, 1);
  assert.equal(app.requests.find(request => request.method === 'PUT').body.revision, 0);
  assert.equal(app.tree.updates.at(-1)[0].initialized, true);
  assert.equal(app.tree.updates.at(-1)[0].growth, 0);
  app.respondToReads({ ok: true, state: app.bank.state, revision: 1 });
  await app.dispatchWindow('pageshow', { persisted: true });
  assert.equal(app.writes.length, 1, 'revisiting an initialized tree must not initialize it again');
});
