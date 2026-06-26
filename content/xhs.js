// KOL 采集助手 - 小红书内容脚本
// 数据源：window.__INITIAL_STATE__（Vue SPA 预渲染数据）

(function () {
  'use strict';

  // 防止重复注入
  if (window.__kol_collector_xhs_injected) return;
  window.__kol_collector_xhs_injected = true;

  // ========== 数据桥接（读取 MAIN world 桥接脚本写入的数据） ==========

  // xhs-bridge.js 运行在页面主世界，能访问 window.__INITIAL_STATE__
  // 它将 JSON 数据写入隐藏的 #___kol_xhs_bridge__ 元素
  // 本脚本运行在隔离世界，从该 DOM 元素读取

  function getInitialState() {
    try {
      // 触发刷新信号，让桥接脚本重新读取最新的 __INITIAL_STATE__
      var refreshEl = document.getElementById('__kol_xhs_refresh__');
      if (refreshEl) {
        refreshEl.dataset.tick = Date.now().toString();
      }

      // 读取桥接元素
      var bridge = document.getElementById('__kol_xhs_bridge__');
      if (!bridge || !bridge.textContent || bridge.dataset.ready !== '1') {
        return null;
      }
      return JSON.parse(bridge.textContent);
    } catch (e) {
      console.warn('[KOL采集] 读取桥接数据失败:', e);
      return null;
    }
  }

  // 判断当前页面类型
  function getPageType() {
    const path = window.location.pathname;
    if (/^\/user\/profile\//.test(path)) return 'profile';
    if (/^\/explore\//.test(path) || /^\/discovery\/item\//.test(path)) return 'post';
    return 'other';
  }

  // 从 URL 提取 ID
  function extractIdFromUrl(url, type) {
    if (type === 'profile') {
      const match = url.match(/\/user\/profile\/([^/?]+)/);
      return match ? match[1] : null;
    }
    if (type === 'post') {
      const match = url.match(/\/explore\/([^/?]+)/) || url.match(/\/discovery\/item\/([^/?]+)/);
      return match ? match[1] : null;
    }
    return null;
  }

  // 格式化数字（处理 "1.2万" 这类中文数字）
  function parseCount(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      val = val.trim();
      if (val.includes('万')) {
        return Math.round(parseFloat(val) * 10000);
      }
      const num = parseInt(val, 10);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  // ========== 数据采集 ==========

  function collectBlogger() {
    const state = getInitialState();
    const userId = extractIdFromUrl(window.location.href, 'profile');
    if (!userId) {
      showToast('无法提取用户ID', true);
      return;
    }

    // 尝试从桥接数据中提取
    if (state) {
      const userData = state.user?.userPageData;
      if (userData) {
        const basicInfo = userData.basicInfo || {};
        chrome.runtime.sendMessage(
          { action: 'saveBlogger', data: {
            id: `xhs_${userId}`,
            platform: '小红书',
            name: basicInfo.nickname || '未知',
            profileUrl: `https://www.xiaohongshu.com/user/profile/${userId}`,
            followers: parseCount(basicInfo.fans),
            note: '',
            collectedAt: new Date().toISOString()
          }},
          (response) => {
            if (response?.success) {
              showToast(`已采集博主: ${basicInfo.nickname}`);
            } else {
              showToast('保存失败', true);
            }
          }
        );
        return;
      }
    }

    // 桥接数据不可用，弹出手动表单
    showBloggerForm({
      profileUrl: `https://www.xiaohongshu.com/user/profile/${userId}`
    });
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
        <button id="kol-bf-save" style="flex:1;padding:10px;border:none;border-radius:8px;background:#ff4757;color:#fff;font-size:14px;font-weight:500;cursor:pointer">保存</button>
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

      chrome.runtime.sendMessage(
        { action: 'saveBlogger', data: {
          id: `xhs_${Date.now()}`,
          platform: '小红书',
          name: name,
          profileUrl: autoData.profileUrl || '',
          followers: followers,
          note: '',
          collectedAt: new Date().toISOString()
        }},
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

  function collectPost() {
    const state = getInitialState();
    const noteId = extractIdFromUrl(window.location.href, 'post');
    if (!noteId) {
      showToast('无法提取帖子ID', true);
      return;
    }

    // 尝试从桥接数据中提取
    if (state) {
      const noteData = state.note?.noteDetailMap?.[noteId]?.note;
      if (noteData) {
        const interactInfo = noteData.interactInfo || {};
        const user = noteData.user || {};
        chrome.runtime.sendMessage(
          { action: 'savePost', data: {
            id: `xhs_${noteId}`,
            platform: '小红书',
            title: (noteData.title || noteData.desc || '').substring(0, 100) || '无标题',
            postUrl: window.location.href.split('?')[0],
            bloggerName: user.nickname || '未知',
            bloggerProfileUrl: user.userId
              ? `https://www.xiaohongshu.com/user/profile/${user.userId}`
              : '',
            bloggerFollowers: 0,
            likes: parseCount(interactInfo.likedCount),
            note: '',
            collectedAt: new Date().toISOString()
          }},
          (response) => {
            if (response?.success) {
              showToast(`已采集: ${(noteData.title || noteData.desc || '').substring(0, 20)}...`);
            } else {
              showToast('保存失败', true);
            }
          }
        );
        return;
      }
    }

    // 桥接数据不可用，弹出手动表单
    showPostForm({
      postUrl: window.location.href.split('?')[0],
      postId: noteId
    });
  }

  // 帖子采集表单
  function showPostForm(autoData) {
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
        <input id="kol-pf-title" type="text" placeholder="输入帖子标题" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
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
        <input id="kol-pf-url" type="text" value="${autoData.postUrl || ''}" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:12px;color:#b2bec3;box-sizing:border-box" readonly>
      </div>
      <div style="display:flex;gap:8px">
        <button id="kol-pf-cancel" style="flex:1;padding:10px;border:1px solid #dfe6e9;border-radius:8px;background:#fff;color:#636e72;font-size:14px;cursor:pointer">取消</button>
        <button id="kol-pf-save" style="flex:1;padding:10px;border:none;border-radius:8px;background:#ff4757;color:#fff;font-size:14px;font-weight:500;cursor:pointer">保存</button>
      </div>
    `;

    overlay.appendChild(form);
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('kol-pf-title').focus(), 100);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('kol-pf-cancel').addEventListener('click', () => overlay.remove());

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

      chrome.runtime.sendMessage(
        { action: 'savePost', data: {
          id: `xhs_${autoData.postId || Date.now()}`,
          platform: '小红书',
          title: title.substring(0, 100),
          postUrl: autoData.postUrl || '',
          bloggerName: blogger,
          bloggerProfileUrl: '',
          bloggerFollowers: followers,
          likes: likes,
          note: '',
          collectedAt: new Date().toISOString()
        }},
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
    // 移除已有按钮
    const existing = document.getElementById('kol-collector-fab');
    if (existing) existing.remove();

    const pageType = getPageType();
    if (pageType === 'other') return;

    const fab = document.createElement('div');
    fab.id = 'kol-collector-fab';

    // 主按钮
    const mainBtn = document.createElement('button');
    mainBtn.textContent = '📋';
    Object.assign(mainBtn.style, {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      border: 'none',
      backgroundColor: '#ff4757',
      color: '#fff',
      fontSize: '20px',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(255,71,87,0.4)',
      transition: 'transform 0.2s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });
    mainBtn.addEventListener('mouseenter', () => mainBtn.style.transform = 'scale(1.1)');
    mainBtn.addEventListener('mouseleave', () => mainBtn.style.transform = 'scale(1)');

    // 菜单面板
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

  // ========== SPA 路由监听（带防抖） ==========

  let lastUrl = '';
  let urlCheckTimer = null;

  function scheduleFloatingButton() {
    if (urlCheckTimer) clearTimeout(urlCheckTimer);
    urlCheckTimer = setTimeout(createFloatingButton, 1200);
  }

  function checkUrlChange() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      scheduleFloatingButton();
    }
  }

  const observer = new MutationObserver(checkUrlChange);
  observer.observe(document.body, { childList: true, subtree: true });

  // 初始注入
  setTimeout(createFloatingButton, 1500);

})();
