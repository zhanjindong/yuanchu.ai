'use strict';

// Shared cache, session and revisioned API writes for the bank and fruit-tree pages.
// Each page supplies render / showToast / sync-status / requireLogin UI hooks.
/* =========================================================
 * 数据层（localStorage + api.yuanchu.ai 双向同步）
 *  读：本地立即渲染 + 后台异步从 API 拉取覆盖
 *  写：云端确认后缓存；版本校验、待决操作持久化与幂等重试
 * ========================================================= */
const STORAGE_KEY = 'guoguo_points_bank_v1';
// 本地前端连接 :3000 的隔离开发接口或 vercel dev
// 部署后保持 https://api.yuanchu.ai
const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : 'https://api.yuanchu.ai';
const API_POINTS = API_BASE + '/api/points';
const API_FRUIT_TREE = API_BASE + '/api/fruit-tree';
const PENDING_KEY = STORAGE_KEY + '_pending';
const SESSION_KEY = 'guoguo_admin_session_v1';

const DEFAULT_STATE = {
  points: 0,
  rules: {
    earn: [
      { id: 'r1', emoji: '💯', name: '考试 100 分', points: 20, desc: '完美表现', kind: 'earn' },
      { id: 'r2', emoji: '🌟', name: '考试 95-99 分', points: 10, desc: '优秀表现', kind: 'earn' },
      { id: 'r3', emoji: '🎸', name: '吉他练习 ≥30 分钟', points: 5, desc: '坚持练习', kind: 'earn' },
      { id: 'r4', emoji: '🎸', name: '吉他练习 ≥60 分钟', points: 10, desc: '专注练习', kind: 'earn' },
    ],
    deduct: [
      { id: 'r5', emoji: '📉', name: '考试 <70 分', points: 0, desc: '直接清零积分', kind: 'zero' },
      { id: 'r6', emoji: '📉', name: '考试 70-79 分', points: -10, desc: '需要加油', kind: 'deduct' },
      { id: 'r7', emoji: '📉', name: '考试 80-89 分', points: -5, desc: '差一点点', kind: 'deduct' },
      { id: 'r8', emoji: '🎮', name: '偷偷玩游戏', points: -10, desc: '要诚实哦', kind: 'deduct' },
    ],
  },
  goals: [
    { id: 'g1', emoji: '🎮', name: 'Switch 游戏', points: 300 },
    { id: 'g2', emoji: '⌚', name: '小天才儿童手表 Z9A', points: 1500 },
  ],
  history: [],
};

let state = loadState();
let serverRevision = null;
let cloudStateExists = false;
let cloudLoaded = false;
let cloudLoading = false;
let mutationBusy = false;
let pendingMutation = loadPendingMutation();

// 同步从 localStorage 读取 — 用于启动时立即渲染（避免首屏空白）
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  } catch (e) {
    return structuredClone(DEFAULT_STATE);
  }
}

// 本地只作缓存；成长、果实和照料由服务端在同一份状态中原子更新。
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.error('saveState', e); }
}

function loadPendingMutation() {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
    if (saved && ['points', 'tree'].includes(saved.endpoint) && saved.body &&
        typeof saved.body.operationId === 'string' && Number.isInteger(saved.body.revision) &&
        saved.before && typeof saved.before === 'object') return saved;
  } catch (e) {}
  return null;
}

function rememberPending(value) {
  pendingMutation = value;
  try {
    if (value) localStorage.setItem(PENDING_KEY, JSON.stringify(value));
    else localStorage.removeItem(PENDING_KEY);
  } catch (e) {}
}

function acceptServerSnapshot(data) {
  if (!data || !Number.isInteger(data.revision) || data.revision < 0) {
    throw new Error('云端接口需要更新，请稍后重试');
  }
  if (data.state && typeof data.state === 'object') {
    state = { ...structuredClone(DEFAULT_STATE), ...data.state };
  }
  cloudStateExists = !!data.state && typeof data.state === 'object';
  serverRevision = data.revision;
  cloudLoaded = !pendingMutation;
  saveState();
  if (typeof onServerSnapshotAccepted === 'function') onServerSnapshotAccepted();
}

function isPublicTreeAction(action) {
  return ['care', 'spray', 'harvest'].includes(action);
}

function isPublicTreeMutation(pending) {
  return pending?.endpoint === 'tree' && isPublicTreeAction(pending.body?.action);
}

// Only the three game actions are public; bank and administrative writes still require a session.
function assertCanMutate({ action } = {}) {
  if (!isPublicTreeAction(action) && !getWriteToken()) throw new Error('请家长登录后再操作');
  if (mutationBusy) throw new Error('正在保存，请稍等一下');
  if (pendingMutation) throw new Error('上次保存结果待确认，请先点击同步重试');
  if (!cloudLoaded || cloudLoading || serverRevision === null) throw new Error('请先连接云端，确认最新数据');
}

async function sendPendingMutation() {
  const pending = pendingMutation;
  const token = getWriteToken();
  if (!pending) throw new Error('没有待确认的保存结果');
  const publicAction = isPublicTreeMutation(pending);
  if (!publicAction && !token) throw new Error('请家长登录后再同步');
  setSyncStatus('syncing');
  let response;
  let timer;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  try {
    if (controller) timer = setTimeout(() => controller.abort(), 15000);
    response = await fetch(pending.endpoint === 'tree' ? API_FRUIT_TREE : API_POINTS, {
      method: pending.endpoint === 'tree' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json', ...(!publicAction ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(pending.body),
      ...(controller ? { signal: controller.signal } : {}),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || '保存失败，请重试');
      if (response.status === 409 && data.state && Number.isInteger(data.revision)) {
        rememberPending(null);
        acceptServerSnapshot(data);
        error.authoritative = true;
        error.message = '数据已在其他页面更新，已刷新，请重新操作';
      } else if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        rememberPending(null);
      }
      throw error;
    }
    if (!data.state || !Number.isInteger(data.revision)) throw new Error('云端返回不完整，请重试确认保存结果');
    rememberPending(null);
    acceptServerSnapshot(data);
    if (typeof onMutationConfirmed === 'function') onMutationConfirmed(pending, data);
    setSyncStatus('ok');
    hideSyncBanner();
    return data;
  } catch (error) {
    if (!error.authoritative) {
      state = structuredClone(pending.before);
      saveState();
    }
    if (pendingMutation) {
      cloudLoaded = false;
      showSyncBanner('保存结果待确认，请点击重试；不会重复扣分或采摘');
    }
    setSyncStatus(error.authoritative ? 'ok' : 'fail');
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function commitState(before, intent) {
  rememberPending({ endpoint: 'points', before, body: {
    state: structuredClone(state), revision: serverRevision, operationId: uid(),
    ...(intent ? { intent } : {}),
  } });
  return sendPendingMutation();
}

// 快照必须在 mutator 前捕获；任何写入未完成时拒绝第二次操作。
async function withCommit(mutator, opts) {
  try { assertCanMutate(); } catch (e) { showToast(e.message, 'warn'); return false; }
  const before = structuredClone(state);
  mutationBusy = true;
  let submitted = false;
  try {
    mutator();
    render();
    submitted = true;
    await commitState(before, opts && opts.intent);
    if (opts && opts.success) showToast(opts.success, 'success');
    return true;
  } catch (e) {
    if (!submitted) { state = before; saveState(); }
    showToast(e.authoritative ? e.message : pendingMutation ? '保存结果待确认，请点击同步重试' : ((opts && opts.fail) || e.message), 'error');
    return false;
  } finally {
    mutationBusy = false;
    render();
  }
}

// 从 session 读取写权限 token（同步）
function getWriteToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() > s.expiresAt) return null;
    return s.token || null;
  } catch (e) { return null; }
}

// 后台从 API 拉取最新 state,合并覆盖本地 + 重渲染
async function apiLoadState() {
  if (mutationBusy || cloudLoading) return;
  if (pendingMutation && (isPublicTreeMutation(pendingMutation) || getWriteToken())) return retryCommit();
  cloudLoading = true;
  setSyncStatus('syncing');
  if (typeof onSyncChange === 'function') onSyncChange();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
  try {
    const r = await fetch(API_POINTS, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' }, ...(controller ? { signal: controller.signal } : {}) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    acceptServerSnapshot(data);
    setSyncStatus(pendingMutation ? 'fail' : 'ok');
    if (pendingMutation) showSyncBanner('请家长登录后，重试确认上次保存结果');
    else hideSyncBanner();
  } catch (e) {
    cloudLoaded = false;
    setSyncStatus('fail');
    showSyncBanner('无法连接到云端,显示的可能不是最新数据');
  } finally {
    if (timer) clearTimeout(timer);
    cloudLoading = false;
    render();
  }
}

// 重试读 API(给 banner 上的按钮调用)
function retryApiLoad() {
  return pendingMutation ? retryCommit() : apiLoadState();
}
// 结果不确定时复用同一操作编号；没有待决请求时只拉取最新数据。
async function retryCommit() {
  if (mutationBusy || cloudLoading) return;
  if (!pendingMutation) return apiLoadState();
  if (!isPublicTreeMutation(pendingMutation) && !requireLogin()) return;
  mutationBusy = true;
  if (typeof onSyncChange === 'function') onSyncChange();
  try {
    await sendPendingMutation();
    showToast('已确认保存结果', 'success');
  } catch (e) {
    showToast(e.authoritative ? e.message : '同步仍然失败，请检查网络后重试', 'error');
  } finally {
    mutationBusy = false;
    render();
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* =========================================================
 * 每日打卡（Streak）
 *
 * 规则：某天只要有净加分（delta > 0）就算当天打卡成功。
 *   - 加分规则命中、手动调整「增加」都算
 *   - 扣分 / 清零 / 兑换 / 果树照料（消耗积分）都不算
 *
 * 日期切分用北京时间 UTC+8，与服务端 _fruit-tree.js 的 day() 保持一致。
 * ========================================================= */

// 北京时间下的日期 key（YYYY-MM-DD）
function streakDayKey(ts) {
  return new Date(ts + 8 * 3600000).toISOString().slice(0, 10);
}

// key → 北京时间当天 00:00 的时间戳（用于 +1 天运算，北京时间无夏令时）
function streakDayStart(key) {
  return Date.parse(key + 'T00:00:00Z') - 8 * 3600000;
}

function streakNextKey(key) {
  return streakDayKey(streakDayStart(key) + 86400000);
}

function streakPrevKey(key) {
  return streakDayKey(streakDayStart(key) - 86400000);
}

// 本周（周一 → 周日）的 7 个日期 key
function streakWeekKeys(now) {
  const dow = new Date(now + 8 * 3600000).getUTCDay(); // 0=周日
  const backToMonday = (dow + 6) % 7;
  const monday = now - backToMonday * 86400000;
  return Array.from({ length: 7 }, (_, i) => streakDayKey(monday + i * 86400000));
}

// computeStreak 的记忆化缓存
let _streakCache = { sig: '', value: null };

/**
 * 从历史记录算连续打卡天数。
 * @param {Array} history state.history
 * @param {number} now    当前时间戳（默认 Date.now）
 * @returns {{current:number, best:number, checkedToday:boolean,
 *            today:string, week:Array, earnDays:Set<string>}}
 */
function computeStreak(history, now = Date.now()) {
  const list = Array.isArray(history) ? history : [];

  // 记忆化:历史只增不改(服务端强制),所以「长度 + 末条 id」足以判断内容是否变化;
  // 再拼上「今天是哪天」,跨天自动失效重算。
  const last = list.length ? list[list.length - 1] : null;
  const sig = list.length + '|' + (last && last.id ? last.id : '') + '|' + streakDayKey(now);
  if (_streakCache.sig === sig) return _streakCache.value;

  // 每天的净加分次数
  const earnDays = new Set();
  for (const h of list) {
    if (h && typeof h.delta === 'number' && h.delta > 0 && typeof h.time === 'number') {
      earnDays.add(streakDayKey(h.time));
    }
  }

  const today = streakDayKey(now);
  const yesterday = streakPrevKey(today);

  // 当前连续：今天打过就从今天往前数；今天没打但昨天打过，从昨天往前数（今天待打卡，不算断）
  let current = 0;
  let cursor = earnDays.has(today) ? today : (earnDays.has(yesterday) ? yesterday : null);
  while (cursor && earnDays.has(cursor)) {
    current++;
    cursor = streakPrevKey(cursor);
  }

  // 最长纪录：遍历所有打卡日，统计最长的连续段
  const sorted = [...earnDays].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of sorted) {
    run = prev && streakNextKey(prev) === key ? run + 1 : 1;
    if (run > best) best = run;
    prev = key;
  }

  const value = {
    current,
    best,
    checkedToday: earnDays.has(today),
    today,
    week: streakWeekKeys(now),
    earnDays,
  };
  _streakCache = { sig, value };
  return value;
}
