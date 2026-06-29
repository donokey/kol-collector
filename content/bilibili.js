// KOL 采集助手 - B站内容脚本
// API：api.bilibili.com/x/relation/stat（粉丝）、/x/web-interface/view（视频详情）

(function () {
  'use strict';
  if (window.__kol_collector_bilibili_injected) return;
  window.__kol_collector_bilibili_injected = true;

  var CFG = { name: 'B站', color: '#00a1d6', idPrefix: 'bilibili' };

  // ========== 页面识别 ==========

  function getPageType() {
    var path = window.location.pathname;
    var host = window.location.hostname;
    if (host.includes('space.bilibili.com') && /^\/\d+/.test(path)) return 'profile';
    if (/^\/video\/(BV[\w]+|av\d+)/i.test(path)) return 'post';
    return 'other';
  }

  function extractIdFromUrl(type) {
    var path = window.location.pathname;
    if (type === 'profile') {
      var m = path.match(/^\/(\d+)/);
      return m ? m[1] : null;
    }
    if (type === 'post') {
      var m = path.match(/^\/video\/(BV[\w]+|av\d+)/i);
      return m ? m[1] : null;
    }
    return null;
  }

  function formatFollowers(num) {
    if (num >= 10000) return (num / 10000).toFixed(1) + '万';
    return num.toLocaleString();
  }

  function fetchJson(url) {
    // B站 API 需要 CSRF token，从 bili_jct cookie 中提取
    var csrf = '';
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var c = cookies[i].trim();
      if (c.indexOf('bili_jct=') === 0) {
        csrf = c.substring(9);
        break;
      }
    }
    if (csrf) {
      url += (url.indexOf('?') >= 0 ? '&' : '?') + 'csrf=' + encodeURIComponent(csrf);
    }
    return fetch(url, { credentials: 'include' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  // ========== 数据采集 ==========

  function collectBlogger() {
    var mid = extractIdFromUrl('profile');
    if (!mid) {
      KolUi.showBloggerForm({
        color: CFG.color, label: CFG.name, idPrefix: CFG.idPrefix,
        onSave: makeBloggerSave()
      });
      return;
    }

    fetchJson('https://api.bilibili.com/x/relation/stat?vmid=' + mid)
      .then(function (data) {
        if (data.code !== 0 || !data.data) {
          KolUi.showBloggerForm({
            color: CFG.color, label: CFG.name, idPrefix: CFG.idPrefix,
            autoId: CFG.idPrefix + '_' + mid,
            prefillUrl: 'https://space.bilibili.com/' + mid,
            onSave: makeBloggerSave()
          });
          return;
        }

        var follower = data.data.follower || 0;
        // 从页面 title 或 DOM 获取博主名称
        var title = document.title || '';
        var nameMatch = title.match(/个人空间-(.+?)的个人空间/) || title.match(/^(.+?)的个人空间/);
        var name = nameMatch ? nameMatch[1] : '';

        if (!name) {
          var nameEl = document.querySelector('#h-name') || document.querySelector('.h-name') || document.querySelector('[class*="nickname"]');
          name = nameEl ? nameEl.textContent.trim() : '';
        }

        if (name) {
          saveBlogger(mid, name, follower);
        } else {
          KolUi.showBloggerForm({
            color: CFG.color, label: CFG.name, idPrefix: CFG.idPrefix,
            autoId: CFG.idPrefix + '_' + mid,
            prefillFollowers: follower,
            prefillUrl: 'https://space.bilibili.com/' + mid,
            onSave: makeBloggerSave()
          });
        }
      })
      .catch(function () {
        KolUi.showBloggerForm({
          color: CFG.color, label: CFG.name, idPrefix: CFG.idPrefix,
          autoId: CFG.idPrefix + '_' + mid,
          prefillUrl: 'https://space.bilibili.com/' + mid,
          onSave: makeBloggerSave()
        });
      });
  }

  function saveBlogger(mid, name, followers) {
    chrome.runtime.sendMessage(
      { action: 'saveBlogger', data: {
        id: CFG.idPrefix + '_' + mid,
        platform: CFG.name, name: name,
        profileUrl: 'https://space.bilibili.com/' + mid,
        followers: followers, note: '',
        collectedAt: new Date().toISOString()
      }},
      function (r) {
        var msg = r && r.success ? '已采集博主: ' + name + ' (粉丝: ' + formatFollowers(followers) + ')' : '保存失败';
        KolUi.showToast(msg, !r || !r.success, CFG.color);
      }
    );
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
    var bvid = extractIdFromUrl('post');
    if (!bvid) {
      KolUi.showPostForm({
        color: CFG.color, label: '视频', subLabel: CFG.name,
        titleLabel: '视频标题', bloggerLabel: 'UP主名称',
        onSave: makePostSave()
      });
      return;
    }

    fetchJson('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid)
      .then(function (data) {
        if (data.code !== 0 || !data.data) {
          KolUi.showPostForm({
            color: CFG.color, label: '视频', subLabel: CFG.name,
            titleLabel: '视频标题', bloggerLabel: 'UP主名称',
            autoId: CFG.idPrefix + '_' + bvid,
            prefillUrl: 'https://www.bilibili.com/video/' + bvid,
            onSave: makePostSave()
          });
          return;
        }

        var video = data.data;
        var stat = video.stat || {};
        var owner = video.owner || {};
        var bloggerFollowers = 0;

        function saveVideo(fans) {
          chrome.runtime.sendMessage(
            { action: 'savePost', data: {
              id: CFG.idPrefix + '_' + bvid,
              platform: CFG.name,
              title: (video.title || '无标题').substring(0, 100),
              postUrl: 'https://www.bilibili.com/video/' + bvid,
              bloggerName: owner.name || '未知',
              bloggerProfileUrl: owner.mid ? 'https://space.bilibili.com/' + owner.mid : '',
              bloggerFollowers: fans,
              likes: stat.like || 0,
              comments: stat.reply || 0,
              note: '',
              collectedAt: new Date().toISOString()
            }},
            function (r) {
              var fansText = fans > 0 ? ' (粉丝: ' + formatFollowers(fans) + ')' : '';
              var msg = r && r.success ? '已采集: ' + video.title.substring(0, 20) + '...' + fansText : '保存失败';
              KolUi.showToast(msg, !r || !r.success, CFG.color);
            }
          );
        }

        if (owner.mid) {
          fetchJson('https://api.bilibili.com/x/relation/stat?vmid=' + owner.mid)
            .then(function (u) {
              if (u.code !== 0) {
                console.log('[KOL采集] B站粉丝API失败, code:', u.code, 'message:', u.message);
              }
              saveVideo(u.code === 0 && u.data ? (u.data.follower || 0) : 0);
            })
            .catch(function (e) {
              console.log('[KOL采集] B站粉丝API异常:', e);
              saveVideo(0);
            });
        } else {
          saveVideo(0);
        }
      })
      .catch(function () {
        KolUi.showPostForm({
          color: CFG.color, label: '视频', subLabel: CFG.name,
          titleLabel: '视频标题', bloggerLabel: 'UP主名称',
          autoId: CFG.idPrefix + '_' + bvid,
          prefillUrl: 'https://www.bilibili.com/video/' + bvid,
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
    }
    if (pageType === 'post') {
      menuActions.push({ label: '\uD83D\uDCDD 采集视频', action: collectPost });
    }
    KolUi.createFloatingButton(pageType, CFG, menuActions);
  });
})();
