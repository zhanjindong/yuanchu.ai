'use strict';

// Page controller: all balances, growth and harvests use the bank's shared client.
let fruitTreeView = null;
let syncStatus = 'syncing';
let syncMessage = '';
let pageMessage = '';

function getFruitTreeSnapshot() {
  const tree = state.fruitTree;
  const available = tree?.available || 0;
  const fruitIds = Array.isArray(tree?.bugFruitIds) ? tree.bugFruitIds : tree?.bugFruitId != null ? [tree.bugFruitId] : [];
  const pestCount = Number.isSafeInteger(tree?.pestCount) && tree.pestCount >= 0
    ? tree.pestCount : Math.max(fruitIds.length, tree?.bugFruitId != null ? 1 : 0);
  // The API shows up to five fruits. Its total includes pests and fruit beyond the visible crown.
  const readyCount = Number.isSafeInteger(tree?.readyCount) && tree.readyCount >= 0
    ? Math.min(available, tree.readyCount) : Math.max(0, available - pestCount);
  return {
    initialized: !tree || tree.status === 'ready',
    earned: tree?.earned || 0,
    boost: tree?.boost || 0,
    adjustment: tree?.adjustment || 0,
    growth: tree?.growth || 0,
    nextFruitGrowth: tree?.nextFruitGrowth,
    balance: state.points,
    harvestedCount: tree?.harvested || 0,
    bestHarvestLevel: tree?.bestLevel || 0,
    care: { usedKinds: tree?.care?.used || [], remainingBoost: tree?.care?.remainingBonus || 0 },
    pest: { count: pestCount, fruitIds, fruitId: tree?.bugFruitId ?? fruitIds[0] ?? null },
    fruits: tree?.fruits || [],
    readyCount,
    lockedFruitCount: available - readyCount,
    availableCount: available,
    initialization: { suggestedEarned: tree?.migration?.estimate || 0, historyIncomplete: !!tree?.migration?.requiresConfirmation },
    revision: serverRevision,
  };
}

function render() {
  if (!fruitTreeView) return;
  fruitTreeView.update(getFruitTreeSnapshot(), {
    loading: cloudLoading,
    offline: !cloudLoaded && !cloudLoading,
    readOnly: false,
    canInitialize: !!getWriteToken(),
    busy: mutationBusy || !!pendingMutation,
    retrying: cloudLoading || mutationBusy,
    retry: false,
    syncErrorVisible: !!syncMessage,
    error: pageMessage,
  });
}

function onSyncChange() { render(); }
function onServerSnapshotAccepted() {
  pageMessage = '';
  if (fruitTreeView) fruitTreeView.update(getFruitTreeSnapshot(), { error: '' });
}
function setSyncStatus(status) { syncStatus = status; }
function showSyncBanner(message) {
  syncMessage = message;
  const banner = document.getElementById('syncBanner');
  banner.querySelector('.sync-banner-text').textContent = '⚠️ ' + message;
  banner.hidden = false;
}
function hideSyncBanner() {
  syncMessage = '';
  document.getElementById('syncBanner').hidden = true;
}
function showToast(message, kind) {
  pageMessage = kind === 'success' ? '' : message;
}

function goToLogin() {
  location.assign('guoguo-points-bank.html?from=fruit-tree&login=1');
}
function requireLogin() {
  if (getWriteToken()) return true;
  goToLogin();
  return false;
}

async function performFruitTreeAction(payload) {
  if (!isPublicTreeAction(payload.action) && !requireLogin()) throw new Error('请家长登录后再调整果树');
  assertCanMutate({ action: payload.action });
  const before = structuredClone(state);
  mutationBusy = true;
  pageMessage = '';
  render();
  const body = { action: payload.action, revision: serverRevision, operationId: uid() };
  if (payload.action === 'care') body.item = payload.kind;
  if (payload.action === 'harvest' && payload.fruitId != null) body.fruitId = payload.fruitId;
  if (payload.action === 'initialize') body.earned = payload.earned;
  rememberPending({ endpoint: 'tree', before, body });
  try {
    await sendPendingMutation();
    return { snapshot: getFruitTreeSnapshot() };
  } catch (error) {
    if (pendingMutation) error.message = '保存结果待确认，请点击顶部重试，不会重复扣分或采摘';
    pageMessage = error.message;
    throw error;
  } finally {
    mutationBusy = false;
    render();
  }
}

async function loadFruitTreePage() {
  await apiLoadState();
  // A new household can also start from a directly opened tree page.
  if ((!cloudStateExists || !state.fruitTree) && cloudLoaded && !mutationBusy && getWriteToken()) await withCommit(() => {});
}

fruitTreeView = window.GuoguoFruitTree.create({
  mount: document.getElementById('treePage'),
  onAction: performFruitTreeAction,
  onLogin: goToLogin,
});
document.getElementById('syncBannerRetry').addEventListener('click', async () => {
  pageMessage = '';
  await retryApiLoad();
  if ((!cloudStateExists || !state.fruitTree) && cloudLoaded && !mutationBusy && getWriteToken()) await withCommit(() => {});
});
document.getElementById('treeLoading').hidden = true;
fruitTreeView.open(getFruitTreeSnapshot(), { loading: true });
loadFruitTreePage();

window.addEventListener('pageshow', event => { if (event.persisted) loadFruitTreePage(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadFruitTreePage();
});
setInterval(() => {
  const careDay = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  if (cloudLoaded && !document.hidden && state.fruitTree?.care?.date && state.fruitTree.care.date !== careDay) apiLoadState();
  // Keep the historical initialization permission in sync with the parent session.
  render();
}, 30000);
