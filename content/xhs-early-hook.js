// KOL 采集助手 - 小红书早期 API 拦截钩子
// 运行在 MAIN world + document_start，确保在页面 JS 之前安装
// 这样页面脚本拿到的是我们已经包装过的 fetch/XHR

(function () {
  'use strict';

  // 创建数据存储元素（document_start 时 body 还不存在，挂在 html 上）
  var apiEl = document.createElement('div');
  apiEl.id = '__kol_xhs_api_data__';
  apiEl.style.display = 'none';
  document.documentElement.appendChild(apiEl);

  function captureApiData(data) {
    if (data && data.data && data.data.noteDetailMap) {
      // 只保留包含当前帖子 ID 的数据，避免 feed API 响应覆盖 detail 数据
      var pathNoteId = (location.pathname.match(/\/explore\/([^/?]+)/) ||
                        location.pathname.match(/\/discovery\/item\/([^/?]+)/));
      var currentId = pathNoteId ? pathNoteId[1] : null;
      if (currentId && !data.data.noteDetailMap[currentId]) {
        return;
      }
      apiEl.textContent = JSON.stringify(data.data);
      apiEl.dataset.ready = '1';
    }
  }

  // ========== 拦截 fetch ==========
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

  // ========== 拦截 XMLHttpRequest ==========
  var _xhrOpen = XMLHttpRequest.prototype.open;
  var _xhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__kol_xhr_url = url;
    return _xhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      if (this.status === 200 && this.responseText && this.responseText.charAt(0) === '{') {
        try { captureApiData(JSON.parse(this.responseText)); } catch (e) {}
      }
    });
    return _xhrSend.apply(this, arguments);
  };
})();
