// KOL 采集助手 - Popup 面板逻辑

document.addEventListener('DOMContentLoaded', () => {
  let allData = { bloggers: [], posts: [] };
  let currentTab = 'bloggers';
  let editingItem = null; // { type, id }

  // ========== DOM 元素 ==========
  const bloggerCountEl = document.getElementById('blogger-count');
  const postCountEl = document.getElementById('post-count');
  const bloggerListEl = document.getElementById('blogger-list');
  const postListEl = document.getElementById('post-list');
  const noteModal = document.getElementById('note-modal');
  const noteInput = document.getElementById('note-input');

  // ========== 初始化 ==========
  loadData();

  // Tab 切换
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      switchTab(target);
    });
  });

  // 导出按钮
  document.getElementById('btn-export-xlsx').addEventListener('click', exportXlsx);
  document.getElementById('btn-export-json').addEventListener('click', exportJson);
  document.getElementById('btn-clear').addEventListener('click', clearAll);

  // 备注弹窗
  document.getElementById('modal-close').addEventListener('click', closeNoteModal);
  document.getElementById('modal-save').addEventListener('click', saveNote);
  noteModal.addEventListener('click', (e) => {
    if (e.target === noteModal) closeNoteModal();
  });

  // ========== 数据加载 ==========
  function loadData() {
    chrome.runtime.sendMessage({ action: 'getAllData' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[KOL采集] 加载数据失败:', chrome.runtime.lastError.message);
        return;
      }
      if (response?.success) {
        allData = response;
        render();
      }
    });
  }

  // ========== Tab 切换 ==========
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`panel-${tab}`).classList.add('active');
  }

  // ========== 渲染 ==========
  function render() {
    // 更新计数
    bloggerCountEl.textContent = allData.bloggers.length;
    postCountEl.textContent = allData.posts.length;

    // 渲染博主列表
    renderBloggers();

    // 渲染帖子列表
    renderPosts();
  }

  function renderBloggers() {
    if (allData.bloggers.length === 0) {
      bloggerListEl.innerHTML = '<div class="empty-state">暂无采集数据<br>去小红书/抖音/B站/微博博主主页点击 📋 按钮采集</div>';
      return;
    }

    bloggerListEl.innerHTML = allData.bloggers.map(b => `
      <div class="item-card" data-id="${escapeHtml(b.id)}" data-type="blogger">
        <div class="item-header">
          <span class="item-name">${escapeHtml(b.name)}</span>
          <span class="item-platform platform-${getPlatformClass(b.platform)}">${escapeHtml(b.platform)}</span>
        </div>
        <div class="item-meta">
          <span>粉丝: ${formatNumber(b.followers)}</span>
          <span>${formatTime(b.collectedAt)}</span>
        </div>
        ${b.note ? `<div class="item-note has-content">${escapeHtml(b.note)}</div>` : ''}
        <div class="item-actions">
          <button class="btn-edit" data-action="edit" data-id="${escapeHtml(b.id)}" data-type="blogger" data-note="${escapeHtml(b.note || '')}">编辑备注</button>
          <button class="btn-open" data-action="open" data-url="${escapeHtml(b.profileUrl)}">打开主页</button>
          <button class="btn-delete" data-action="delete" data-id="${escapeHtml(b.id)}" data-type="blogger">删除</button>
        </div>
      </div>
    `).join('');
  }

  function renderPosts() {
    if (allData.posts.length === 0) {
      postListEl.innerHTML = '<div class="empty-state">暂无采集数据<br>去小红书/抖音/B站/微博帖子页点击 📋 按钮采集</div>';
      return;
    }

    postListEl.innerHTML = allData.posts.map(p => `
      <div class="item-card" data-id="${escapeHtml(p.id)}" data-type="post">
        <div class="item-header">
          <span class="item-name">${escapeHtml(p.title.substring(0, 30))}${p.title.length > 30 ? '...' : ''}</span>
          <span class="item-platform platform-${getPlatformClass(p.platform)}">${escapeHtml(p.platform)}</span>
        </div>
        <div class="item-meta">
          <span>博主: ${escapeHtml(p.bloggerName)}</span>
          <span>点赞: ${formatNumber(p.likes)}</span>
        </div>
        <div class="item-meta">
          <span>${formatTime(p.collectedAt)}</span>
        </div>
        ${p.note ? `<div class="item-note has-content">${escapeHtml(p.note)}</div>` : ''}
        <div class="item-actions">
          <button class="btn-edit" data-action="edit" data-id="${escapeHtml(p.id)}" data-type="post" data-note="${escapeHtml(p.note || '')}">编辑备注</button>
          <button class="btn-open" data-action="open" data-url="${escapeHtml(p.postUrl)}">查看帖子</button>
          <button class="btn-delete" data-action="delete" data-id="${escapeHtml(p.id)}" data-type="post">删除</button>
        </div>
      </div>
    `).join('');
  }

  // ========== 事件委托：处理列表中的按钮点击 ==========
  function handleListClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const type = btn.dataset.type;

    switch (action) {
      case 'edit':
        openNoteModal(type, id, btn.dataset.note || '');
        break;
      case 'open':
        if (btn.dataset.url) chrome.tabs.create({ url: btn.dataset.url });
        break;
      case 'delete':
        deleteItem(type, id);
        break;
    }
  }

  bloggerListEl.addEventListener('click', handleListClick);
  postListEl.addEventListener('click', handleListClick);

  // ========== 备注编辑 ==========
  function openNoteModal(type, id, currentNote) {
    editingItem = { type, id };
    noteInput.value = currentNote;
    noteModal.classList.add('active');
    noteInput.focus();
  }

  function closeNoteModal() {
    noteModal.classList.remove('active');
    editingItem = null;
  }

  function saveNote() {
    if (!editingItem) return;
    const note = noteInput.value.trim();

    chrome.runtime.sendMessage(
      { action: 'updateNote', type: editingItem.type, id: editingItem.id, note },
      (response) => {
        if (response?.success) {
          // 更新本地数据
          const key = editingItem.type === 'blogger' ? 'bloggers' : 'posts';
          const item = allData[key].find(i => i.id === editingItem.id);
          if (item) item.note = note;
          render();
          closeNoteModal();
        }
      }
    );
  }

  // ========== 删除 ==========
  function deleteItem(type, id) {
    if (!confirm('确定删除这条记录？')) return;

    chrome.runtime.sendMessage(
      { action: 'deleteItem', type, id },
      (response) => {
        if (response?.success) {
          const key = type === 'blogger' ? 'bloggers' : 'posts';
          allData[key] = allData[key].filter(i => i.id !== id);
          render();
        }
      }
    );
  }

  // ========== 清空 ==========
  function clearAll() {
    if (!confirm('确定清空所有采集数据？此操作不可撤销。')) return;

    chrome.runtime.sendMessage({ action: 'clearAll' }, (response) => {
      if (response?.success) {
        allData = { bloggers: [], posts: [] };
        render();
      }
    });
  }

  // ========== 导出 Excel ==========
  function exportXlsx() {
    if (allData.bloggers.length === 0 && allData.posts.length === 0) {
      alert('没有数据可导出');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: 博主库
    if (allData.bloggers.length > 0) {
      const bloggerRows = allData.bloggers.map(b => ({
        '平台': b.platform,
        '博主名称': b.name,
        '主页链接': b.profileUrl,
        '粉丝数': b.followers,
        '备注': b.note,
        '采集时间': new Date(b.collectedAt).toLocaleString('zh-CN')
      }));
      const ws1 = XLSX.utils.json_to_sheet(bloggerRows);
      // 设置列宽
      ws1['!cols'] = [
        { wch: 8 }, { wch: 16 }, { wch: 40 }, { wch: 10 }, { wch: 20 }, { wch: 18 }
      ];
      XLSX.utils.book_append_sheet(wb, ws1, '博主库');
    }

    // Sheet 2: 帖子收藏
    if (allData.posts.length > 0) {
      const postRows = allData.posts.map(p => ({
        '平台': p.platform,
        '帖子标题': p.title,
        '帖子链接': p.postUrl,
        '博主名称': p.bloggerName,
        '博主主页链接': p.bloggerProfileUrl,
        '博主粉丝数': p.bloggerFollowers,
        '点赞数': p.likes,
        '备注': p.note,
        '采集时间': new Date(p.collectedAt).toLocaleString('zh-CN')
      }));
      const ws2 = XLSX.utils.json_to_sheet(postRows);
      ws2['!cols'] = [
        { wch: 8 }, { wch: 30 }, { wch: 40 }, { wch: 16 }, { wch: 40 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 18 }
      ];
      XLSX.utils.book_append_sheet(wb, ws2, '帖子收藏');
    }

    // 下载
    const filename = `KOL采集_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  // ========== 导出 JSON ==========
  function exportJson() {
    if (allData.bloggers.length === 0 && allData.posts.length === 0) {
      alert('没有数据可导出');
      return;
    }

    const data = JSON.stringify(allData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KOL采集_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ========== 工具函数 ==========
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getPlatformClass(platform) {
    if (platform === '小红书') return 'xhs';
    if (platform === '抖音') return 'douyin';
    if (platform === 'B站') return 'bilibili';
    if (platform === '微博') return 'weibo';
    return 'douyin';
  }

  function formatNumber(num) {
    if (!num) return '0';
    if (num >= 10000) return (num / 10000).toFixed(1) + '万';
    return num.toLocaleString();
  }

  function formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
});
