// KOL 采集助手 - 小红书桥接脚本
// 运行在页面主世界（MAIN world）
// 从 HTML 源码中正则提取 __INITIAL_STATE__（Vue 水合后全局变量可能被清除）

(function () {
  'use strict';

  var BRIDGE_ID = '__kol_xhs_bridge__';
  var REFRESH_ID = '__kol_xhs_refresh__';

  function ensureBridge() {
    var bridge = document.getElementById(BRIDGE_ID);
    if (!bridge) {
      bridge = document.createElement('div');
      bridge.id = BRIDGE_ID;
      bridge.style.display = 'none';
      document.documentElement.appendChild(bridge);
    }
    return bridge;
  }

  // 从 HTML 源码提取 __INITIAL_STATE__
  function extractInitialState() {
    // 方法1：直接从全局变量读取（如果还存在）
    try {
      if (window.__INITIAL_STATE__) {
        return JSON.parse(JSON.stringify(window.__INITIAL_STATE__));
      }
    } catch (e) {}

    // 方法2：从 HTML 源码正则提取
    try {
      var html = document.documentElement.innerHTML;
      // 匹配 <script>window.__INITIAL_STATE__={...}</script>
      var match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\})\s*<\/script>/s);
      if (match && match[1]) {
        // 替换 :undefined 为 :null（XHS 的数据中有 undefined，不是合法 JSON）
        var jsonStr = match[1].replace(/:undefined/g, ':null');
        return JSON.parse(jsonStr);
      }
    } catch (e) {
      console.warn('[KOL采集-bridge] HTML正则提取失败:', e);
    }

    // 方法3：从所有 script 标签中查找
    try {
      var scripts = document.querySelectorAll('script');
      for (var i = 0; i < scripts.length; i++) {
        var text = scripts[i].textContent || '';
        if (text.indexOf('__INITIAL_STATE__') !== -1) {
          // 平衡括号提取，避免贪婪正则吞掉后续 JS 变量
          var start = text.indexOf('{', text.indexOf('__INITIAL_STATE__'));
          if (start !== -1) {
            var depth = 0, inStr = false, esc = false;
            for (var k = start; k < text.length; k++) {
              var ch = text[k];
              if (esc) { esc = false; continue; }
              if (ch === '\\') { esc = true; continue; }
              if (ch === '"' || ch === "'") { inStr = !inStr; continue; }
              if (inStr) continue;
              if (ch === '{') depth++;
              else if (ch === '}') { depth--; if (depth === 0) { var str = text.substring(start, k + 1).replace(/:undefined/g, ':null'); return JSON.parse(str); } }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[KOL采集-bridge] script标签提取失败:', e);
    }

    return null;
  }

  function refreshData() {
    var bridge = ensureBridge();
    var state = extractInitialState();
    if (state) {
      bridge.textContent = JSON.stringify(state);
      bridge.dataset.ready = '1';
    } else {
      bridge.textContent = '';
      bridge.dataset.ready = '0';
    }
  }

  // 初始读取
  refreshData();

  // 创建 refresh 触发元素
  var refreshEl = document.getElementById(REFRESH_ID);
  if (!refreshEl) {
    refreshEl = document.createElement('div');
    refreshEl.id = REFRESH_ID;
    refreshEl.style.display = 'none';
    document.documentElement.appendChild(refreshEl);
  }

  // 监听 refresh 信号
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].target.id === REFRESH_ID) {
        refreshData();
        return;
      }
    }
  });
  observer.observe(refreshEl, { attributes: true, attributeFilter: ['data-tick'] });

  // SPA 导航自动刷新
  var lastUrl = location.href;
  setInterval(function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(refreshData, 1000);
    }
  }, 500);

  // API 拦截已移至 xhs-early-hook.js（document_start 时机，确保在页面 JS 之前安装）
})();
