'use strict';

// Page controller: all balances, growth and harvests use the bank's shared client.
let fruitTreeView = null;
let syncStatus = 'syncing';
let syncMessage = '';
let pageMessage = '';

function getFruitTreeSnapshot() {
  const tree = state.fruitTree;
  const available = tree?.available || 0;
  return {
    initialized: !tree || tree.status === 'ready',
    earned: tree?.earned || 0,
    boost: tree?.boost || 0,
    growth: tree?.growth || 0,
    balance: state.points,
    harvestedCount: tree?.harvested || 0,
    bestHarvestLevel: tree?.bestLevel || 0,
    care: { usedKinds: tree?.care?.used || [], remainingBoost: tree?.care?.remainingBonus || 0 },
    pest: { fruitId: tree?.bugFruitId ?? null },
    fruits: tree?.fruits || [],
    readyCount: Math.max(0, available - (tree?.bugFruitId != null ? 1 : 0)),
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
    readOnly: !getWriteToken(),
    busy: mutationBusy || !!pendingMutation,
    retrying: cloudLoading || mutationBusy,
    retry: syncStatus === 'fail' || !!pendingMutation,
    error: pageMessage || syncMessage,
  });
}

function onSyncChange() { render(); }
function onServerSnapshotAccepted() {
  pageMessage = '';
  if (fruitTreeView) fruitTreeView.update(getFruitTreeSnapshot(), { error: '' });
}
function setSyncStatus(status) { syncStatus = status; }
function showSyncBanner(message) { syncMessage = message; }
function hideSyncBanner() { syncMessage = ''; }
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
  if (!requireLogin()) throw new Error('请家长登录后再照料和采摘果树');
  assertCanMutate();
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
    if (pendingMutation) error.message = '保存结果待确认，请点击重新同步，不会重复扣分或采摘';
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
  if (!state.fruitTree && cloudLoaded && !mutationBusy && getWriteToken()) await withCommit(() => {});
}

fruitTreeView = window.GuoguoFruitTree.create({
  onAction: performFruitTreeAction,
  onLogin: goToLogin,
  onRetry: async () => {
    pageMessage = '';
    await retryApiLoad();
    if (!state.fruitTree && cloudLoaded && !mutationBusy && getWriteToken()) await withCommit(() => {});
  },
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
  // Expired sessions immediately disable care without requiring a reload.
  render();
}, 30000);
