// KOL 采集助手 - 小红书内容脚本
// 数据源：window.__INITIAL_STATE__（Vue SPA 预渲染数据，通过 MAIN world 桥接）

(function () {
  'use strict';
  if (window.__kol_collector_xhs_injected) return;
  window.__kol_collector_xhs_injected = true;

  var CFG = { name: '小红书', color: '#ff4757', idPrefix: 'xhs' };

  // SPA 导航检测：初始页面的 URL 如果变了，说明是 SPA 跳转，
  // 此时 __INITIAL_STATE__ 里的帖子数据是旧的（首页预览值），不可信
  var initialPathname = window.location.pathname;
  var spaNavigated = false;
  setInterval(function () {
    if (!spaNavigated && window.location.pathname !== initialPathname) {
      spaNavigated = true;
    }
  }, 500);

  // ========== 数据桥接 ==========

  function getInitialState() {
    try {
      var refreshEl = document.getElementById('__kol_xhs_refresh__');
      if (refreshEl) refreshEl.dataset.tick = Date.now().toString();
      var bridge = document.getElementById('__kol_xhs_bridge__');
      if (!bridge || !bridge.textContent || bridge.dataset.ready !== '1') return null;
      return JSON.parse(bridge.textContent);
    } catch (e) { return null; }
  }

  // ========== 页面识别 ==========

  function getPageType() {
    var path = window.location.pathname;
    if (/^\/user\/profile\//.test(path)) return 'profile';
    if (/^\/explore\//.test(path) || /^\/discovery\/item\//.test(path)) return 'post';
    return 'other';
  }

  function extractIdFromUrl(url, type) {
    if (type === 'profile') {
      var m = url.match(/\/user\/profile\/([^/?]+)/);
      return m ? m[1] : null;
    }
    if (type === 'post') {
      var m = url.match(/\/explore\/([^/?]+)/) || url.match(/\/discovery\/item\/([^/?]+)/);
      return m ? m[1] : null;
    }
    return null;
  }

  function parseCount(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      val = val.trim();
      if (val.includes('万')) return Math.round(parseFloat(val) * 10000);
      var n = parseInt(val, 10);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }

  // ========== DOM 回退采集 ==========

  function collectFromDom(noteId) {
    var title = '', bloggerName = '', likes = 0, comments = 0;

    // 标题：多重回退
    var titleEl = document.getElementById('detail-title');
    if (titleEl) title = (titleEl.textContent || '').trim();
    if (!title) {
      var descEl = document.querySelector('.note-text, .desc');
      if (descEl) title = (descEl.textContent || '').trim().substring(0, 100);
    }
    if (!title) {
      var ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) title = (ogTitle.getAttribute('content') || '').trim();
    }
    // 尝试从页面 <title> 提取（通常格式为 "标题 - 作者的小红书"）
    if (!title && document.title) {
      var titleMatch = document.title.match(/^(.+?)[\s-]/);
      if (titleMatch) title = titleMatch[1].trim();
    }

    // 博主名
    var authorEl = document.querySelector('.username')
      || document.querySelector('[class*="author"] .name')
      || document.querySelector('[class*="nickname"]')
      || document.querySelector('.user-name');
    if (authorEl) bloggerName = (authorEl.textContent || '').trim();

    // 互动数据：尝试多种已知的 XHS 互动栏选择器
    var selectors = [
      '.engage-bar-style .count',
      '.interactions .count',
      '.engage-bar .count',
      '.interaction-container .count',
      '.note-action .count',
      '.side-bar .count',
      '.engage-bar-container .count'
    ];
    var countEls = null;
    for (var i = 0; i < selectors.length; i++) {
      var els = document.querySelectorAll(selectors[i]);
      if (els.length >= 2) { countEls = els; break; }
    }
    // 回退：如果上述选择器都不匹配，取页面中所有 .count 元素
    if (!countEls) {
      countEls = document.querySelectorAll('.count');
    }
    if (countEls.length >= 1) likes = parseCount((countEls[0].textContent || '').trim());
    if (countEls.length >= 3) comments = parseCount((countEls[2].textContent || '').trim());

    console.log('[KOL采集-DOM] countEls.length:', countEls.length, 'raw values:', Array.from(countEls).map(function(el) { return el.textContent.trim(); }));

    if (title || bloggerName) {
      return {
        title: title || '无标题',
        bloggerName: bloggerName || '未知',
        likes: likes,
        comments: comments
      };
    }
    return null;
  }

  // ========== 数据采集 ==========

  function collectBlogger() {
    var state = getInitialState();
    var userId = extractIdFromUrl(window.location.href, 'profile');
    if (!userId) {
      KolUi.showToast('无法提取用户ID', true, CFG.color);
      return;
    }

    if (state) {
      var userData = state.user && state.user.userPageData;
      if (userData) {
        var info = userData.basicInfo || {};
        chrome.runtime.sendMessage(
          { action: 'saveBlogger', data: {
            id: CFG.idPrefix + '_' + userId,
            platform: CFG.name,
            name: info.nickname || '未知',
            profileUrl: 'https://www.xiaohongshu.com/user/profile/' + userId,
            followers: parseCount(info.fans),
            note: '',
            collectedAt: new Date().toISOString()
          }},
          function (r) {
            KolUi.showToast(r && r.success ? '已采集博主: ' + info.nickname : '保存失败', !r || !r.success, CFG.color);
          }
        );
        return;
      }
    }

    // 桥接不可用，手动表单 — 用 URL 中的 userId 做 ID，避免重复
    KolUi.showBloggerForm({
      color: CFG.color, label: CFG.name, idPrefix: CFG.idPrefix,
      autoId: CFG.idPrefix + '_' + userId,
      prefillUrl: 'https://www.xiaohongshu.com/user/profile/' + userId,
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

  function savePostData(noteId, title, bloggerName, bloggerProfileUrl, likes, comments, favorites, shares) {
    chrome.runtime.sendMessage(
      { action: 'savePost', data: {
        id: CFG.idPrefix + '_' + noteId,
        platform: CFG.name,
        title: (title || '').substring(0, 100) || '无标题',
        postUrl: window.location.href.split('?')[0],
        bloggerName: bloggerName || '未知',
        bloggerProfileUrl: bloggerProfileUrl || '',
        bloggerFollowers: 0,
        likes: likes || 0,
        comments: comments || 0,
        favorites: favorites || 0,
        shares: shares || 0,
        note: '',
        collectedAt: new Date().toISOString()
      }},
      function (r) {
        KolUi.showToast(
          r && r.success ? '已采集: ' + ((title || '').substring(0, 20)) + '...' : '保存失败',
          !r || !r.success, CFG.color
        );
      }
    );
  }

  function collectPost() {
    var state = getInitialState();
    var noteId = extractIdFromUrl(window.location.href, 'post');
    if (!noteId) {
      KolUi.showToast('无法提取帖子ID', true, CFG.color);
      return;
    }

    console.log('[KOL采集] noteId:', noteId, 'spaNavigated:', spaNavigated);

    // 第1层：从 __INITIAL_STATE__ 获取（仅页面刚加载时有效，SPA 导航后数据是旧的）
    if (!spaNavigated && state) {
      var noteData = state.note && state.note.noteDetailMap && state.note.noteDetailMap[noteId] && state.note.noteDetailMap[noteId].note;
      if (noteData) {
        var interact = noteData.interactInfo || {};
        var user = noteData.user || {};
        console.log('[KOL采集] 第1层命中(initialState), likes:', interact.likedCount, 'comments:', interact.commentCount);
        savePostData(noteId, noteData.title || noteData.desc, user.nickname, user.userId ? 'https://www.xiaohongshu.com/user/profile/' + user.userId : '', parseCount(interact.likedCount), parseCount(interact.commentCount), parseCount(interact.collectedCount), parseCount(interact.shareCount));
        return;
      }
    }

    // 第2层：从 API 拦截数据获取（SPA 导航后有效）
    try {
      var apiEl = document.getElementById('__kol_xhs_api_data__');
      console.log('[KOL采集] 第2层检查: apiEl ready =', apiEl && apiEl.dataset.ready);
      if (apiEl && apiEl.textContent && apiEl.dataset.ready === '1') {
        var apiData = JSON.parse(apiEl.textContent);
        var apiNote = apiData.noteDetailMap && apiData.noteDetailMap[noteId] && apiData.noteDetailMap[noteId].note;
        if (apiNote) {
          var apiInteract = apiNote.interactInfo || {};
          var apiUser = apiNote.user || {};
          console.log('[KOL采集] 第2层命中(API拦截), likes:', apiInteract.likedCount, 'comments:', apiInteract.commentCount, 'interactInfo:', JSON.stringify(apiInteract));
          savePostData(noteId, apiNote.title || apiNote.desc, apiUser.nickname, apiUser.userId ? 'https://www.xiaohongshu.com/user/profile/' + apiUser.userId : '', parseCount(apiInteract.likedCount), parseCount(apiInteract.commentCount), parseCount(apiInteract.collectedCount), parseCount(apiInteract.shareCount));
          return;
        } else {
          console.log('[KOL采集] 第2层: noteDetailMap 中未找到 noteId, 可用的 keys:', apiData.noteDetailMap ? Object.keys(apiData.noteDetailMap) : 'null');
        }
      }
    } catch (e) {
      console.log('[KOL采集] 第2层异常:', e);
    }

    // 第3层：从 DOM 元素刮取（最后手段）
    var domData = collectFromDom(noteId);
    if (domData) {
      console.log('[KOL采集] 第3层命中(DOM), likes:', domData.likes, 'comments:', domData.comments, 'title:', domData.title);
      savePostData(noteId, domData.title, domData.bloggerName, '', domData.likes, domData.comments, 0, 0);
      return;
    }

    console.log('[KOL采集] 全部未命中，回退到手动表单');
    // 第4层：回退到手动填写表单
    KolUi.showPostForm({
      color: CFG.color, label: '帖子', subLabel: CFG.name,
      autoId: CFG.idPrefix + '_' + noteId,
      prefillUrl: window.location.href.split('?')[0],
      onSave: function (overlay, data) {
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
      }
    });
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
