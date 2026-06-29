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

  // ========== API 响应拦截 ==========
  // SPA 导航后 __INITIAL_STATE__ 不会更新，
  // 通过拦截 fetch/XHR 捕获帖子 API 响应数据

  var apiEl = document.getElementById('__kol_xhs_api_data__');
  if (!apiEl) {
    apiEl = document.createElement('div');
    apiEl.id = '__kol_xhs_api_data__';
    apiEl.style.display = 'none';
    document.documentElement.appendChild(apiEl);
  }

  function captureApiData(data) {
    if (data && data.data && data.data.noteDetailMap) {
      // 只保留包含当前帖子 ID 的数据，避免 feed API 响应覆盖 detail API 的新鲜数据
      var pathNoteId = (location.pathname.match(/\/explore\/([^/?]+)/) ||
                        location.pathname.match(/\/discovery\/item\/([^/?]+)/));
      var currentId = pathNoteId ? pathNoteId[1] : null;
      if (currentId && !data.data.noteDetailMap[currentId]) {
        return; // 这个响应不包含当前帖子的数据，跳过
      }
      console.log('[KOL采集-bridge] API数据已捕获, noteIds:', Object.keys(data.data.noteDetailMap));
      apiEl.textContent = JSON.stringify(data.data);
      apiEl.dataset.ready = '1';
    }
  }

  // 拦截 fetch（不过滤 content-type，捕获所有可能的 JSON 响应）
  var _fetch = window.fetch;
  window.fetch = function () {
    return _fetch.apply(this, arguments).then(function (response) {
      try {
        response.clone().text().then(function (text) {
          if (text.charAt(0) === '{') {
            try { captureApiData(JSON.parse(text)); } catch (e) {}
          }
        });
      } catch (e) {}
      return response;
    });
  };

  // 拦截 XMLHttpRequest
  var _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.addEventListener('load', function () {
      if (this.status === 200 && this.responseText && this.responseText.charAt(0) === '{') {
        try {
          captureApiData(JSON.parse(this.responseText));
        } catch (e) {}
      }
    });
    return _xhrOpen.apply(this, arguments);
  };
})();
