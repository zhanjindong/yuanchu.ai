/* 技术文章阅读批注层：划线 / 写想法，存后端（api.yuanchu.ai），
   加载时按 text-quote 重新定位并绘制，支持从笔记页 #hl-<id> 跳转回划线处。
   仅在 /tech/ 下、且能找到正文根的页面启用。第一版无认证，接口开放。 */
(function () {
  "use strict";

  // 后端地址；本地调试可执行 localStorage.setItem('hl_api_base','http://localhost:3000')
  var API_BASE = (function () {
    try { return localStorage.getItem("hl_api_base") || "https://api.yuanchu.ai"; }
    catch (e) { return "https://api.yuanchu.ai"; }
  })();
  var CTX = 30; // 上下文长度（用于定位消歧）

  // ---- 正文根与文章上下文 ----
  function getRoot() {
    return document.querySelector(".prose")
      || document.querySelector(".article-content")
      || document.querySelector(".article-body")
      || document.querySelector(".content");
  }
  function getSlug() {
    var m = location.pathname.match(/\/tech\/(.+?)(?:\.html)?$/);
    if (m) return decodeURIComponent(m[1]);
    var seg = location.pathname.split("/").pop() || "";
    return decodeURIComponent(seg.replace(/\.html$/, ""));
  }
  function getTitle() {
    var h = document.querySelector(".article-header h1, .prose h1, h1");
    return (h && h.textContent.trim()) || document.title;
  }

  var ROOT = getRoot();
  var SLUG = getSlug();
  if (!ROOT || !SLUG) return; // 不是文章页，不启用

  var TITLE = getTitle();
  var byId = {};        // id -> highlight（含定位失败的）
  var located = {};     // id -> true 表示已成功绘制

  // ---- 文本索引：把正文根内所有文本节点顺序拼接，记录每个节点的起始全局偏移 ----
  function buildTextIndex() {
    var walker = document.createTreeWalker(ROOT, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        var p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest("script,style,.hl-toolbar,.hl-popover")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], text = "", n;
    while ((n = walker.nextNode())) {
      nodes.push({ node: n, start: text.length });
      text += n.nodeValue;
    }
    return { nodes: nodes, text: text };
  }

  // 全局偏移 -> {node, offset}
  function locate(nodes, off) {
    for (var i = 0; i < nodes.length; i++) {
      var len = nodes[i].node.nodeValue.length;
      if (off <= nodes[i].start + len) return { node: nodes[i].node, offset: off - nodes[i].start };
    }
    var last = nodes[nodes.length - 1];
    return { node: last.node, offset: last.node.nodeValue.length };
  }

  // (container, offset) -> 全局偏移
  function toGlobal(nodes, container, offset) {
    if (container.nodeType === Node.TEXT_NODE) {
      for (var i = 0; i < nodes.length; i++) if (nodes[i].node === container) return nodes[i].start + offset;
      return 0;
    }
    var child = container.childNodes[offset];
    if (child) {
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].node === child || (child.nodeType === 1 && child.contains(nodes[j].node))) return nodes[j].start;
      }
    }
    var prev = container.childNodes[offset - 1];
    if (prev) {
      for (var k = nodes.length - 1; k >= 0; k--) {
        if (prev === nodes[k].node || (prev.nodeType === 1 && prev.contains(nodes[k].node))) {
          return nodes[k].start + nodes[k].node.nodeValue.length;
        }
      }
    }
    return 0;
  }

  // 最近的、位于选区起点之前、带 id 的标题
  function nearestSection(node) {
    var el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    // 先向上找是否处于某个带 id 的容器；否则回溯前面的兄弟标题
    var cur = el;
    while (cur && cur !== ROOT) {
      var prev = cur.previousElementSibling;
      while (prev) {
        if (/^H[1-6]$/.test(prev.tagName) && prev.id) return { id: prev.id, title: prev.textContent.trim() };
        var inner = prev.querySelector && prev.querySelector("h1[id],h2[id],h3[id],h4[id]");
        if (inner) return { id: inner.id, title: inner.textContent.trim() };
        prev = prev.previousElementSibling;
      }
      cur = cur.parentElement;
    }
    return { id: "", title: "" };
  }

  // ---- 定位：根据 exact + prefix/suffix 在全文里找起始偏移 ----
  function findOffset(text, hl) {
    var exact = hl.exact, prefix = hl.prefix || "", suffix = hl.suffix || "";
    if (!exact) return -1;
    if (prefix || suffix) {
      var combo = prefix + exact + suffix;
      var ci = text.indexOf(combo);
      if (ci !== -1) return ci + prefix.length;
    }
    var cands = [], from = 0, idx;
    while ((idx = text.indexOf(exact, from)) !== -1) { cands.push(idx); from = idx + 1; }
    if (!cands.length) return -1;
    if (cands.length === 1) return cands[0];
    var best = cands[0], bestScore = -1;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      var before = text.slice(Math.max(0, c - prefix.length), c);
      var after = text.slice(c + exact.length, c + exact.length + suffix.length);
      var score = 0;
      if (prefix && before === prefix) score += 3; else if (prefix && before.slice(-4) === prefix.slice(-4)) score += 1;
      if (suffix && after === suffix) score += 3; else if (suffix && after.slice(0, 4) === suffix.slice(0, 4)) score += 1;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  // ---- 绘制：把 [gStart,gEnd) 的文字用 <mark> 包起来（可跨多个文本节点）----
  function wrapOffsets(gStart, gEnd, hl) {
    var idx = buildTextIndex();
    var nodes = idx.nodes;
    var first = true, made = [];
    for (var i = 0; i < nodes.length; i++) {
      var entry = nodes[i];
      var nStart = entry.start, nEnd = entry.start + entry.node.nodeValue.length;
      if (nEnd <= gStart || nStart >= gEnd) continue;
      var from = Math.max(gStart, nStart) - nStart;
      var to = Math.min(gEnd, nEnd) - nStart;
      var tn = entry.node;
      if (from > 0) tn = tn.splitText(from);
      if (to - from < tn.nodeValue.length) tn.splitText(to - from);
      var mark = document.createElement("mark");
      mark.className = "hl " + (hl.note ? "hl-thought" : "hl-mark");
      mark.setAttribute("data-hl", hl.id);
      if (first) { mark.id = "hl-" + hl.id; first = false; }
      tn.parentNode.insertBefore(mark, tn);
      mark.appendChild(tn);
      made.push(mark);
    }
    return made;
  }

  // 撤销某条划线的 <mark>（把文字还原）
  function unwrap(id) {
    var marks = ROOT.querySelectorAll('mark[data-hl="' + cssEsc(id) + '"]');
    marks.forEach(function (m) {
      var parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
  }
  function cssEsc(s) { return String(s).replace(/["\\]/g, "\\$&"); }

  // 应用一条 highlight（定位 + 绘制），成功返回 true
  function apply(hl) {
    byId[hl.id] = hl;
    var idx = buildTextIndex();
    var off = findOffset(idx.text, hl);
    if (off < 0) return false;
    wrapOffsets(off, off + hl.exact.length, hl);
    located[hl.id] = true;
    return true;
  }

  // ---- 网络 ----
  function api(path, opts) {
    return fetch(API_BASE + "/api/highlights" + path, opts).then(function (r) { return r.json(); });
  }

  // ---- UI：工具条 / 弹窗 / 提示 ----
  var toolbar, popover, toast, pendingRange = null, pendingCtx = null;

  function buildUI() {
    toolbar = document.createElement("div");
    toolbar.className = "hl-toolbar";
    toolbar.innerHTML = '<button data-act="mark">划线</button><button data-act="think">写想法</button>';
    document.body.appendChild(toolbar);
    toolbar.addEventListener("mousedown", function (e) { e.preventDefault(); });
    toolbar.addEventListener("click", function (e) {
      var act = e.target.getAttribute("data-act");
      if (act === "mark") createHighlight("");
      else if (act === "think") openThoughtEditor();
    });

    popover = document.createElement("div");
    popover.className = "hl-popover";
    document.body.appendChild(popover);
    popover.addEventListener("mousedown", function (e) { e.stopPropagation(); });

    toast = document.createElement("div");
    toast.className = "hl-toast";
    document.body.appendChild(toast);
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.classList.remove("show"); }, 1800);
  }

  function hideToolbar() { toolbar.classList.remove("show"); }
  function hidePopover() { popover.classList.remove("show"); }

  function positionAt(el, rect, below) {
    el.style.left = (window.scrollX + rect.left + rect.width / 2) + "px";
    el.style.top = (window.scrollY + (below ? rect.bottom : rect.top)) + "px";
  }

  // 采集当前选区的定位上下文
  function captureSelection() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var range = sel.getRangeAt(0);
    if (!ROOT.contains(range.commonAncestorContainer)) return null;
    var idx = buildTextIndex();
    var gStart = toGlobal(idx.nodes, range.startContainer, range.startOffset);
    var gEnd = toGlobal(idx.nodes, range.endContainer, range.endOffset);
    if (gEnd <= gStart) return null;
    var exact = idx.text.slice(gStart, gEnd);
    if (!exact.trim()) return null;
    var sec = nearestSection(range.startContainer);
    return {
      rect: range.getBoundingClientRect(),
      data: {
        slug: SLUG, title: TITLE, url: "/tech/" + SLUG + ".html",
        sectionId: sec.id, sectionTitle: sec.title,
        exact: exact,
        prefix: idx.text.slice(Math.max(0, gStart - CTX), gStart),
        suffix: idx.text.slice(gEnd, gEnd + CTX)
      }
    };
  }

  function onSelect() {
    var cap = captureSelection();
    if (!cap) { hideToolbar(); return; }
    pendingCtx = cap.data;
    toolbar.classList.add("show");
    positionAt(toolbar, cap.rect, false);
  }

  function createHighlight(note) {
    if (!pendingCtx) return;
    var payload = Object.assign({}, pendingCtx, { note: note || "" });
    hideToolbar(); hidePopover();
    var sel = window.getSelection(); if (sel) sel.removeAllRanges();
    api("", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (res && res.ok) {
        apply(res.highlight);
        showToast(note ? "已保存想法" : "已划线");
      } else {
        showToast((res && res.error) || "保存失败");
      }
    }).catch(function () { showToast("网络错误，保存失败"); });
    pendingCtx = null;
  }

  // 写想法编辑器（新建）
  function openThoughtEditor() {
    if (!pendingCtx) return;
    var rect = toolbar.getBoundingClientRect();
    popover.innerHTML =
      '<div class="hl-ref">' + escapeHtml(pendingCtx.exact) + '</div>' +
      '<textarea placeholder="写下你的想法…"></textarea>' +
      '<div class="hl-actions"><button class="hl-cancel">取消</button><button class="hl-save">保存</button></div>';
    popover.classList.add("show");
    positionAt(popover, rect, true);
    hideToolbar();
    var ta = popover.querySelector("textarea");
    ta.focus();
    popover.querySelector(".hl-cancel").onclick = function () { hidePopover(); pendingCtx = null; };
    popover.querySelector(".hl-save").onclick = function () {
      var v = ta.value.trim();
      if (!v) { ta.focus(); return; }
      createHighlight(v);
    };
  }

  // 点击已有划线 -> 查看/删除
  function openExisting(id, anchorEl) {
    var hl = byId[id];
    if (!hl) return;
    var rect = anchorEl.getBoundingClientRect();
    var body = hl.note
      ? '<div class="hl-note-view">' + escapeHtml(hl.note) + '</div><div class="hl-ref">' + escapeHtml(hl.exact) + '</div>'
      : '<div class="hl-ref">' + escapeHtml(hl.exact) + '</div>';
    popover.innerHTML = body +
      '<div class="hl-actions"><button class="hl-del">删除</button><button class="hl-cancel">关闭</button></div>';
    popover.classList.add("show");
    positionAt(popover, rect, true);
    popover.querySelector(".hl-cancel").onclick = hidePopover;
    popover.querySelector(".hl-del").onclick = function () {
      api("?slug=" + encodeURIComponent(hl.slug) + "&id=" + encodeURIComponent(id), { method: "DELETE" })
        .then(function (res) {
          if (res && res.ok) { unwrap(id); delete byId[id]; delete located[id]; showToast("已删除"); }
          else showToast("删除失败");
        }).catch(function () { showToast("网络错误，删除失败"); });
      hidePopover();
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- 跳转：#hl-<id> ----
  function handleHash() {
    var m = (location.hash || "").match(/^#hl-(.+)$/);
    if (!m) return;
    var id = m[1];
    var el = document.getElementById("hl-" + id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      ROOT.querySelectorAll('mark[data-hl="' + cssEsc(id) + '"]').forEach(function (mm) {
        mm.classList.add("hl-flash");
        setTimeout(function () { mm.classList.remove("hl-flash"); }, 2400);
      });
      return;
    }
    // 定位失败 -> 退回章节锚点
    var hl = byId[id];
    if (hl && hl.sectionId) {
      var sec = document.getElementById(hl.sectionId);
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // ---- 启动 ----
  function init() {
    buildUI();
    // 桌面：鼠标抬起即取选区；移动端：触摸结束 + selectionchange 兜底（长按选字后无 mouseup）
    document.addEventListener("mouseup", function () { setTimeout(onSelect, 0); });
    document.addEventListener("touchend", function () { setTimeout(onSelect, 0); });
    var selTimer;
    document.addEventListener("selectionchange", function () {
      clearTimeout(selTimer);
      selTimer = setTimeout(onSelect, 350); // 等用户拖完选择手柄再判定
    });
    function onPress(e) {
      var m = e.target.closest && e.target.closest("mark.hl");
      if (m) { e.stopPropagation(); openExisting(m.getAttribute("data-hl"), m); return; }
      if (!toolbar.contains(e.target) && !popover.contains(e.target)) { hideToolbar(); hidePopover(); }
    }
    document.addEventListener("mousedown", onPress);

    api("?slug=" + encodeURIComponent(SLUG), {})
      .then(function (res) {
        if (res && res.ok && Array.isArray(res.highlights)) {
          var fails = 0;
          res.highlights.forEach(function (hl) { if (!apply(hl)) fails++; });
          if (fails) console.warn("[reader] " + fails + " 条划线定位失败（原文可能已改动）");
        }
        handleHash();
      })
      .catch(function () { handleHash(); });

    window.addEventListener("hashchange", handleHash);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
