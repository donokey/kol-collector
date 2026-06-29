// KOL 采集助手 - 微博内容脚本
// 支持 weibo.com 和 m.weibo.cn
// API：m.weibo.cn/api/container/getIndex（博主+博文列表）、/statuses/show（单条帖子）

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
    // 同域直接请求，跨域走 service worker 代理
    if (window.location.hostname.indexOf('weibo.cn') >= 0) {
      return fetch(url, { credentials: 'include' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({ action: 'fetchUrl', url: url }, function (resp) {
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
        if (resp && resp.success) { resolve(resp.data); }
        else { reject(new Error(resp && resp.error || 'fetchUrl failed')); }
      });
    });
  }

  function stripHtml(html) {
    return (html || '').replace(/<[^>]*>/g, '');
  }

  function formatCount(num) {
    if (!num) return '0';
    if (num >= 10000) return (num / 10000).toFixed(1) + '\u4E07';
    return num.toLocaleString();
  }

  function parseWeiboDate(dateStr) {
    if (!dateStr) return null;
    var now = new Date();
    var m;
    if (m = dateStr.match(/^(\d+)\s*分钟前$/)) {
      return new Date(now.getTime() - parseInt(m[1]) * 60000);
    }
    if (m = dateStr.match(/^(\d+)\s*小时前$/)) {
      return new Date(now.getTime() - parseInt(m[1]) * 3600000);
    }
    if (dateStr.indexOf('今天') === 0) {
      var t = dateStr.match(/(\d+):(\d+)/);
      if (t) { var d = new Date(); d.setHours(parseInt(t[1]), parseInt(t[2]), 0, 0); return d; }
    }
    if (m = dateStr.match(/^昨天\s*(\d+):(\d+)/)) {
      var d = new Date(); d.setDate(d.getDate() - 1);
      d.setHours(parseInt(m[1]), parseInt(m[2]), 0, 0); return d;
    }
    if (m = dateStr.match(/^(\d{1,2})-(\d{1,2})$/)) {
      return new Date(now.getFullYear(), parseInt(m[1]) - 1, parseInt(m[2]));
    }
    // "Mon Jan 15 14:30:00 +0800 2024" or ISO format
    var d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = parseWeiboDate(dateStr);
    if (!d) return dateStr;
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
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

  // ========== 主页批量采集博文 ==========

  function collectPostsFromProfile() {
    var uid = extractIdFromUrl('profile');
    if (!uid) {
      KolUi.showToast('无法识别博主UID', true, CFG.color);
      return;
    }

    KolUi.showToast('正在获取博文列表...', false, CFG.color);

    // 第一步：获取博主信息和微博 tab containerid
    fetchJson('https://m.weibo.cn/api/container/getIndex?type=uid&value=' + uid)
      .then(function (profileData) {
        if (profileData.ok !== 1 || !profileData.data) {
          throw new Error('获取博主信息失败');
        }

        var userInfo = profileData.data.userInfo || {};
        var containerid = null;

        // 从 tabsInfo 找微博 tab 的 containerid
        if (profileData.data.tabsInfo && profileData.data.tabsInfo.tabs) {
          var tabs = profileData.data.tabsInfo.tabs;
          for (var i = 0; i < tabs.length; i++) {
            if (tabs[i].tab_type === 'weibo') {
              containerid = tabs[i].containerid;
              break;
            }
          }
        }

        // 回退：默认 containerid = "107603" + uid
        if (!containerid) containerid = '107603' + uid;

        // 分页获取博文（最多5页）
        var allPosts = [];
        var MAX_PAGES = 5;

        function fetchPage(page) {
          var url = 'https://m.weibo.cn/api/container/getIndex?type=uid&value=' + uid +
                    '&containerid=' + containerid + '&page=' + page;
          return fetchJson(url).then(function (postsData) {
            if (postsData.ok !== 1 || !postsData.data || !postsData.data.cards) {
              return false; // 没有更多数据
            }

            var cards = postsData.data.cards;
            var pageInfo = postsData.data.cardlistInfo || {};
            var newCount = 0;

            for (var i = 0; i < cards.length; i++) {
              var card = cards[i];
              if (card.mblog) {
                allPosts.push(parseMblog(card.mblog, userInfo));
                newCount++;
              }
              if (card.card_group) {
                for (var j = 0; j < card.card_group.length; j++) {
                  if (card.card_group[j].mblog) {
                    allPosts.push(parseMblog(card.card_group[j].mblog, userInfo));
                    newCount++;
                  }
                }
              }
            }

            KolUi.showToast('已获取 ' + allPosts.length + ' 条博文（第' + page + '页）...', false, CFG.color);

            // 判断是否还有下一页
            var total = pageInfo.total || 0;
            if (newCount === 0 || page >= MAX_PAGES) return false;
            if (total > 0 && allPosts.length >= total) return false;
            return true; // 继续下一页
          });
        }

        function fetchNext(page) {
          return fetchPage(page).then(function (hasMore) {
            if (hasMore) {
              // 间隔300ms避免请求过快
              return new Promise(function (resolve) { setTimeout(resolve, 300); })
                .then(function () { return fetchNext(page + 1); });
            }
            return allPosts;
          });
        }

        return fetchNext(1).then(function (posts) {
          if (posts.length === 0) {
            KolUi.showToast('该博主暂无公开博文', true, CFG.color);
            return;
          }

          // 按时间从新到旧排序
          posts.sort(function (a, b) {
            var da = a.rawDate ? a.rawDate.getTime() : 0;
            var db = b.rawDate ? b.rawDate.getTime() : 0;
            return db - da;
          });

          // 显示选择器（支持搜索和时间筛选）
          KolUi.showPostSelector({
            title: '\u5FAE\u535A\u6587 (' + posts.length + ' \u6761)',
            posts: posts,
            showFilters: true,
            onSave: function (selected) {
              var saved = 0;
              var total = selected.length;
              selected.forEach(function (post) {
                var saveData = {
                  id: post.id,
                  platform: post.platform,
                  title: post.title,
                  postUrl: post.postUrl,
                  bloggerName: post.bloggerName,
                  bloggerProfileUrl: post.bloggerProfileUrl,
                  bloggerFollowers: post.bloggerFollowers,
                  likes: post.likes,
                  comments: post.comments,
                  favorites: post.favorites || 0,
                  shares: post.shares || 0,
                  note: post.note || '',
                  collectedAt: post.collectedAt
                };
                chrome.runtime.sendMessage(
                  { action: 'savePost', data: saveData },
                  function (r) {
                    saved++;
                    if (saved === total) {
                      KolUi.showToast('\u5DF2\u91C7\u96C6 ' + total + ' \u6761\u535A\u6587', false, CFG.color);
                    }
                  }
                );
              });
            }
          });
        });
      })
      .catch(function (e) {
        KolUi.showToast(e.message || '获取博文列表失败', true, CFG.color);
      });
  }

  // 解析 mblog 对象为统一的帖子数据结构
  function parseMblog(mblog, fallbackUser) {
    var user = mblog.user || fallbackUser || {};
    var postId = mblog.id || mblog.mid || '';
    var rawText = mblog.text_raw || stripHtml(mblog.text || '').trim();
    var text = rawText.replace(/\s+/g, ' ').trim();
    var rawDate = parseWeiboDate(mblog.created_at) || new Date();

    return {
      // 保存用的完整数据
      id: CFG.idPrefix + '_' + postId,
      platform: CFG.name,
      title: (text || '无内容').substring(0, 100),
      postUrl: postId ? ('https://m.weibo.cn/detail/' + postId) : '',
      bloggerName: user.screen_name || '未知',
      bloggerProfileUrl: user.id ? ('https://weibo.com/u/' + user.id) : '',
      bloggerFollowers: user.followers_count || 0,
      likes: mblog.attitudes_count || 0,
      comments: mblog.comments_count || 0,
      favorites: 0,
      shares: mblog.reposts_count || 0,
      note: '',
      collectedAt: new Date().toISOString(),
      // 选择器展示用
      titleText: (text || '无内容').substring(0, 60),
      likesText: formatCount(mblog.attitudes_count || 0),
      commentsText: formatCount(mblog.comments_count || 0),
      dateText: formatDate(mblog.created_at),
      rawDate: rawDate
    };
  }

  // ========== 单条帖子采集（博文详情页） ==========

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
              comments: post.comments_count || 0,
              favorites: 0,
              shares: post.reposts_count || 0,
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
      menuActions.push({ label: '\uD83D\uDCDD 采集博文', action: collectPostsFromProfile });
    }
    if (pageType === 'post') {
      menuActions.push({ label: '\uD83D\uDCDD 采集博文', action: collectPost });
    }
    KolUi.createFloatingButton(pageType, CFG, menuActions);
  });
})();
