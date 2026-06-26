// KOL 采集助手 - 微博内容脚本
// 支持 weibo.com 和 m.weibo.cn
// API：m.weibo.cn/api/container/getIndex（博主）、/statuses/show（帖子）

(function () {
  'use strict';
  if (window.__kol_collector_weibo_injected) return;
  window.__kol_collector_weibo_injected = true;

  var CFG = { name: '微博', color: '#e6162d', idPrefix: 'weibo' };

  // ========== 页面识别 ==========

  function getPageType() {
    var host = window.location.hostname;
    var path = window.location.pathname;

    if (host === 'm.weibo.cn') {
      if (/^\/u\/\d+/.test(path) || /^\/profile\/\d+/.test(path)) return 'profile';
      if (/^\/detail\/\d+/.test(path) || /^\/status\/\w+/.test(path)) return 'post';
      return 'other';
    }

    if (host.includes('weibo.com')) {
      if (/^\/u\/\d+/.test(path)) return 'profile';
      var parts = path.split('/').filter(Boolean);
      if (parts.length >= 2 && /^\d{6,}$/.test(parts[0]) && /^[\w]{8,}$/.test(parts[1])) return 'post';
      if (parts.length === 1 && /^\d{6,}$/.test(parts[0])) return 'profile';
    }

    return 'other';
  }

  function extractIdFromUrl(type) {
    var path = window.location.pathname;
    if (type === 'profile') {
      var m = path.match(/\/u\/(\d+)/) || path.match(/^\/(\d{6,})/);
      return m ? m[1] : null;
    }
    if (type === 'post') {
      var dm = path.match(/\/detail\/(\w+)/) || path.match(/\/status\/(\w+)/);
      if (dm) return dm[1];
      var parts = path.split('/').filter(Boolean);
      if (parts.length >= 2) return parts[1];
    }
    return null;
  }

  function fetchJson(url) {
    return fetch(url, { credentials: 'include' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  function stripHtml(html) {
    return (html || '').replace(/<[^>]*>/g, '');
  }

  // ========== 数据采集 ==========

  function collectBlogger() {
    var uid = extractIdFromUrl('profile');
    if (!uid) {
      KolUi.showBloggerForm({
        color: CFG.color, label: CFG.name, idPrefix: CFG.idPrefix,
        onSave: makeBloggerSave()
      });
      return;
    }

    fetchJson('https://m.weibo.cn/api/container/getIndex?type=uid&value=' + uid)
      .then(function (data) {
        if (data.ok === 1 && data.data && data.data.userInfo) {
          var info = data.data.userInfo;
          chrome.runtime.sendMessage(
            { action: 'saveBlogger', data: {
              id: CFG.idPrefix + '_' + uid,
              platform: CFG.name, name: info.screen_name || '未知',
              profileUrl: 'https://weibo.com/u/' + uid,
              followers: info.followers_count || 0,
              note: '', collectedAt: new Date().toISOString()
            }},
            function (r) {
              KolUi.showToast(r && r.success ? '已采集博主: ' + info.screen_name : '保存失败', !r || !r.success, CFG.color);
            }
          );
        } else {
          KolUi.showBloggerForm({
            color: CFG.color, label: CFG.name, idPrefix: CFG.idPrefix,
            autoId: CFG.idPrefix + '_' + uid,
            prefillUrl: 'https://weibo.com/u/' + uid,
            onSave: makeBloggerSave()
          });
        }
      })
      .catch(function () {
        KolUi.showBloggerForm({
          color: CFG.color, label: CFG.name, idPrefix: CFG.idPrefix,
          autoId: CFG.idPrefix + '_' + uid,
          prefillUrl: 'https://weibo.com/u/' + uid,
          onSave: makeBloggerSave()
        });
      });
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

  function collectPost() {
    var postId = extractIdFromUrl('post');
    if (!postId) {
      KolUi.showPostForm({
        color: CFG.color, label: '博文', subLabel: CFG.name,
        titleLabel: '博文内容摘要', bloggerLabel: '博主名称',
        onSave: makePostSave()
      });
      return;
    }

    fetchJson('https://m.weibo.cn/statuses/show?id=' + postId)
      .then(function (data) {
        if (data.ok === 1 && data.data) {
          var post = data.data;
          var user = post.user || {};
          chrome.runtime.sendMessage(
            { action: 'savePost', data: {
              id: CFG.idPrefix + '_' + postId,
              platform: CFG.name,
              title: stripHtml(post.text).substring(0, 100) || '无标题',
              postUrl: 'https://m.weibo.cn/detail/' + postId,
              bloggerName: user.screen_name || '未知',
              bloggerProfileUrl: user.id ? 'https://weibo.com/u/' + user.id : '',
              bloggerFollowers: user.followers_count || 0,
              likes: post.attitudes_count || 0,
              note: '',
              collectedAt: new Date().toISOString()
            }},
            function (r) {
              KolUi.showToast(
                r && r.success ? '已采集: ' + stripHtml(post.text).substring(0, 20) + '...' : '保存失败',
                !r || !r.success, CFG.color
              );
            }
          );
        } else {
          KolUi.showPostForm({
            color: CFG.color, label: '博文', subLabel: CFG.name,
            titleLabel: '博文内容摘要', bloggerLabel: '博主名称',
            autoId: CFG.idPrefix + '_' + postId,
            prefillUrl: 'https://m.weibo.cn/detail/' + postId,
            onSave: makePostSave()
          });
        }
      })
      .catch(function () {
        KolUi.showPostForm({
          color: CFG.color, label: '博文', subLabel: CFG.name,
          titleLabel: '博文内容摘要', bloggerLabel: '博主名称',
          autoId: CFG.idPrefix + '_' + postId,
          prefillUrl: 'https://m.weibo.cn/detail/' + postId,
          onSave: makePostSave()
        });
      });
  }

  function makePostSave() {
    return function (overlay, data) {
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
    };
  }

  // ========== 初始化 ==========

  KolUi.initRouter(function () {
    var pageType = getPageType();
    var menuActions = [];
    if (pageType === 'profile') {
      menuActions.push({ label: '\uD83D\uDC64 采集博主', action: collectBlogger });
      menuActions.push({ label: '\uD83D\uDCDD 采集博文', action: function () {
        KolUi.showPostForm({
          color: CFG.color, label: '博文', subLabel: CFG.name,
          titleLabel: '博文内容摘要', bloggerLabel: '博主名称',
          onSave: makePostSave()
        });
      }});
    }
    if (pageType === 'post') {
      menuActions.push({ label: '\uD83D\uDCDD 采集博文', action: collectPost });
    }
    KolUi.createFloatingButton(pageType, CFG, menuActions);
  });
})();
