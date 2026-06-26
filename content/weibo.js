// KOL 采集助手 - 微博内容脚本
// 支持 weibo.com 和 m.weibo.cn
// 数据获取：优先从页面 $render_data / API 提取，失败则弹表单

(function () {
  'use strict';

  console.log('[KOL采集] 微博 content script 已加载, URL:', window.location.href);

  if (window.__kol_collector_weibo_injected) return;
  window.__kol_collector_weibo_injected = true;

  // ========== 工具函数 ==========

  function getPageType() {
    const host = window.location.hostname;
    const path = window.location.pathname;

    // m.weibo.cn
    if (host === 'm.weibo.cn') {
      if (/^\/u\/\d+/.test(path) || /^\/profile\/\d+/.test(path)) return 'profile';
      if (/^\/detail\/\d+/.test(path) || /^\/status\/\w+/.test(path)) return 'post';
      return 'other';
    }

    // weibo.com
    if (host.includes('weibo.com')) {
      // /u/{uid} → profile
      if (/^\/u\/\d+/.test(path)) return 'profile';
      // /{uid}/{postId} → post (postId is alphanumeric, often starts with a letter)
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 2 && /^\d{6,}$/.test(parts[0]) && /^[\w]{8,}$/.test(parts[1])) return 'post';
      if (parts.length === 1 && /^\d{6,}$/.test(parts[0])) return 'profile';
    }

    return 'other';
  }

  function extractIdFromUrl(type) {
    const path = window.location.pathname;
    if (type === 'profile') {
      const match = path.match(/\/u\/(\d+)/) || path.match(/^\/(\d{6,})/);
      return match ? match[1] : null;
    }
    if (type === 'post') {
      // m.weibo.cn/detail/{id} 或 m.weibo.cn/status/{id}
      const detailMatch = path.match(/\/detail\/(\w+)/) || path.match(/\/status\/(\w+)/);
      if (detailMatch) return detailMatch[1];
      // weibo.com/{uid}/{postId} — postId 可以是字母+数字
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 2) return parts[1];
    }
    return null;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  // ========== 数据采集 ==========

  // 博主采集
  function collectBlogger() {
    const uid = extractIdFromUrl('profile');
    if (!uid) {
      showBloggerForm({});
      return;
    }

    // 尝试从移动端 API 获取用户信息
    fetchJson(`https://m.weibo.cn/api/container/getIndex?type=uid&value=${uid}`)
      .then(data => {
        if (data.ok === 1 && data.data && data.data.userInfo) {
          const info = data.data.userInfo;
          saveBloggerData(uid, info.screen_name, info.followers_count);
        } else {
          console.warn('[KOL采集] 微博博主API返回异常:', data);
          showBloggerForm({ uid, profileUrl: `https://weibo.com/u/${uid}` });
        }
      })
      .catch(err => {
        console.warn('[KOL采集] 微博博主API失败:', err);
        showBloggerForm({ uid, profileUrl: `https://weibo.com/u/${uid}` });
      });
  }

  function saveBloggerData(uid, name, followers) {
    chrome.runtime.sendMessage(
      { action: 'saveBlogger', data: {
        id: `weibo_${uid}`,
        platform: '微博',
        name: name || '未知',
        profileUrl: `https://weibo.com/u/${uid}`,
        followers: followers || 0,
        note: '',
        collectedAt: new Date().toISOString()
      }},
      (response) => {
        if (response?.success) {
          showToast(`已采集博主: ${name}`);
        } else {
          showToast('保存失败', true);
        }
      }
    );
  }

  // 帖子采集
  function collectPost() {
    const postId = extractIdFromUrl('post');
    if (!postId) {
      showPostForm({});
      return;
    }

    // 尝试从移动端 API 获取帖子信息
    fetchJson(`https://m.weibo.cn/statuses/show?id=${postId}`)
      .then(data => {
        if (data.ok === 1 && data.data) {
          const post = data.data;
          const user = post.user || {};
          chrome.runtime.sendMessage(
            { action: 'savePost', data: {
              id: `weibo_${postId}`,
              platform: '微博',
              title: (post.text || '').replace(/<[^>]*>/g, '').substring(0, 100) || '无标题',
              postUrl: `https://m.weibo.cn/detail/${postId}`,
              bloggerName: user.screen_name || '未知',
              bloggerProfileUrl: user.id ? `https://weibo.com/u/${user.id}` : '',
              bloggerFollowers: user.followers_count || 0,
              likes: post.attitudes_count || 0,
              note: '',
              collectedAt: new Date().toISOString()
            }},
            (response) => {
              if (response?.success) {
                showToast(`已采集: ${(post.text || '').replace(/<[^>]*>/g, '').substring(0, 20)}...`);
              } else {
                showToast('保存失败', true);
              }
            }
          );
        } else {
          console.warn('[KOL采集] 微博帖子API返回异常:', data);
          showPostForm({ postId, postUrl: `https://m.weibo.cn/detail/${postId}` });
        }
      })
      .catch(err => {
        console.warn('[KOL采集] 微博帖子API失败:', err);
        showPostForm({ postId, postUrl: `https://m.weibo.cn/detail/${postId}` });
      });
  }

  // ========== 手动表单 ==========

  function showBloggerForm(autoData) {
    removeForm();
    const overlay = createOverlay();
    const form = createFormBox();
    form.innerHTML = `
      <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3436">👤 采集博主 (微博)</div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">博主名称 *</label>
        <input id="kol-bf-name" type="text" placeholder="输入博主名称" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">粉丝数</label>
        <input id="kol-bf-followers" type="text" value="${autoData.followers || ''}" placeholder="输入粉丝数" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">主页链接</label>
        <input id="kol-bf-url" type="text" value="${autoData.profileUrl || ''}" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:12px;color:#b2bec3;box-sizing:border-box" readonly>
      </div>
      <div style="display:flex;gap:8px">
        <button id="kol-bf-cancel" style="flex:1;padding:10px;border:1px solid #dfe6e9;border-radius:8px;background:#fff;color:#636e72;font-size:14px;cursor:pointer">取消</button>
        <button id="kol-bf-save" style="flex:1;padding:10px;border:none;border-radius:8px;background:#e6162d;color:#fff;font-size:14px;font-weight:500;cursor:pointer">保存</button>
      </div>
    `;

    overlay.appendChild(form);
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('kol-bf-name')?.focus(), 100);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('kol-bf-cancel').addEventListener('click', () => overlay.remove());

    document.getElementById('kol-bf-save').addEventListener('click', () => {
      const name = document.getElementById('kol-bf-name').value.trim();
      const followers = parseInt(document.getElementById('kol-bf-followers').value.trim() || '0', 10);
      if (!name) { document.getElementById('kol-bf-name').style.borderColor = '#e74c3c'; return; }

      chrome.runtime.sendMessage(
        { action: 'saveBlogger', data: {
          id: `weibo_${autoData.uid || Date.now()}`,
          platform: '微博', name, profileUrl: autoData.profileUrl || '',
          followers, note: '', collectedAt: new Date().toISOString()
        }},
        (response) => {
          overlay.remove();
          showToast(response?.success ? `已采集博主: ${name}` : '保存失败', !response?.success);
        }
      );
    });
  }

  function showPostForm(autoData) {
    removeForm();
    const overlay = createOverlay();
    const form = createFormBox();
    form.innerHTML = `
      <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3436">📝 采集博文 (微博)</div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">博文内容摘要 *</label>
        <input id="kol-pf-title" type="text" placeholder="输入博文前几个字" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
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
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">博文链接</label>
        <input id="kol-pf-url" type="text" value="${autoData.postUrl || ''}" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:12px;color:#b2bec3;box-sizing:border-box" readonly>
      </div>
      <div style="display:flex;gap:8px">
        <button id="kol-pf-cancel" style="flex:1;padding:10px;border:1px solid #dfe6e9;border-radius:8px;background:#fff;color:#636e72;font-size:14px;cursor:pointer">取消</button>
        <button id="kol-pf-save" style="flex:1;padding:10px;border:none;border-radius:8px;background:#e6162d;color:#fff;font-size:14px;font-weight:500;cursor:pointer">保存</button>
      </div>
    `;

    overlay.appendChild(form);
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('kol-pf-title')?.focus(), 100);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('kol-pf-cancel').addEventListener('click', () => overlay.remove());

    document.getElementById('kol-pf-save').addEventListener('click', () => {
      const title = document.getElementById('kol-pf-title').value.trim();
      const blogger = document.getElementById('kol-pf-blogger').value.trim();
      const likes = parseInt(document.getElementById('kol-pf-likes').value.trim() || '0', 10);
      const followers = parseInt(document.getElementById('kol-pf-followers').value.trim() || '0', 10);
      if (!title) { document.getElementById('kol-pf-title').style.borderColor = '#e74c3c'; return; }
      if (!blogger) { document.getElementById('kol-pf-blogger').style.borderColor = '#e74c3c'; return; }

      chrome.runtime.sendMessage(
        { action: 'savePost', data: {
          id: `weibo_${autoData.postId || Date.now()}`,
          platform: '微博', title: title.substring(0, 100),
          postUrl: autoData.postUrl || '', bloggerName: blogger,
          bloggerProfileUrl: '', bloggerFollowers: followers, likes,
          note: '', collectedAt: new Date().toISOString()
        }},
        (response) => {
          overlay.remove();
          showToast(response?.success ? `已采集: ${title.substring(0, 20)}...` : '保存失败', !response?.success);
        }
      );
    });
  }

  function removeForm() {
    const existing = document.getElementById('kol-post-form-overlay');
    if (existing) existing.remove();
  }

  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'kol-post-form-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: '999999', display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
    return overlay;
  }

  function createFormBox() {
    const form = document.createElement('div');
    Object.assign(form.style, {
      backgroundColor: '#fff', borderRadius: '16px', padding: '24px',
      width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', fontFamily: '-apple-system, sans-serif'
    });
    return form;
  }

  // ========== UI ==========

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
      position: 'fixed', bottom: '80px', right: '20px',
      padding: '12px 20px', borderRadius: '8px', color: '#fff',
      fontSize: '14px', fontWeight: '500', zIndex: '999999',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'opacity 0.3s',
      backgroundColor: isError ? '#e74c3c' : '#e6162d'
    });
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
  }

  function createFloatingButton() {
    const existing = document.getElementById('kol-collector-fab');
    if (existing) existing.remove();

    const pageType = getPageType();
    if (pageType === 'other') return;

    const fab = document.createElement('div');
    fab.id = 'kol-collector-fab';

    const mainBtn = document.createElement('button');
    mainBtn.textContent = '📋';
    Object.assign(mainBtn.style, {
      width: '48px', height: '48px', borderRadius: '50%', border: 'none',
      backgroundColor: '#e6162d', color: '#fff', fontSize: '20px', cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(230,22,45,0.4)', transition: 'transform 0.2s',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
    mainBtn.addEventListener('mouseenter', () => mainBtn.style.transform = 'scale(1.1)');
    mainBtn.addEventListener('mouseleave', () => mainBtn.style.transform = 'scale(1)');

    const menu = document.createElement('div');
    menu.className = 'kol-menu';
    Object.assign(menu.style, {
      position: 'absolute', bottom: '56px', right: '0', backgroundColor: '#fff',
      borderRadius: '12px', padding: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      display: 'none', flexDirection: 'column', gap: '6px', minWidth: '140px'
    });

    const menuItems = [];
    if (pageType === 'profile') {
      menuItems.push({ label: '👤 采集博主', action: () => { collectBlogger(); menu.style.display = 'none'; } });
      menuItems.push({ label: '📝 采集博文', action: () => { showPostForm({}); menu.style.display = 'none'; } });
    }
    if (pageType === 'post') {
      menuItems.push({ label: '📝 采集博文', action: () => { collectPost(); menu.style.display = 'none'; } });
    }

    menuItems.forEach(item => {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      Object.assign(btn.style, {
        padding: '10px 16px', border: 'none', borderRadius: '8px',
        backgroundColor: '#f8f9fa', color: '#2d3436', fontSize: '14px',
        cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
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
      position: 'fixed', bottom: '20px', right: '20px', zIndex: '999998',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end'
    });
    document.body.appendChild(fab);
  }

  // ========== SPA 路由监听 ==========
  let lastUrl = '';
  let urlCheckTimer = null;

  function scheduleFloatingButton() {
    if (urlCheckTimer) clearTimeout(urlCheckTimer);
    urlCheckTimer = setTimeout(createFloatingButton, 1500);
  }

  function checkUrlChange() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      scheduleFloatingButton();
    }
  }

  const observer = new MutationObserver(checkUrlChange);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(createFloatingButton, 1500);

})();
