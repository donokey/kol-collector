// KOL 采集助手 - B站内容脚本
// B站数据可通过API获取：
//   博主粉丝: api.bilibili.com/x/relation/stat?vmid={mid}
//   视频详情: api.bilibili.com/x/web-interface/view?bvid={bvid}

(function () {
  'use strict';

  console.log('[KOL采集] B站 content script 已加载, URL:', window.location.href);

  if (window.__kol_collector_bilibili_injected) return;
  window.__kol_collector_bilibili_injected = true;

  // ========== 工具函数 ==========

  function getPageType() {
    const path = window.location.pathname;
    const host = window.location.hostname;

    // space.bilibili.com/{mid} → 博主主页
    if (host.includes('space.bilibili.com') && /^\/\d+/.test(path)) return 'profile';

    // bilibili.com/video/{bvid} → 视频页
    if (/^\/video\/(BV[\w]+|av\d+)/i.test(path)) return 'post';

    return 'other';
  }

  function extractIdFromUrl(type) {
    const path = window.location.pathname;
    if (type === 'profile') {
      const match = path.match(/^\/(\d+)/);
      return match ? match[1] : null;
    }
    if (type === 'post') {
      const match = path.match(/^\/video\/(BV[\w]+|av\d+)/i);
      return match ? match[1] : null;
    }
    return null;
  }

  function formatFollowers(num) {
    if (num >= 10000) return (num / 10000).toFixed(1) + '万';
    return num.toLocaleString();
  }

  // ========== API 数据采集 ==========

  async function fetchJson(url) {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  // 采集博主
  function collectBlogger() {
    const mid = extractIdFromUrl('profile');
    if (!mid) {
      showBloggerForm({});
      return;
    }

    // 通过 B站 API 获取粉丝数（免认证）
    fetchJson(`https://api.bilibili.com/x/relation/stat?vmid=${mid}`)
      .then(data => {
        if (data.code === 0 && data.data) {
          const follower = data.data.follower || 0;

          // 尝试从页面获取博主名称
          // 页面 title 通常是 "个人空间-{name}的个人空间-B站"
          const title = document.title || '';
          const nameMatch = title.match(/个人空间-(.+?)的个人空间/) || title.match(/^(.+?)的个人空间/);
          const name = nameMatch ? nameMatch[1] : '';

          // 如果 title 没拿到名字，尝试从页面 DOM 读取
          if (!name) {
            const nameEl = document.querySelector('#h-name') ||
                           document.querySelector('.h-name') ||
                           document.querySelector('[class*="nickname"]');
            const domName = nameEl ? nameEl.textContent.trim() : '';

            if (domName) {
              saveBloggerData(mid, domName, follower);
            } else {
              // 名字没拿到，弹表单让用户填名字
              showBloggerForm({
                mid,
                followers: follower,
                profileUrl: `https://space.bilibili.com/${mid}`
              });
            }
          } else {
            saveBloggerData(mid, name, follower);
          }
        } else {
          showBloggerForm({ mid, profileUrl: `https://space.bilibili.com/${mid}` });
        }
      })
      .catch(err => {
        console.warn('[KOL采集] B站博主API失败:', err);
        showBloggerForm({ mid, profileUrl: `https://space.bilibili.com/${mid}` });
      });
  }

  function saveBloggerData(mid, name, followers) {
    chrome.runtime.sendMessage(
      { action: 'saveBlogger', data: {
        id: `bilibili_${mid}`,
        platform: 'B站',
        name: name,
        profileUrl: `https://space.bilibili.com/${mid}`,
        followers: followers,
        note: '',
        collectedAt: new Date().toISOString()
      }},
      (response) => {
        if (response?.success) {
          showToast(`已采集博主: ${name} (粉丝: ${formatFollowers(followers)})`);
        } else {
          showToast('保存失败', true);
        }
      }
    );
  }

  // 采集视频
  function collectPost() {
    const bvid = extractIdFromUrl('post');
    if (!bvid) {
      showPostForm({});
      return;
    }

    // 通过 B站 API 获取视频详情
    fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`)
      .then(async data => {
        if (data.code === 0 && data.data) {
          const video = data.data;
          const stat = video.stat || {};
          const owner = video.owner || {};

          // 二次请求：获取UP主粉丝数
          let bloggerFollowers = 0;
          if (owner.mid) {
            try {
              const userData = await fetchJson(`https://api.bilibili.com/x/relation/stat?vmid=${owner.mid}`);
              if (userData.code === 0 && userData.data) {
                bloggerFollowers = userData.data.follower || 0;
              }
            } catch (e) {
              console.warn('[KOL采集] B站获取UP主粉丝数失败:', e);
            }
          }

          chrome.runtime.sendMessage(
            { action: 'savePost', data: {
              id: `bilibili_${bvid}`,
              platform: 'B站',
              title: (video.title || '无标题').substring(0, 100),
              postUrl: `https://www.bilibili.com/video/${bvid}`,
              bloggerName: owner.name || '未知',
              bloggerProfileUrl: owner.mid ? `https://space.bilibili.com/${owner.mid}` : '',
              bloggerFollowers: bloggerFollowers,
              likes: stat.like || 0,
              note: '',
              collectedAt: new Date().toISOString()
            }},
            (response) => {
              if (response?.success) {
                const fansText = bloggerFollowers > 0 ? ` (粉丝: ${formatFollowers(bloggerFollowers)})` : '';
                showToast(`已采集: ${video.title.substring(0, 20)}...${fansText}`);
              } else {
                showToast('保存失败', true);
              }
            }
          );
        } else {
          console.warn('[KOL采集] B站视频API返回:', data.code, data.message);
          showPostForm({ bvid, postUrl: `https://www.bilibili.com/video/${bvid}` });
        }
      })
      .catch(err => {
        console.warn('[KOL采集] B站视频API失败:', err);
        showPostForm({ bvid, postUrl: `https://www.bilibili.com/video/${bvid}` });
      });
  }

  // ========== 手动表单 ==========

  function showBloggerForm(autoData) {
    removeForm();

    const overlay = createOverlay();
    const form = createFormBox();
    form.innerHTML = `
      <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3436">👤 采集博主 (B站)</div>
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
        <button id="kol-bf-save" style="flex:1;padding:10px;border:none;border-radius:8px;background:#00a1d6;color:#fff;font-size:14px;font-weight:500;cursor:pointer">保存</button>
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
          id: `bilibili_${autoData.mid || Date.now()}`,
          platform: 'B站',
          name, profileUrl: autoData.profileUrl || '', followers,
          note: '', collectedAt: new Date().toISOString()
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
      <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3436">📝 采集视频 (B站)</div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">视频标题 *</label>
        <input id="kol-pf-title" type="text" placeholder="输入视频标题" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">UP主名称 *</label>
        <input id="kol-pf-blogger" type="text" placeholder="输入UP主名称" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
      </div>
      <div style="display:flex;gap:12px;margin-bottom:12px">
        <div style="flex:1">
          <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">点赞数</label>
          <input id="kol-pf-likes" type="text" placeholder="0" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
        </div>
        <div style="flex:1">
          <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">UP主粉丝数</label>
          <input id="kol-pf-followers" type="text" placeholder="0" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">
        </div>
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">视频链接</label>
        <input id="kol-pf-url" type="text" value="${autoData.postUrl || ''}" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:12px;color:#b2bec3;box-sizing:border-box" readonly>
      </div>
      <div style="display:flex;gap:8px">
        <button id="kol-pf-cancel" style="flex:1;padding:10px;border:1px solid #dfe6e9;border-radius:8px;background:#fff;color:#636e72;font-size:14px;cursor:pointer">取消</button>
        <button id="kol-pf-save" style="flex:1;padding:10px;border:none;border-radius:8px;background:#00a1d6;color:#fff;font-size:14px;font-weight:500;cursor:pointer">保存</button>
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
          id: `bilibili_${autoData.bvid || Date.now()}`,
          platform: 'B站', title: title.substring(0, 100),
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
      backgroundColor: isError ? '#e74c3c' : '#00a1d6'
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
      backgroundColor: '#00a1d6', color: '#fff', fontSize: '20px', cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,161,214,0.4)', transition: 'transform 0.2s',
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
      menuItems.push({
        label: '👤 采集博主',
        action: () => { collectBlogger(); menu.style.display = 'none'; }
      });
    }

    if (pageType === 'post') {
      menuItems.push({
        label: '📝 采集视频',
        action: () => { collectPost(); menu.style.display = 'none'; }
      });
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
