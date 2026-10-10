'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

// Run the real presentation component. Only DOM plumbing and canvas painting
// are mocked; stage selection, progress, labels, and disabled states run as shipped.
function loadTree({ draw = false } = {}) {
  const frames = new Map();
  let nextFrame = 0;
  const canvasContext = Object.fromEntries([
    'arc', 'beginPath', 'bezierCurveTo', 'clearRect', 'closePath', 'ellipse',
    'fill', 'fillRect', 'lineTo', 'moveTo', 'quadraticCurveTo', 'restore',
    'rotate', 'save', 'scale', 'setTransform', 'stroke', 'translate',
  ].map(name => [name, () => {}]));
  canvasContext.createLinearGradient = canvasContext.createRadialGradient = () => ({ addColorStop() {} });
  function node() {
    const selectors = new Map();
    const attributes = new Map();
    const classes = new Set();
    const listeners = new Map();
    return {
      dataset: {}, style: {}, hidden: false, disabled: false, value: '', textContent: '',
      children: [], parentNode: null, clientWidth: 390, clientHeight: 740, scrollTop: 0,
      get isConnected() { return !!this.parentNode; },
      classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name),
        toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
      },
      querySelector(selector) {
        if (selector === 'button:not(:disabled)') return this.children.find(child => child.tagName === 'BUTTON' && !child.disabled) || null;
        if (!selectors.has(selector)) selectors.set(selector, Object.assign(node(), { parentNode: this }));
        return selectors.get(selector);
      },
      querySelectorAll(selector) { return selector === 'button' ? this.children.filter(child => child.tagName === 'BUTTON') : []; },
      setAttribute: (name, value) => attributes.set(name, String(value)),
      getAttribute: name => attributes.get(name) ?? null,
      addEventListener: (type, listener) => listeners.set(type, listener),
      removeEventListener: type => listeners.delete(type),
      async click() {
        if (!this.disabled) await listeners.get('click')?.({ target: this });
        await new Promise(setImmediate);
      },
      getContext: () => draw ? canvasContext : null,
      contains(candidate) { return !!candidate && (candidate === this || this.children.some(child => child.contains(candidate))); },
      append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; },
      replaceChildren(...children) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...children); },
      focus() {},
    };
  }

  const root = node();
  const supplies = ['water', 'sun', 'food'].map(kind => Object.assign(node(), { dataset: { supply: kind } }));
  const panels = ['growth', 'harvest', 'shop', 'rules'].map(kind => Object.assign(node(), { dataset: { openPanel: kind } }));
  const contents = ['growth', 'harvest', 'shop', 'rules'].map(kind => Object.assign(node(), { dataset: { panelContent: kind } }));
  root.querySelectorAll = selector => ({
    '[data-supply]': supplies, '[data-open-panel]': panels, '[data-panel-content]': contents,
  })[selector] || [];
  const window = Object.assign(node(), {
    requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); }, setTimeout: () => 1, clearTimeout() {},
  });
  let createdRoot = false;
  const context = vm.createContext({ window, document: {
    createElement(tag) {
      if (!createdRoot) { createdRoot = true; return root; }
      return Object.assign(node(), { tagName: tag.toUpperCase() });
    }, body: node(), activeElement: null,
  } });
  vm.runInContext(readFileSync(join(__dirname, '../product/guoguo-fruit-tree.js'), 'utf8'), context);
  const actions = [];
  let respondToAction = () => undefined;
  const tree = window.GuoguoFruitTree.create({ onAction: payload => {
    actions.push(payload);
    return respondToAction(payload);
  } });
  return {
    actions, supplies, panels, contents,
    draw() { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); },
    respondToAction(handler) { respondToAction = handler; },
    element: id => root.querySelector('#gt-' + id),
    show(growth, patch = {}, options = {}) {
      tree.open({
        initialized: true, growth, earned: growth, boost: 0, balance: 100,
        harvestedCount: 0, bestHarvestLevel: 0, fruits: [], readyCount: 0,
        care: { usedKinds: [], remainingBoost: 10 }, ...patch,
      }, options);
    },
  };
}

test('actual tree progress and both harvest areas use the new 50-point early stages', () => {
  const app = loadTree();
  for (const [start, nextStep] of [
    [0, '长出新芽'], [50, '成长为小苗'], [100, '成长为小树'],
    [150, '成长为大树'], [200, '果树就开花'], [250, '结出第一颗果实'],
  ]) {
    for (const offset of [0, 25, 49]) {
      app.show(start + offset);
      const expected = `再赚 ${50 - offset} 分，${nextStep}`;
      assert.equal(app.element('next').textContent, expected, `${start + offset} growth`);
      assert.equal(app.element('harvest-label').textContent, expected);
      assert.equal(app.element('fill').style.width, `${offset * 2}%`);
      assert.equal(app.element('harvest-progress').hidden, true);
      assert.equal(app.element('harvest-panel').textContent, '第一颗果实，在 300 分等你');
      assert.equal(app.element('harvest').disabled, true);
      assert.equal(app.element('harvest-panel').disabled, true);
    }
  }
});

test('care works at every stage including seeds and sprouts while daily limits still apply', async () => {
  const app = loadTree();
  const stages = [0, 15, 49, 50, 99, 100, 150, 200, 250, 300];
  for (const growth of stages) {
    app.show(growth, { earned: 100, adjustment: growth - 100 });
    for (const [index, button] of app.supplies.entries()) {
      assert.equal(button.disabled, false, `${growth}: care has no growth-stage requirement`);
      assert.equal(button.querySelector('b').textContent, `${index + 1} 积分`);
      await button.click();
    }
    assert.doesNotMatch(app.element('shop-note').textContent, /小苗|解锁/);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(app.actions)), stages.flatMap(() =>
    ['water', 'sun', 'food'].map(kind => ({ action: 'care', kind }))));
  app.show(41, { care: { usedKinds: ['water'], remainingBoost: 3 } });
  assert.equal(app.supplies[0].disabled, true);
  assert.equal(app.supplies[0].querySelector('b').textContent, '今日已用');
  assert.equal(app.supplies[1].disabled, false);
});

test('early-stage care still requires enough balance and bonus allowance', async () => {
  const app = loadTree();
  app.show(0, { balance: 100, care: { usedKinds: [], remainingBoost: 0 } });
  for (const button of app.supplies) {
    assert.equal(button.disabled, true);
    assert.equal(button.querySelector('b').textContent, '额度不足');
    await button.click();
  }
  app.show(40, { balance: 0, care: { usedKinds: [], remainingBoost: 4 } });
  for (const button of app.supplies) {
    assert.equal(button.disabled, true);
    assert.equal(button.querySelector('b').textContent, '积分不足');
    await button.click();
  }
  assert.equal(app.actions.length, 0);
});

test('guest game controls remain available while historical initialization stays protected', async () => {
  const app = loadTree();
  app.show(320, {
    fruits: [{ id: 1, level: 1 }, { id: 2, level: 1, locked: true }],
    readyCount: 1, pest: { fruitId: 2 },
  }, { readOnly: false, canInitialize: false });
  assert.equal(app.element('login').hidden, true);
  assert.equal(app.element('status').hidden, true);
  assert.equal(app.element('initialize').hidden, true);
  assert.equal(app.element('harvest').disabled, false);
  assert.equal(app.element('harvest-panel').disabled, false);
  assert.equal(app.element('spray').disabled, false);
  for (const button of app.supplies) assert.equal(button.disabled, true);
  await app.element('spray').click();
  app.show(320, {
    fruits: [{ id: 1, level: 1 }, { id: 2, level: 1 }],
    readyCount: 2, pest: { count: 0, fruitIds: [], fruitId: null },
  }, { readOnly: false, canInitialize: false });
  for (const button of app.supplies) assert.equal(button.disabled, false);
  await app.supplies[0].click();
  await app.element('harvest-panel').click();
  assert.deepEqual(JSON.parse(JSON.stringify(app.actions)), [
    { action: 'spray' }, { action: 'care', kind: 'water' }, { action: 'harvest' },
  ]);

  app.show(0, {
    initialized: false, initialization: { suggestedEarned: 500, historyIncomplete: true },
  }, { readOnly: false, canInitialize: false });
  assert.equal(app.element('initialize').hidden, false);
  assert.equal(app.element('initial-earned').disabled, true);
  assert.equal(app.element('initialize-confirm').disabled, true);
  await app.element('initialize-confirm').click();
  assert.equal(app.actions.length, 3, 'public game permission must not permit historical reward initialization');
  app.show(0, {
    initialized: false, initialization: { suggestedEarned: 500, historyIncomplete: true },
  }, { readOnly: false, canInitialize: true });
  assert.equal(app.element('initial-earned').disabled, false);
  assert.equal(app.element('initialize-confirm').disabled, false);
  await app.element('initialize-confirm').click();
  assert.deepEqual(JSON.parse(JSON.stringify(app.actions.at(-1))), { action: 'initialize', earned: 500 });
});

test('pests can be removed at every growth stage and prevent all care until cleared', async () => {
  const app = loadTree();
  for (const growth of [0, 49, 50, 99, 100, 150, 200, 250, 300]) {
    app.show(growth, { pest: { count: 3, fruitIds: [], fruitId: null } }, { readOnly: false });
    assert.equal(app.element('care').hidden, false, `${growth}: pests are visible without fruit`);
    assert.match(app.element('pest-title').textContent, /3\s*条/);
    assert.match(app.element('shop-short').textContent, /3\s*条/);
    assert.equal(app.element('spray').disabled, false, `${growth}: spray is available before the seedling stage`);
    for (const button of app.supplies) {
      assert.equal(button.disabled, true, `${growth}: pests block ${button.dataset.supply}`);
      assert.equal(button.querySelector('b').textContent, '先除小虫');
      await button.click();
    }
    if (growth < 300) {
      assert.equal(app.element('harvest-label').textContent, app.element('next').textContent,
        'an early tree without any fruit must keep its normal growth progress');
      assert.doesNotMatch(app.element('harvest-label').textContent, /采摘/);
    }
    assert.equal(app.element('harvest').disabled, true);
  }
  assert.equal(app.actions.length, 0, 'disabled care must never send an action');
  app.show(0, { balance: 1, pest: { count: 3, fruitIds: [] } });
  assert.equal(app.element('spray').disabled, true, 'spray still requires two available points');
});

test('unlocked fruit can still be harvested when multiple pests block other fruit and care', async () => {
  const app = loadTree();
  app.show(380, {
    fruits: [{ id: 1, level: 1, locked: true }, { id: 2, level: 1, locked: true }, { id: 3, level: 1 }],
    readyCount: 3, availableCount: 5, pest: { count: 2, fruitIds: [1, 2], fruitId: 1 },
  });
  assert.match(app.element('pest-title').textContent, /2\s*条/);
  assert.equal(app.element('harvest-label').textContent, '一键采摘 · 3 颗');
  assert.equal(app.element('harvest-panel').disabled, false);
  for (const button of app.supplies) assert.equal(button.disabled, true);
  await app.element('harvest-panel').click();
  assert.deepEqual(JSON.parse(JSON.stringify(app.actions)), [{ action: 'harvest' }]);
});

test('spraying removes one pest at a time, keeping care blocked and the panel open until the last pest', async () => {
  const app = loadTree();
  let count = 3;
  const state = () => ({
    initialized: true, growth: 100, earned: 100, boost: 0, balance: 100 - (3 - count) * 2,
    harvestedCount: 0, bestHarvestLevel: 0, fruits: [], readyCount: 0,
    pest: { count, fruitIds: [], fruitId: null }, care: { usedKinds: [], remainingBoost: 10 },
  });
  app.show(100, state(), { readOnly: false });
  app.respondToAction(payload => {
    assert.equal(payload.action, 'spray');
    count--;
    return { snapshot: state() };
  });
  await app.panels.find(button => button.dataset.openPanel === 'shop').click();
  for (const remaining of [2, 1]) {
    await app.element('spray').click();
    assert.match(app.element('pest-title').textContent, new RegExp(`${remaining}\\s*条`));
    assert.match(app.element('message').textContent, new RegExp(`${remaining}\\s*条`));
    assert.equal(app.element('panel-layer').hidden, false);
    for (const button of app.supplies) assert.equal(button.disabled, true);
  }
  await app.element('spray').click();
  assert.equal(app.element('care').hidden, true);
  assert.equal(app.element('panel-layer').hidden, true);
  assert.equal(app.element('spray').disabled, true);
  for (const button of app.supplies) assert.equal(button.disabled, false);
  assert.equal(app.actions.length, 3);
  assert.equal(app.element('wallet').textContent, 94);
});

test('large pest totals are not truncated to the number of displayed fruit or treated as ready harvest', () => {
  const app = loadTree({ draw: true });
  app.show(700, {
    fruits: [1, 2, 3, 4, 5].map(id => ({ id, level: 1, locked: true })),
    availableCount: 20, readyCount: 0, pest: { count: 100, fruitIds: [1, 2, 3, 4, 5], fruitId: 1 },
  });
  app.draw();
  const targets = app.element('fruit-targets').querySelectorAll('button');
  assert.equal(targets.length, 5);
  for (const button of targets) assert.match(button.getAttribute('aria-label'), /果实上有小虫/);
  assert.match(app.element('pest-title').textContent, /100\s*条/);
  assert.match(app.element('shop-short').textContent, /100\s*条/);
  assert.equal(app.element('harvest').disabled, true);
  assert.equal(app.element('harvest-panel').disabled, true);
  assert.equal(app.element('spray').disabled, false);
  for (const button of app.supplies) assert.equal(button.disabled, true);
});

test('all five ripe fruits have distinct harvest targets and can be picked individually', async () => {
  const app = loadTree({ draw: true });
  const fruit = id => ({ id, level: 1, name: '红苹果' });
  const targets = () => app.element('fruit-targets').querySelectorAll('button');
  for (let count = 1; count <= 5; count++) {
    app.show(300 + (count - 1) * 20, { fruits: Array.from({ length: count }, (_, index) => fruit(index + 1)), readyCount: count });
    app.draw();
    assert.equal(targets().length, count, `${count} ripe fruits need ${count} individual targets`);
    assert.equal(new Set(targets().map(button => `${button.style.left},${button.style.top}`)).size, count);
    for (const button of targets()) assert.equal(button.getAttribute('aria-label'), '采摘红苹果');
  }

  let remaining = [1, 2, 3, 4, 5];
  app.respondToAction(payload => {
    assert.equal(payload.action, 'harvest');
    assert.ok(remaining.includes(payload.fruitId));
    remaining = remaining.filter(id => id !== payload.fruitId);
    return { snapshot: {
      initialized: true, growth: 380, earned: 380, balance: 100,
      fruits: remaining.map(fruit), readyCount: remaining.length, harvestedCount: 5 - remaining.length,
      care: { usedKinds: [], remainingBoost: 10 },
    } };
  });
  const positions = new Map(targets().map(button => [button.dataset.fruitId, [button.style.left, button.style.top]]));
  for (const id of [4, 2, 5, 1, 3]) {
    await targets().find(button => button.dataset.fruitId === String(id)).click();
    app.draw();
    assert.equal(targets().length, remaining.length);
    assert.deepEqual(targets().map(button => Number(button.dataset.fruitId)).sort(), [...remaining].sort());
    for (const button of targets()) assert.deepEqual([button.style.left, button.style.top], positions.get(button.dataset.fruitId), 'unpicked fruit must stay on its branch');
    assert.equal(app.element('picked').textContent, 5 - remaining.length);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(app.actions)), [4, 2, 5, 1, 3].map(fruitId => ({ action: 'harvest', fruitId })));
  assert.equal(app.element('harvest').disabled, true);
});

test('a newly revealed fruit fills the harvested slot without moving the other four fruits', async () => {
  const app = loadTree({ draw: true });
  const fruits = ids => ids.map(id => ({ id, level: id === 6 ? 2 : 1 }));
  app.show(400, { fruits: fruits([1, 2, 3, 4, 5]), availableCount: 6, readyCount: 6 });
  app.draw();
  const targets = () => app.element('fruit-targets').querySelectorAll('button');
  const position = button => [button.style.left, button.style.top];
  const initial = new Map(targets().map(button => [button.dataset.fruitId, position(button)]));
  app.respondToAction(payload => {
    assert.equal(payload.fruitId, 2);
    return { snapshot: {
      initialized: true, growth: 400, earned: 400, balance: 100, harvestedCount: 1,
      fruits: fruits([1, 3, 4, 5, 6]), availableCount: 5, readyCount: 5,
      care: { usedKinds: [], remainingBoost: 10 },
    } };
  });
  await targets().find(button => button.dataset.fruitId === '2').click();
  app.draw();
  assert.equal(targets().length, 5);
  for (const button of targets()) assert.deepEqual(position(button), initial.get(button.dataset.fruitId === '6' ? '2' : button.dataset.fruitId));
  assert.equal(targets().find(button => button.dataset.fruitId === '6').getAttribute('aria-label'), '采摘蜜桃果');
  assert.equal(app.element('harvest-label').textContent, '一键采摘 · 5 颗');
});

test('the first mature fruit is harvestable at 300 and progress rolls over every 20 points', () => {
  const app = loadTree();
  for (const [growth, remaining, percent] of [
    [300, 20, 0], [319, 1, 95], [320, 20, 0], [340, 20, 0],
    [360, 20, 0], [380, 20, 0], [399, 1, 95], [400, 20, 0], [499, 1, 95], [500, 20, 0],
  ]) {
    app.show(growth, { fruits: [{ id: 1, level: 1, name: '红苹果' }], readyCount: 1 });
    const expected = `再赚 ${remaining} 分，下一颗果实成熟`;
    assert.equal(app.element('next').textContent, expected, `${growth} growth`);
    assert.equal(app.element('harvest-progress').textContent, expected);
    assert.equal(app.element('harvest-progress').hidden, false);
    assert.equal(app.element('fill').style.width, `${percent}%`);
    assert.equal(app.element('harvest-label').textContent, '一键采摘 · 1 颗');
    assert.equal(app.element('harvest').disabled, false);
    assert.equal(app.element('harvest-panel').disabled, false);
  }
});

test('legacy mature fruit stays harvestable below the new threshold while growth shows the next stage', async () => {
  const app = loadTree();
  app.show(170, { fruits: [{ id: 1, level: 1, name: '红苹果' }], readyCount: 1 });
  assert.equal(app.element('harvest-label').textContent, '一键采摘 · 1 颗');
  assert.equal(app.element('harvest-panel').textContent, '一键采摘 · 1 颗');
  assert.equal(app.element('harvest-progress').hidden, false);
  assert.equal(app.element('harvest-progress').textContent, '再赚 30 分，成长为大树');
  await app.element('harvest').click();
  assert.deepEqual(JSON.parse(JSON.stringify(app.actions)), [{ action: 'harvest' }]);
});

test('rules are readable without login or a cloud connection and close through the shared detail panel', async () => {
  const app = loadTree();
  app.show(350, {}, { readOnly: true, offline: true });
  const rulesButton = app.panels.find(button => button.dataset.openPanel === 'rules');
  assert.equal(app.panels.at(-1), rulesButton);
  await rulesButton.click();
  assert.equal(app.element('panel-layer').hidden, false);
  assert.equal(app.element('panel-title').textContent, '果树成长规则');
  assert.equal(rulesButton.getAttribute('aria-expanded'), 'true');
  for (const panel of app.contents) assert.equal(panel.hidden, panel.dataset.panelContent !== 'rules');
  assert.equal(app.element('harvest').disabled, true);
  assert.equal(app.actions.length, 0);
  await app.element('close-panel').click();
  assert.equal(app.element('panel-layer').hidden, true);
  assert.equal(rulesButton.getAttribute('aria-expanded'), 'false');
});

test('manual adjustments keep their sign in the growth breakdown', () => {
  const app = loadTree();
  app.show(750, { earned: 1000, boost: 5, adjustment: -255 });
  assert.equal(app.element('growth-source').textContent, '累计奖励 1000 ＋ 照料助长 5 · 手动调整 −255');
  app.show(1050, { earned: 1000, boost: 5, adjustment: 45 });
  assert.equal(app.element('growth-source').textContent, '累计奖励 1000 ＋ 照料助长 5 · 手动调整 +45');
  app.show(1005, { earned: 1000, boost: 5, adjustment: 0 });
  assert.equal(app.element('growth-source').textContent, '累计奖励 1000 ＋ 照料助长 5');
});

test('mature-stage progress follows the server next fruit threshold after a manual decrease', () => {
  const app = loadTree();
  for (const [growth, remaining, percent] of [[350, 270, 0], [610, 10, 50], [619, 1, 95]]) {
    app.show(growth, { nextFruitGrowth: 620, adjustment: growth - 600, earned: 600 });
    const expected = `再赚 ${remaining} 分，下一颗果实成熟`;
    assert.equal(app.element('next').textContent, expected);
    assert.equal(app.element('harvest-progress').textContent, expected);
    assert.equal(app.element('fill').style.width, `${percent}%`);
  }
  app.show(620, { nextFruitGrowth: 640 });
  assert.equal(app.element('next').textContent, '再赚 20 分，下一颗果实成熟');
  assert.equal(app.element('fill').style.width, '0%');
});

test('resetting growth to a seed preserves harvest controls and cumulative harvest display', async () => {
  const app = loadTree();
  app.show(0, {
    earned: 600, adjustment: -600, nextFruitGrowth: 620, harvestedCount: 11,
    fruits: [{ id: 12, level: 3 }], readyCount: 1,
  });
  assert.equal(app.element('growth-source').textContent, '累计奖励 600 ＋ 照料助长 0 · 手动调整 −600');
  assert.equal(app.element('picked').textContent, 11);
  assert.equal(app.element('harvest-label').textContent, '一键采摘 · 1 颗');
  assert.equal(app.element('harvest-progress').textContent, '再赚 50 分，长出新芽');
  assert.equal(app.element('harvest-panel').disabled, false);
  await app.element('harvest-panel').click();
  assert.deepEqual(JSON.parse(JSON.stringify(app.actions)), [{ action: 'harvest' }]);
});

test('a flowering tree after manual rollback does not promise another first fruit at 300', () => {
  const app = loadTree();
  app.show(275, { nextFruitGrowth: 420, harvestedCount: 6, adjustment: -125, earned: 400 });
  assert.equal(app.element('next').textContent, '再赚 25 分，进入结果期');
  assert.equal(app.element('harvest-label').textContent, '再赚 25 分，进入结果期');
  assert.equal(app.element('harvest-panel').textContent, '下一颗果实，在 420 分等你');
  assert.equal(app.element('fill').style.width, '50%');
  app.show(300, { nextFruitGrowth: 420, harvestedCount: 6 });
  assert.equal(app.element('next').textContent, '再赚 120 分，下一颗果实成熟');
  assert.equal(app.element('harvest-panel').textContent, '下一颗果实，在 420 分等你');
  app.show(275, { nextFruitGrowth: 300 });
  assert.equal(app.element('next').textContent, '再赚 25 分，结出第一颗果实');
  assert.equal(app.element('harvest-panel').textContent, '第一颗果实，在 300 分等你');
});

test('direct tree visits and cloud retry bootstrap an empty server even when a local tree is cached', async () => {
  const source = readFileSync(join(__dirname, '../product/guoguo-fruit-tree-page.js'), 'utf8');
  for (const { exists, cached, loaded = true, token = 'test-token', expected } of [
    { exists: false, cached: true, expected: 1 },
    { exists: true, cached: false, expected: 1 },
    { exists: true, cached: true, expected: 0 },
    { exists: false, cached: true, token: null, expected: 0 },
    { exists: false, cached: true, loaded: false, expected: 0 },
  ]) {
    let commits = 0;
    const elements = new Map();
    const context = vm.createContext({
      state: { points: 100, fruitTree: cached ? { status: 'ready', growth: 300 } : null },
      cloudStateExists: exists, cloudLoaded: loaded, mutationBusy: false, serverRevision: 1,
      getWriteToken: () => token,
      apiLoadState: async () => {}, retryApiLoad: async () => {},
      withCommit: async () => { commits++; },
      window: { GuoguoFruitTree: { create: () => ({ open() {}, update() {} }) }, addEventListener() {} },
      document: {
        getElementById(id) {
          if (!elements.has(id)) elements.set(id, { addEventListener(kind, callback) { this[kind] = callback; } });
          return elements.get(id);
        },
        addEventListener() {},
      },
      setInterval() {},
    });
    vm.runInContext(source, context);
    await new Promise(setImmediate);
    assert.equal(commits, expected, `visit: exists=${exists}, cached=${cached}, loaded=${loaded}, authenticated=${!!token}`);
    await elements.get('syncBannerRetry').click();
    assert.equal(commits, expected * 2, `retry: exists=${exists}, cached=${cached}, loaded=${loaded}, authenticated=${!!token}`);
  }
});
