// KOL 采集助手 - 抖音内容脚本（仅博主采集）
// 数据源：<script id="RENDER_DATA"> URL-encoded JSON

(function () {
  'use strict';
  if (window.__kol_collector_douyin_injected) return;
  window.__kol_collector_douyin_injected = true;

  var CFG = { name: '抖音', color: '#fe2c55', idPrefix: 'douyin' };

  // ========== 数据读取 ==========

  function getRenderData() {
    try {
      var script = document.getElementById('RENDER_DATA');
      if (!script) return null;
      return JSON.parse(decodeURIComponent(script.textContent));
    } catch (e) { return null; }
  }

  function getPageType() {
    var path = window.location.pathname;
    if (/^\/user\/[^/]+/.test(path)) return 'profile';
    return 'other';
  }

  function extractIdFromUrl(type) {
    var path = window.location.pathname;
    if (type === 'profile') {
      var m = path.match(/\/user\/([^/?]+)/);
      return m ? m[1] : null;
    }
    return null;
  }

  // ========== 数据采集 ==========

  function collectBlogger() {
    var secUid = extractIdFromUrl('profile');
    if (!secUid) {
      KolUi.showBloggerForm({
        color: CFG.color, label: CFG.name, idPrefix: CFG.idPrefix,
        onSave: function (overlay, data) {
          chrome.runtime.sendMessage(
            { action: 'saveBlogger', data: {
              id: data.id, platform: CFG.name, name: data.name,
              profileUrl: data.profileUrl, followers: data.followers,
              note: '', collectedAt: new Date().toISOString()
            }},
            function (r) {
              overlay.remove();
              KolUi.showToast(r && r.success ? '已采集博主: ' + data.name : '保存失败', !r || !r.success, CFG.color);
            }
          );
        }
      });
      return;
    }

    var renderData = getRenderData();
    var loggedInUser = renderData && renderData.app && renderData.app.user && renderData.app.user.info;

    if (loggedInUser && loggedInUser.nickname &&
        (loggedInUser.secUid === secUid || loggedInUser.sec_uid === secUid || loggedInUser.uid === secUid)) {
      var followers = parseInt(loggedInUser.follower_count || loggedInUser.followerCount || loggedInUser.fans || 0, 10);
      chrome.runtime.sendMessage(
        { action: 'saveBlogger', data: {
          id: CFG.idPrefix + '_' + secUid,
          platform: CFG.name,
          name: loggedInUser.nickname,
          profileUrl: 'https://www.douyin.com/user/' + secUid,
          followers: followers,
          note: '',
          collectedAt: new Date().toISOString()
        }},
        function (r) {
          KolUi.showToast(r && r.success ? '已采集博主: ' + loggedInUser.nickname : '保存失败', !r || !r.success, CFG.color);
        }
      );
    } else {
      KolUi.showBloggerForm({
        color: CFG.color, label: CFG.name, idPrefix: CFG.idPrefix,
        autoId: CFG.idPrefix + '_' + secUid,
        prefillUrl: 'https://www.douyin.com/user/' + secUid,
        onSave: function (overlay, data) {
          chrome.runtime.sendMessage(
            { action: 'saveBlogger', data: {
              id: data.id, platform: CFG.name, name: data.name,
              profileUrl: data.profileUrl, followers: data.followers,
              note: '', collectedAt: new Date().toISOString()
            }},
            function (r) {
              overlay.remove();
              KolUi.showToast(r && r.success ? '已采集博主: ' + data.name : '保存失败', !r || !r.success, CFG.color);
            }
          );
        }
      });
    }
  }

  // ========== 初始化 ==========

  KolUi.initRouter(function () {
    var pageType = getPageType();
    var menuActions = [];
    if (pageType === 'profile') {
      menuActions.push({ label: '\uD83D\uDC64 采集博主', action: collectBlogger });
    }
    KolUi.createFloatingButton(pageType, CFG, menuActions);
  });
})();
