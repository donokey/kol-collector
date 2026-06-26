// KOL 采集助手 - 抖音内容脚本
// 数据源：<script id="RENDER_DATA"> URL-encoded JSON + DOM data-e2e 选择器

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
    var params = new URLSearchParams(window.location.search);
    if (/^\/user\/[^/]+/.test(path)) return 'profile';
    if (/^\/video\/[^/]+/.test(path) || /^\/note\/[^/]+/.test(path)) return 'post';
    if (params.has('modal_id')) return 'post';
    if (/\/search\//.test(path)) return 'post';
    if (document.querySelector('[data-e2e="feed-video"]')) return 'post';
    return 'other';
  }

  function extractIdFromUrl(type) {
    var path = window.location.pathname;
    var params = new URLSearchParams(window.location.search);
    if (type === 'profile') {
      var m = path.match(/\/user\/([^/?]+)/);
      return m ? m[1] : null;
    }
    if (type === 'post') {
      if (params.has('modal_id')) return params.get('modal_id');
      var m = path.match(/\/video\/([^/?]+)/) || path.match(/\/note\/([^/?]+)/);
      return m ? m[1] : null;
    }
    return null;
  }

  function parseCountText(text) {
    if (!text) return 0;
    text = text.trim();
    if (text.includes('万')) return Math.round(parseFloat(text) * 10000);
    var n = parseInt(text, 10);
    return isNaN(n) ? 0 : n;
  }

  // 从 DOM 读取当前视频数据（全屏视频流 / 搜索模态框）
  function readVideoFromDOM() {
    var container = document.querySelector('[data-e2e="feed-active-video"]');
    if (!container) {
      var feedVideos = document.querySelectorAll('[data-e2e="feed-video"]');
      if (feedVideos.length === 0) return null;
      for (var i = 0; i < feedVideos.length; i++) {
        var rect = feedVideos[i].getBoundingClientRect();
        if (rect.top >= 0 && rect.top < window.innerHeight * 0.5) {
          container = feedVideos[i];
          break;
        }
      }
      if (!container) container = feedVideos[0];
    }

    var nicknameEl = container.querySelector('[data-e2e="feed-video-nickname"]');
    var descEl = container.querySelector('[data-e2e="video-desc"]');
    var diggEl = container.querySelector('[data-e2e="video-player-digg"]');
    if (!nicknameEl && !descEl) return null;

    var authorProfileUrl = '';
    var avatarLink = container.querySelector('a[href*="/user/"]');
    if (avatarLink) {
      var href = avatarLink.getAttribute('href');
      authorProfileUrl = href.startsWith('http') ? href : 'https://www.douyin.com' + href;
    }

    return {
      nickname: nicknameEl ? nicknameEl.textContent.trim().replace(/^@/, '') : '',
      desc: descEl ? descEl.textContent.trim() : '',
      likes: diggEl ? parseCountText(diggEl.textContent) : 0,
      authorProfileUrl: authorProfileUrl
    };
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

  function collectPost() {
    var postId = extractIdFromUrl('post');
    var postUrl = postId ? 'https://www.douyin.com/video/' + postId : window.location.href;

    var domData = readVideoFromDOM();
    if (domData && (domData.nickname || domData.desc)) {
      chrome.runtime.sendMessage(
        { action: 'savePost', data: {
          id: CFG.idPrefix + '_' + (postId || Date.now()),
          platform: CFG.name,
          title: (domData.desc || domData.nickname + '的视频').substring(0, 100),
          postUrl: postUrl,
          bloggerName: domData.nickname || '未知',
          bloggerProfileUrl: domData.authorProfileUrl || '',
          bloggerFollowers: 0,
          likes: domData.likes,
          note: '',
          collectedAt: new Date().toISOString()
        }},
        function (r) {
          KolUi.showToast(r && r.success ? '已采集: ' + (domData.desc || '').substring(0, 20) + '...' : '保存失败', !r || !r.success, CFG.color);
        }
      );
    } else {
      KolUi.showPostForm({
        color: CFG.color, label: '帖子', subLabel: CFG.name,
        autoId: CFG.idPrefix + '_' + (postId || Date.now()),
        prefillUrl: postUrl,
        onSave: function (overlay, data) {
          chrome.runtime.sendMessage(
            { action: 'savePost', data: {
              id: data.id, platform: CFG.name,
              title: data.title.substring(0, 100), postUrl: data.postUrl,
              bloggerName: data.bloggerName, bloggerProfileUrl: '',
              bloggerFollowers: data.followers, likes: data.likes,
              note: '', collectedAt: new Date().toISOString()
            }},
            function (r) {
              overlay.remove();
              KolUi.showToast(r && r.success ? '已采集: ' + data.title.substring(0, 20) + '...' : '保存失败', !r || !r.success, CFG.color);
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
    if (pageType === 'post') {
      menuActions.push({ label: '\uD83D\uDCDD 采集帖子', action: collectPost });
    }
    KolUi.createFloatingButton(pageType, CFG, menuActions);
  });
})();
