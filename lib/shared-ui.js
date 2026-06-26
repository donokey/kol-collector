// KOL 采集助手 - 共享 UI 模块
// 提供 toast、表单弹窗、浮动按钮、SPA 路由监听等通用功能
// 由各平台 content script 通过 window.KolUi 调用

(function () {
  'use strict';
  if (window.KolUi) return;

  // ========== Toast ==========

  function showToast(message, isError, color) {
    var toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed', bottom: '80px', right: '20px',
      padding: '12px 20px', borderRadius: '8px', color: '#fff',
      fontSize: '14px', fontWeight: '500', zIndex: '999999',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'opacity 0.3s',
      backgroundColor: isError ? '#e74c3c' : color
    });
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, 2000);
  }

  // ========== 表单基础设施 ==========

  function createOverlay() {
    var overlay = document.createElement('div');
    overlay.id = 'kol-post-form-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: '999999', display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
    return overlay;
  }

  function createFormBox() {
    var form = document.createElement('div');
    Object.assign(form.style, {
      backgroundColor: '#fff', borderRadius: '16px', padding: '24px',
      width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      fontFamily: '-apple-system, sans-serif'
    });
    return form;
  }

  function removeForm() {
    var el = document.getElementById('kol-post-form-overlay');
    if (el) el.remove();
  }

  // ========== 博主表单 ==========

  function showBloggerForm(opts) {
    opts = opts || {};
    removeForm();

    var overlay = createOverlay();
    var form = createFormBox();
    var c = opts.color || '#ff4757';

    form.innerHTML =
      '<div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3436">' +
        '\uD83D\uDC64 \u91C7\u96C6\u535A\u4E3B' + (opts.label ? ' (' + opts.label + ')' : '') +
      '</div>' +
      '<div style="margin-bottom:12px">' +
        '<label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">\u535A\u4E3B\u540D\u79F0 *</label>' +
        '<input id="kol-bf-name" type="text" placeholder="\u8F93\u5165\u535A\u4E3B\u540D\u79F0" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">' +
      '</div>' +
      '<div style="margin-bottom:12px">' +
        '<label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">\u7C89\u4E1D\u6570</label>' +
        '<input id="kol-bf-followers" type="text" value="' + (opts.prefillFollowers || '') + '" placeholder="\u8F93\u5165\u7C89\u4E1D\u6570" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">' +
      '</div>' +
      '<div style="margin-bottom:16px">' +
        '<label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">\u4E3B\u9875\u94FE\u63A5</label>' +
        '<input id="kol-bf-url" type="text" value="' + (opts.prefillUrl || '') + '" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:12px;color:#b2bec3;box-sizing:border-box" readonly>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button id="kol-bf-cancel" style="flex:1;padding:10px;border:1px solid #dfe6e9;border-radius:8px;background:#fff;color:#636e72;font-size:14px;cursor:pointer">\u53D6\u6D88</button>' +
        '<button id="kol-bf-save" style="flex:1;padding:10px;border:none;border-radius:8px;background:' + c + ';color:#fff;font-size:14px;font-weight:500;cursor:pointer">\u4FDD\u5B58</button>' +
      '</div>';

    overlay.appendChild(form);
    document.body.appendChild(overlay);
    setTimeout(function () { var el = document.getElementById('kol-bf-name'); if (el) el.focus(); }, 100);

    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.getElementById('kol-bf-cancel').addEventListener('click', function () { overlay.remove(); });

    document.getElementById('kol-bf-save').addEventListener('click', function () {
      var name = document.getElementById('kol-bf-name').value.trim();
      var followers = parseInt(document.getElementById('kol-bf-followers').value.trim() || '0', 10);
      if (!name) { document.getElementById('kol-bf-name').style.borderColor = '#e74c3c'; return; }

      if (opts.onSave) {
        opts.onSave(overlay, {
          id: opts.autoId || (opts.idPrefix + '_' + Date.now()),
          name: name,
          followers: followers,
          profileUrl: opts.prefillUrl || ''
        });
      } else {
        overlay.remove();
      }
    });
  }

  // ========== 帖子表单 ==========

  function showPostForm(opts) {
    opts = opts || {};
    removeForm();

    var overlay = createOverlay();
    var form = createFormBox();
    var c = opts.color || '#ff4757';
    var titleLabel = opts.titleLabel || '\u5E16\u5B50\u6807\u9898';
    var bloggerLabel = opts.bloggerLabel || '\u535A\u4E3B\u540D\u79F0';

    form.innerHTML =
      '<div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3436">' +
        '\uD83D\uDCDD \u91C7\u96C6' + (opts.label || '\u5E16\u5B50') + (opts.subLabel ? ' (' + opts.subLabel + ')' : '') +
      '</div>' +
      '<div style="margin-bottom:12px">' +
        '<label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">' + titleLabel + ' *</label>' +
        '<input id="kol-pf-title" type="text" placeholder="\u8F93\u5165' + titleLabel + '" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">' +
      '</div>' +
      '<div style="margin-bottom:12px">' +
        '<label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">' + bloggerLabel + ' *</label>' +
        '<input id="kol-pf-blogger" type="text" placeholder="\u8F93\u5165' + bloggerLabel + '" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">' +
      '</div>' +
      '<div style="display:flex;gap:12px;margin-bottom:12px">' +
        '<div style="flex:1">' +
          '<label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">\u70B9\u8D5E\u6570</label>' +
          '<input id="kol-pf-likes" type="text" placeholder="0" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">' +
        '</div>' +
        '<div style="flex:1">' +
          '<label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">' + bloggerLabel + '\u7C89\u4E1D\u6570</label>' +
          '<input id="kol-pf-followers" type="text" placeholder="0" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box">' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:16px">' +
        '<label style="font-size:12px;color:#636e72;display:block;margin-bottom:4px">\u5E16\u5B50\u94FE\u63A5</label>' +
        '<input id="kol-pf-url" type="text" value="' + (opts.prefillUrl || '') + '" style="width:100%;padding:8px 12px;border:1px solid #dfe6e9;border-radius:8px;font-size:12px;color:#b2bec3;box-sizing:border-box" readonly>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button id="kol-pf-cancel" style="flex:1;padding:10px;border:1px solid #dfe6e9;border-radius:8px;background:#fff;color:#636e72;font-size:14px;cursor:pointer">\u53D6\u6D88</button>' +
        '<button id="kol-pf-save" style="flex:1;padding:10px;border:none;border-radius:8px;background:' + c + ';color:#fff;font-size:14px;font-weight:500;cursor:pointer">\u4FDD\u5B58</button>' +
      '</div>';

    overlay.appendChild(form);
    document.body.appendChild(overlay);
    setTimeout(function () { var el = document.getElementById('kol-pf-title'); if (el) el.focus(); }, 100);

    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.getElementById('kol-pf-cancel').addEventListener('click', function () { overlay.remove(); });

    document.getElementById('kol-pf-save').addEventListener('click', function () {
      var title = document.getElementById('kol-pf-title').value.trim();
      var blogger = document.getElementById('kol-pf-blogger').value.trim();
      var likes = parseInt(document.getElementById('kol-pf-likes').value.trim() || '0', 10);
      var followers = parseInt(document.getElementById('kol-pf-followers').value.trim() || '0', 10);
      if (!title) { document.getElementById('kol-pf-title').style.borderColor = '#e74c3c'; return; }
      if (!blogger) { document.getElementById('kol-pf-blogger').style.borderColor = '#e74c3c'; return; }

      if (opts.onSave) {
        opts.onSave(overlay, {
          id: opts.autoId || ('post_' + Date.now()),
          title: title,
          bloggerName: blogger,
          likes: likes,
          followers: followers,
          postUrl: opts.prefillUrl || ''
        });
      } else {
        overlay.remove();
      }
    });
  }

  // ========== 浮动按钮 ==========

  function createFloatingButton(pageType, config, menuActions) {
    var existing = document.getElementById('kol-collector-fab');
    if (existing) existing.remove();
    if (pageType === 'other') return;

    var fab = document.createElement('div');
    fab.id = 'kol-collector-fab';

    var mainBtn = document.createElement('button');
    mainBtn.textContent = '\uD83D\uDCCB';
    Object.assign(mainBtn.style, {
      width: '48px', height: '48px', borderRadius: '50%', border: 'none',
      backgroundColor: config.color, color: '#fff', fontSize: '20px',
      cursor: 'pointer', boxShadow: '0 4px 12px ' + config.color + '66',
      transition: 'transform 0.2s', display: 'flex',
      alignItems: 'center', justifyContent: 'center'
    });
    mainBtn.addEventListener('mouseenter', function () { mainBtn.style.transform = 'scale(1.1)'; });
    mainBtn.addEventListener('mouseleave', function () { mainBtn.style.transform = 'scale(1)'; });

    var menu = document.createElement('div');
    menu.className = 'kol-menu';
    Object.assign(menu.style, {
      position: 'absolute', bottom: '56px', right: '0', backgroundColor: '#fff',
      borderRadius: '12px', padding: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      display: 'none', flexDirection: 'column', gap: '6px', minWidth: '140px'
    });

    menuActions.forEach(function (item) {
      var btn = document.createElement('button');
      btn.textContent = item.label;
      Object.assign(btn.style, {
        padding: '10px 16px', border: 'none', borderRadius: '8px',
        backgroundColor: '#f8f9fa', color: '#2d3436', fontSize: '14px',
        cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
        transition: 'background-color 0.2s'
      });
      btn.addEventListener('mouseenter', function () { btn.style.backgroundColor = '#eee'; });
      btn.addEventListener('mouseleave', function () { btn.style.backgroundColor = '#f8f9fa'; });
      btn.addEventListener('click', function () {
        item.action();
        menu.style.display = 'none';
      });
      menu.appendChild(btn);
    });

    mainBtn.addEventListener('click', function () {
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

  // ========== SPA 路由监听（轮询，替代 MutationObserver） ==========

  function initRouter(createFab) {
    var lastUrl = '';
    var timer = null;

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(createFab, 1200);
    }

    function check() {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        schedule();
      }
    }

    setInterval(check, 500);
    setTimeout(createFab, 1500);
  }

  // 全局点击关闭菜单（只注册一次）
  document.addEventListener('click', function (e) {
    var fab = document.getElementById('kol-collector-fab');
    if (fab && !fab.contains(e.target)) {
      var menu = fab.querySelector('.kol-menu');
      if (menu) menu.style.display = 'none';
    }
  });

  // ========== 导出 ==========

  window.KolUi = {
    showToast: showToast,
    showBloggerForm: showBloggerForm,
    showPostForm: showPostForm,
    createFloatingButton: createFloatingButton,
    initRouter: initRouter
  };
})();
