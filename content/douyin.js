// KOL 采集助手 - 抖音内容脚本
// 数据源：<script id="RENDER_DATA"> URL-encoded JSON（博主）
// 帖子采集为纯手动表单（抖音反爬严格，不做自动抓取）

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
    if (/^\/video\/\d+/.test(path) || /^\/note\/\d+/.test(path)) return 'post';
    return 'other';
  }

  function extractIdFromUrl(type) {
    var path = window.location.pathname;
    if (type === 'profile') {
      var m = path.match(/\/user\/([^/?]+)/);
      return m ? m[1] : null;
    }
    if (type === 'post') {
      var m = path.match(/\/video\/(\d+)/) || path.match(/\/note\/(\d+)/);
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
        onSave: makeBloggerSave()
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
        onSave: makeBloggerSave()
      });
    }
  }

  function makeBloggerSave() {
    return function (overlay, data) {
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
    };
  }

  // 帖子采集：纯手动表单
  function collectPost() {
    var videoId = extractIdFromUrl('post');
    var postUrl = videoId ? ('https://www.douyin.com/video/' + videoId) : window.location.href;

    KolUi.showPostForm({
      color: CFG.color, label: '视频', subLabel: CFG.name,
      titleLabel: '视频标题/描述', bloggerLabel: '博主名称',
      autoId: CFG.idPrefix + '_' + (videoId || Date.now()),
      prefillUrl: postUrl,
      onSave: makePostSave()
    });
  }

  function makePostSave() {
    return function (overlay, data) {
      chrome.runtime.sendMessage(
        { action: 'savePost', data: {
          id: data.id, platform: CFG.name,
          title: data.title.substring(0, 100), postUrl: data.postUrl,
          bloggerName: data.bloggerName, bloggerProfileUrl: '',
          bloggerFollowers: data.followers,
          likes: data.likes || 0, comments: data.comments || 0,
          favorites: data.favorites || 0, shares: data.shares || 0,
          note: '', collectedAt: new Date().toISOString()
        }},
        function (r) {
          overlay.remove();
          KolUi.showToast(r && r.success ? '已采集: ' + data.title.substring(0, 20) + '...' : '保存失败', !r || !r.success, CFG.color);
        }
      );
    };
  }

  // ========== 初始化 ==========

  KolUi.initRouter(function () {
    var pageType = getPageType();
    var menuActions = [];
    if (pageType === 'profile') {
      menuActions.push({ label: '\uD83D\uDC64 采集博主', action: collectBlogger });
    }
    if (pageType === 'post') {
      menuActions.push({ label: '\uD83D\uDCDD 采集视频', action: collectPost });
    }
    KolUi.createFloatingButton(pageType, CFG, menuActions);
  });
})();
