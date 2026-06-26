// KOL 采集助手 - 抖音内容脚本
// 数据源：<script id="RENDER_DATA"> 内的 URL-encoded JSON

(function () {
  'use strict';

  // 诊断日志：确认脚本是否被注入
  console.log('[KOL采集] 抖音 content script 已加载, URL:', window.location.href);

  // 防止重复注入
  if (window.__kol_collector_douyin_injected) return;
  window.__kol_collector_douyin_injected = true;

  // ========== 工具函数 ==========

  // 解析 RENDER_DATA
  function getRenderData() {
    try {
      const script = document.getElementById('RENDER_DATA');
      if (!script) {
        console.warn('[KOL采集] 抖音: 未找到 RENDER_DATA 元素');
        return null;
      }
      console.log('[KOL采集] 抖音: 找到 RENDER_DATA, 长度:', script.textContent.length);
      const decoded = decodeURIComponent(script.textContent);
      return JSON.parse(decoded);
    } catch (e) {
      console.warn('[KOL采集] 抖音 RENDER_DATA 解析失败:', e);
      return null;
    }
  }

  // 判断当前页面类型
  function getPageType() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    // 博主主页
    if (/^\/user\/[^/]+/.test(path)) return 'profile';
    // 视频/帖子页（直接页面 或 搜索结果中的 modal_id）
    if (/^\/video\/[^/]+/.test(path) || /^\/note\/[^/]+/.test(path)) return 'post';
    if (params.has('modal_id')) return 'post';
    // 搜索页（搜索后查看视频）
    if (/\/search\//.test(path)) return 'post';
    // 全屏视频流（首页推荐等）：URL 是 "/" 但页面上有视频元素
    if (document.querySelector('[data-e2e="feed-video"]')) return 'post';
    return 'other';
  }

  // 从 URL 提取 ID
  function extractIdFromUrl(type) {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (type === 'profile') {
      const match = path.match(/\/user\/([^/?]+)/);
      return match ? match[1] : null;
    }
    if (type === 'post') {
      // 优先从 modal_id 参数提取（搜索结果页模态框）
      if (params.has('modal_id')) return params.get('modal_id');
      // 其次从路径提取
      const match = path.match(/\/video\/([^/?]+)/) || path.match(/\/note\/([^/?]+)/);
      return match ? match[1] : null;
    }
    return null;
  }

  // 在 RENDER_DATA 中搜索包含指定值的对象（用于精确匹配 secUid）
  function findByValue(data, targetValue, maxDepth = 8) {
    if (!data || maxDepth <= 0) return null;
    if (typeof data !== 'object') return null;

    // 检查当前对象是否包含目标值（兼容 snake_case 和 camelCase）
    if ((data.sec_uid === targetValue || data.secUid === targetValue ||
         data.uid === targetValue) && data.nickname) {
      return data;
    }

    for (const key of Object.keys(data)) {
      const result = findByValue(data[key], targetValue, maxDepth - 1);
      if (result) return result;
    }
    return null;
  }

  // 在 RENDER_DATA 中搜索包含指定 key 的对象
  function findByKey(data, targetKeys, maxDepth = 6) {
    if (!data || maxDepth <= 0) return null;
    if (typeof data !== 'object') return null;

    // targetKeys 支持数组（多个候选 key）
    const keys = Array.isArray(targetKeys) ? targetKeys : [targetKeys];
    for (const k of keys) {
      if (data[k] !== undefined) return data;
    }

    for (const key of Object.keys(data)) {
      const result = findByKey(data[key], keys, maxDepth - 1);
      if (result) return result;
    }
    return null;
  }

  // ========== 数据采集 ==========

  function collectBlogger() {
    const secUid = extractIdFromUrl('profile');
    if (!secUid) {
      showBloggerForm({});
      return;
    }

    // 尝试从 RENDER_DATA 获取数据
    const renderData = getRenderData();
    const loggedInUser = renderData?.app?.user?.info;

    // 检查是否匹配：app.user.info 是登录用户，只有 secUid 一致时才用
    if (loggedInUser?.nickname &&
        (loggedInUser.secUid === secUid || loggedInUser.sec_uid === secUid || loggedInUser.uid === secUid)) {
      // 是自己的主页，数据可靠
      const followers = parseInt(loggedInUser.follower_count || loggedInUser.followerCount || loggedInUser.fans || 0, 10);
      console.log('[KOL采集] 抖音: 从 RENDER_DATA 提取博主', loggedInUser.nickname);

      chrome.runtime.sendMessage(
        { action: 'saveBlogger', data: {
          id: `douyin_${secUid}`,
          platform: '抖音',
          name: loggedInUser.nickname,
          profileUrl: `https://www.douyin.com/user/${secUid}`,
          followers: followers,
          note: '',
          collectedAt: new Date().toISOString()
        }},
        (response) => {
          if (response?.success) {
            showToast(`已采集博主: ${loggedInUser.nickname}`);
          } else {
            showToast('保存失败', true);
          }
        }
      );
    } else {
      // 别人的主页，RENDER_DATA 里没有博主数据，弹表单
      console.log('[KOL采集] 抖音: RENDER_DATA 中无目标博主数据, 切换到手动表单');
      showBloggerForm({ secUid, profileUrl: `https://www.douyin.com/user/${secUid}` });
    }
  }

  // 博主采集表单
  function showBloggerForm(autoData) {
    const existing = document.getElementById('kol-post-form-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'kol-post-form-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: '999999', display: 'flex', alignItems: 'center', justifyContent: 'center'
    });

    const form = document.createElement('div');
    Object.assign(form.style, {
      backgroundColor: '#fff', borderRadius: '16px', padding: '24px',
      width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', fontFamily: '-apple-system, sans-serif'
    });

    form.innerHTML = `
      <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3436">👤 采集博主</div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">博主名称 *</label>
        <input id="kol-bf-name" type="text" placeholder="输入博主名称" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">粉丝数</label>
        <input id="kol-bf-followers" type="text" placeholder="输入粉丝数" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">主页链接</label>
        <input id="kol-bf-url" type="text" value="${autoData.profileUrl || ''}" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:12px;color:#b2bec3;box-sizing:border-box" readonly>
      </div>
      <div style="display:flex;gap:8px">
        <button id="kol-bf-cancel" style="flex:1;padding:10px;border:1px solid #dfe6e9;border-radius:8px;background:#fff;color:#636e72;font-size:14px;cursor:pointer">取消</button>
        <button id="kol-bf-save" style="flex:1;padding:10px;border:none;border-radius:8px;background:#fe2c55;color:#fff;font-size:14px;font-weight:500;cursor:pointer">保存</button>
      </div>
    `;

    overlay.appendChild(form);
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('kol-bf-name').focus(), 100);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('kol-bf-cancel').addEventListener('click', () => overlay.remove());

    document.getElementById('kol-bf-save').addEventListener('click', () => {
      const name = document.getElementById('kol-bf-name').value.trim();
      const followers = parseInt(document.getElementById('kol-bf-followers').value.trim() || '0', 10);

      if (!name) {
        document.getElementById('kol-bf-name').style.borderColor = '#e74c3c';
        return;
      }

      const bloggerData = {
        id: `douyin_${autoData.secUid || Date.now()}`,
        platform: '抖音',
        name: name,
        profileUrl: autoData.profileUrl || '',
        followers: followers,
        note: '',
        collectedAt: new Date().toISOString()
      };

      chrome.runtime.sendMessage(
        { action: 'saveBlogger', data: bloggerData },
        (response) => {
          overlay.remove();
          if (response?.success) {
            showToast(`已采集博主: ${name}`);
          } else {
            showToast('保存失败', true);
          }
        }
      );
    });
  }

  // 解析中文数字（"1.6万" → 16000）
  function parseCountText(text) {
    if (!text) return 0;
    text = text.trim();
    if (text.includes('万')) return Math.round(parseFloat(text) * 10000);
    const num = parseInt(text, 10);
    return isNaN(num) ? 0 : num;
  }

  // 从 DOM 读取当前视频模态框数据
  function readVideoFromDOM() {
    // 优先找当前活跃的视频
    let container = document.querySelector('[data-e2e="feed-active-video"]');
    if (!container) {
      // 备用：找视口内可见的 feed-video
      const feedVideos = document.querySelectorAll('[data-e2e="feed-video"]');
      if (feedVideos.length === 0) return null;

      for (const el of feedVideos) {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < window.innerHeight * 0.5) {
          container = el;
          break;
        }
      }
      if (!container) container = feedVideos[0];
    }

    const nicknameEl = container.querySelector('[data-e2e="feed-video-nickname"]');
    const descEl = container.querySelector('[data-e2e="video-desc"]');
    const diggEl = container.querySelector('[data-e2e="video-player-digg"]');

    if (!nicknameEl && !descEl) return null;

    let authorProfileUrl = '';
    const avatarLink = container.querySelector('a[href*="/user/"]');
    if (avatarLink) {
      const href = avatarLink.getAttribute('href');
      authorProfileUrl = href.startsWith('http') ? href : `https://www.douyin.com${href}`;
    }

    return {
      nickname: nicknameEl ? nicknameEl.textContent.trim().replace(/^@/, '') : '',
      desc: descEl ? descEl.textContent.trim() : '',
      likes: diggEl ? parseCountText(diggEl.textContent) : 0,
      authorProfileUrl: authorProfileUrl
    };
  }

  function collectPost() {
    const params = new URLSearchParams(window.location.search);
    const postId = extractIdFromUrl('post');
    const postUrl = postId
      ? `https://www.douyin.com/video/${postId}`
      : window.location.href;

    // 所有场景都先尝试 DOM 读取（全屏视频流、搜索模态框、视频直链页）
    const domData = readVideoFromDOM();

    if (domData && (domData.nickname || domData.desc)) {
      console.log('[KOL采集] 抖音: DOM 读取成功', domData);

      chrome.runtime.sendMessage(
        { action: 'savePost', data: {
          id: `douyin_${postId || Date.now()}`,
          platform: '抖音',
          title: (domData.desc || domData.nickname + '的视频').substring(0, 100),
          postUrl: postUrl,
          bloggerName: domData.nickname || '未知',
          bloggerProfileUrl: domData.authorProfileUrl || '',
          bloggerFollowers: 0,
          likes: domData.likes,
          note: '',
          collectedAt: new Date().toISOString()
        }},
        (response) => {
          if (response?.success) {
            showToast(`已采集: ${(domData.desc || '').substring(0, 20)}...`);
          } else {
            showToast('保存失败', true);
          }
        }
      );
    } else {
      // DOM 读取失败，弹出手动表单
      console.log('[KOL采集] 抖音: DOM 读取失败, 切换到手动表单');
      showPostForm({ postUrl, postId });
    }
  }

  // 帖子采集表单
  function showPostForm(autoData) {
    // 移除已有表单
    const existing = document.getElementById('kol-post-form-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'kol-post-form-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: '999999', display: 'flex', alignItems: 'center', justifyContent: 'center'
    });

    const form = document.createElement('div');
    Object.assign(form.style, {
      backgroundColor: '#fff', borderRadius: '16px', padding: '24px',
      width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', fontFamily: '-apple-system, sans-serif'
    });

    form.innerHTML = `
      <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3436">📝 采集帖子</div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">帖子标题 *</label>
        <input id="kol-pf-title" type="text" placeholder="输入视频/帖子标题" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">博主名称 *</label>
        <input id="kol-pf-blogger" type="text" placeholder="输入博主名称" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
      </div>
      <div style="display:flex;gap:12px;margin-bottom:12px">
        <div style="flex:1">
          <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">点赞数</label>
          <input id="kol-pf-likes" type="text" placeholder="0" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
        </div>
        <div style="flex:1">
          <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">博主粉丝数</label>
          <input id="kol-pf-followers" type="text" placeholder="0" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
        </div>
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">帖子链接</label>
        <input id="kol-pf-url" type="text" value="${autoData.postUrl}" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:12px;color:#b2bec3;box-sizing:border-box" readonly>
      </div>
      <div style="display:flex;gap:8px">
        <button id="kol-pf-cancel" style="flex:1;padding:10px;border:1px solid #dfe6e9;border-radius:8px;background:#fff;color:#636e72;font-size:14px;cursor:pointer">取消</button>
        <button id="kol-pf-save" style="flex:1;padding:10px;border:none;border-radius:8px;background:#fe2c55;color:#fff;font-size:14px;font-weight:500;cursor:pointer">保存</button>
      </div>
    `;

    overlay.appendChild(form);
    document.body.appendChild(overlay);

    // 聚焦到标题输入框
    setTimeout(() => document.getElementById('kol-pf-title').focus(), 100);

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // 取消按钮
    document.getElementById('kol-pf-cancel').addEventListener('click', () => overlay.remove());

    // 保存按钮
    document.getElementById('kol-pf-save').addEventListener('click', () => {
      const title = document.getElementById('kol-pf-title').value.trim();
      const blogger = document.getElementById('kol-pf-blogger').value.trim();
      const likes = parseInt(document.getElementById('kol-pf-likes').value.trim() || '0', 10);
      const followers = parseInt(document.getElementById('kol-pf-followers').value.trim() || '0', 10);

      if (!title) {
        document.getElementById('kol-pf-title').style.borderColor = '#e74c3c';
        return;
      }
      if (!blogger) {
        document.getElementById('kol-pf-blogger').style.borderColor = '#e74c3c';
        return;
      }

      const postData = {
        id: `douyin_${autoData.postId || Date.now()}`,
        platform: '抖音',
        title: title.substring(0, 100),
        postUrl: autoData.postUrl,
        bloggerName: blogger,
        bloggerProfileUrl: '',
        bloggerFollowers: followers,
        likes: likes,
        note: '',
        collectedAt: new Date().toISOString()
      };

      chrome.runtime.sendMessage(
        { action: 'savePost', data: postData },
        (response) => {
          overlay.remove();
          if (response?.success) {
            showToast(`已采集: ${title.substring(0, 20)}...`);
          } else {
            showToast('保存失败', true);
          }
        }
      );
    });
  }

  // ========== UI 注入（全局只注册一次点击监听） ==========

  // 全局点击监听：关闭菜单（只注册一次，不会泄漏）
  document.addEventListener('click', (e) => {
    const fab = document.getElementById('kol-collector-fab');
    if (fab && !fab.contains(e.target)) {
      const menu = fab.querySelector('.kol-menu');
      if (menu) menu.style.display = 'none';
    }
  });

  function showToast(message, isError) {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: '999999',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      transition: 'opacity 0.3s',
      backgroundColor: isError ? '#e74c3c' : '#2ecc71'
    });
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function createFloatingButton() {
    const pageType = getPageType();

    // 如果按钮已存在且页面类型仍有效，不重建（防止切换视频时按钮消失）
    const existing = document.getElementById('kol-collector-fab');
    if (existing && pageType !== 'other') return;

    // 页面类型无效时移除已有按钮
    if (existing) existing.remove();
    if (pageType === 'other') return;

    const fab = document.createElement('div');
    fab.id = 'kol-collector-fab';

    const mainBtn = document.createElement('button');
    mainBtn.textContent = '📋';
    Object.assign(mainBtn.style, {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      border: 'none',
      backgroundColor: '#fe2c55',
      color: '#fff',
      fontSize: '20px',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(254,44,85,0.4)',
      transition: 'transform 0.2s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });
    mainBtn.addEventListener('mouseenter', () => mainBtn.style.transform = 'scale(1.1)');
    mainBtn.addEventListener('mouseleave', () => mainBtn.style.transform = 'scale(1)');

    const menu = document.createElement('div');
    menu.className = 'kol-menu';
    Object.assign(menu.style, {
      position: 'absolute',
      bottom: '56px',
      right: '0',
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      display: 'none',
      flexDirection: 'column',
      gap: '6px',
      minWidth: '140px'
    });

    const menuItems = [];

    if (pageType === 'profile') {
      menuItems.push({
        label: '👤 采集博主',
        action: () => {
          collectBlogger();
          menu.style.display = 'none';
        }
      });
    }

    if (pageType === 'post') {
      menuItems.push({
        label: '📝 采集帖子',
        action: () => {
          collectPost();
          menu.style.display = 'none';
        }
      });
    }

    menuItems.forEach(item => {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      Object.assign(btn.style, {
        padding: '10px 16px',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa',
        color: '#2d3436',
        fontSize: '14px',
        cursor: 'pointer',
        textAlign: 'left',
        whiteSpace: 'nowrap',
        transition: 'background-color 0.2s'
      });
      btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#eee');
      btn.addEventListener('mouseleave', () => btn.style.backgroundColor = '#f8f9fa');
      btn.addEventListener('click', item.action);
      menu.appendChild(btn);
    });

    mainBtn.addEventListener('click', () => {
      menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
    });

    fab.appendChild(menu);
    fab.appendChild(mainBtn);

    Object.assign(fab.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '999998',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end'
    });

    document.body.appendChild(fab);
  }

  // ========== SPA 路由监听 + 视频元素检测 ==========

  let lastUrl = '';
  let urlCheckTimer = null;
  let hasButton = false;

  function scheduleFloatingButton() {
    if (urlCheckTimer) clearTimeout(urlCheckTimer);
    urlCheckTimer = setTimeout(() => {
      createFloatingButton();
      hasButton = !!document.getElementById('kol-collector-fab');
    }, 1800);
  }

  function checkChanges() {
    const currentUrl = window.location.href;
    const hasVideo = !!document.querySelector('[data-e2e="feed-video"]');

    // URL 变化 或 页面上出现了视频元素但还没有按钮
    if (currentUrl !== lastUrl || (hasVideo && !hasButton)) {
      lastUrl = currentUrl;
      scheduleFloatingButton();
    }
  }

  const observer = new MutationObserver(checkChanges);
  observer.observe(document.body, { childList: true, subtree: true });

  // 初始注入（抖音加载较慢，延迟稍长）
  setTimeout(createFloatingButton, 2000);

})();
