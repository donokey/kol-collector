// KOL 采集助手 - 共享 UI 模块 (macOS 极简白风格)
// 提供 toast、表单弹窗、浮动按钮、SPA 路由监听等通用功能
// 由各平台 content script 通过 window.KolUi 调用

(function () {
  'use strict';
  if (window.KolUi) return;

  var FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "PingFang SC", sans-serif';

  // ========== Toast ==========

  function showToast(message, isError) {
    var toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed', bottom: '80px', right: '20px',
      padding: '10px 18px', borderRadius: '10px',
      color: isError ? '#FF3B30' : '#1D1D1F',
      fontSize: '13px', fontWeight: '500', fontFamily: FONT,
      zIndex: '999999',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1), 0 0 0 0.5px rgba(0,0,0,0.05)',
      transition: 'opacity 0.3s ease',
      backgroundColor: '#FFFFFF',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      maxWidth: '280px', lineHeight: '1.4'
    });
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, 2500);
  }

  // ========== 表单基础设施 ==========

  function createOverlay() {
    var overlay = document.createElement('div');
    overlay.id = 'kol-post-form-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0',
      backgroundColor: 'rgba(0,0,0,0.15)',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      zIndex: '999999',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
    return overlay;
  }

  function createFormBox() {
    var form = document.createElement('div');
    Object.assign(form.style, {
      backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '24px',
      width: '340px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)',
      fontFamily: FONT
    });
    return form;
  }

  function removeForm() {
    var el = document.getElementById('kol-post-form-overlay');
    if (el) el.remove();
  }

  var INPUT_CSS = 'width:100%;padding:9px 12px;border:0.5px solid #D2D2D7;border-radius:8px;font-size:13px;box-sizing:border-box;font-family:' + FONT + ';color:#1D1D1F;background:#F5F5F7;outline:none;transition:border-color 0.15s,background 0.15s';
  var LABEL_CSS = 'font-size:12px;color:#86868B;display:block;margin-bottom:5px;font-weight:500';
  var BTN_PRIMARY = 'flex:1;padding:10px;border:none;border-radius:8px;background:#007AFF;color:#FFFFFF;font-size:13px;font-weight:500;cursor:pointer;font-family:' + FONT + ';transition:background 0.15s';
  var BTN_CANCEL = 'flex:1;padding:10px;border:0.5px solid #D2D2D7;border-radius:8px;background:#FFFFFF;color:#1D1D1F;font-size:13px;font-weight:500;cursor:pointer;font-family:' + FONT + ';transition:background 0.15s';

  function addInputFocus(form) {
    form.querySelectorAll('input:not([readonly])').forEach(function (inp) {
      inp.addEventListener('focus', function () { this.style.borderColor = '#007AFF'; this.style.background = '#FFFFFF'; });
      inp.addEventListener('blur', function () { this.style.borderColor = '#D2D2D7'; this.style.background = '#F5F5F7'; });
    });
  }

  function addBtnHover(btnId, hoverBg, normalBg) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('mouseenter', function () { this.style.background = hoverBg; });
    btn.addEventListener('mouseleave', function () { this.style.background = normalBg; });
  }

  // ========== 博主表单 ==========

  function showBloggerForm(opts) {
    opts = opts || {};
    removeForm();

    var overlay = createOverlay();
    var form = createFormBox();

    form.innerHTML =
      '<div style="font-size:15px;font-weight:600;margin-bottom:18px;color:#1D1D1F;letter-spacing:-0.2px">' +
        '\uD83D\uDC64 \u91C7\u96C6\u535A\u4E3B' + (opts.label ? ' <span style="font-weight:400;color:#86868B;font-size:12px">' + opts.label + '</span>' : '') +
      '</div>' +
      '<div style="margin-bottom:14px">' +
        '<label style="' + LABEL_CSS + '">\u535A\u4E3B\u540D\u79F0 *</label>' +
        '<input id="kol-bf-name" type="text" placeholder="\u8F93\u5165\u535A\u4E3B\u540D\u79F0" style="' + INPUT_CSS + '">' +
      '</div>' +
      '<div style="margin-bottom:14px">' +
        '<label style="' + LABEL_CSS + '">\u7C89\u4E1D\u6570</label>' +
        '<input id="kol-bf-followers" type="text" value="' + (opts.prefillFollowers || '') + '" placeholder="\u8F93\u5165\u7C89\u4E1D\u6570" style="' + INPUT_CSS + '">' +
      '</div>' +
      '<div style="margin-bottom:18px">' +
        '<label style="' + LABEL_CSS + '">\u4E3B\u9875\u94FE\u63A5</label>' +
        '<input id="kol-bf-url" type="text" value="' + (opts.prefillUrl || '') + '" style="' + INPUT_CSS + ';color:#86868B;font-size:11px" readonly>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button id="kol-bf-cancel" style="' + BTN_CANCEL + '">\u53D6\u6D88</button>' +
        '<button id="kol-bf-save" style="' + BTN_PRIMARY + '">\u4FDD\u5B58</button>' +
      '</div>';

    overlay.appendChild(form);
    document.body.appendChild(overlay);
    setTimeout(function () { var el = document.getElementById('kol-bf-name'); if (el) el.focus(); }, 100);
    addInputFocus(form);
    addBtnHover('kol-bf-cancel', '#F5F5F7', '#FFFFFF');
    addBtnHover('kol-bf-save', '#0066D6', '#007AFF');

    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.getElementById('kol-bf-cancel').addEventListener('click', function () { overlay.remove(); });

    document.getElementById('kol-bf-save').addEventListener('click', function () {
      var name = document.getElementById('kol-bf-name').value.trim();
      var followers = parseInt(document.getElementById('kol-bf-followers').value.trim() || '0', 10);
      if (!name) {
        var el = document.getElementById('kol-bf-name');
        el.style.borderColor = '#FF3B30'; el.focus(); return;
      }
      if (opts.onSave) {
        opts.onSave(overlay, {
          id: opts.autoId || (opts.idPrefix + '_' + Date.now()),
          name: name, followers: followers,
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
    var titleLabel = opts.titleLabel || '\u5E16\u5B50\u6807\u9898';
    var bloggerLabel = opts.bloggerLabel || '\u535A\u4E3B\u540D\u79F0';

    form.innerHTML =
      '<div style="font-size:15px;font-weight:600;margin-bottom:18px;color:#1D1D1F;letter-spacing:-0.2px">' +
        '\uD83D\uDCDD \u91C7\u96C6' + (opts.label || '\u5E16\u5B50') + (opts.subLabel ? ' <span style="font-weight:400;color:#86868B;font-size:12px">' + opts.subLabel + '</span>' : '') +
      '</div>' +
      '<div style="margin-bottom:14px">' +
        '<label style="' + LABEL_CSS + '">' + titleLabel + ' *</label>' +
        '<input id="kol-pf-title" type="text" placeholder="\u8F93\u5165' + titleLabel + '" style="' + INPUT_CSS + '">' +
      '</div>' +
      '<div style="margin-bottom:14px">' +
        '<label style="' + LABEL_CSS + '">' + bloggerLabel + ' *</label>' +
        '<input id="kol-pf-blogger" type="text" placeholder="\u8F93\u5165' + bloggerLabel + '" style="' + INPUT_CSS + '">' +
      '</div>' +
      '<div style="display:flex;gap:12px;margin-bottom:14px">' +
        '<div style="flex:1">' +
          '<label style="' + LABEL_CSS + '">\u70B9\u8D5E\u6570</label>' +
          '<input id="kol-pf-likes" type="text" placeholder="0" style="' + INPUT_CSS + '">' +
        '</div>' +
        '<div style="flex:1">' +
          '<label style="' + LABEL_CSS + '">' + bloggerLabel + '\u7C89\u4E1D\u6570</label>' +
          '<input id="kol-pf-followers" type="text" placeholder="0" style="' + INPUT_CSS + '">' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:18px">' +
        '<label style="' + LABEL_CSS + '">\u5E16\u5B50\u94FE\u63A5</label>' +
        '<input id="kol-pf-url" type="text" value="' + (opts.prefillUrl || '') + '" style="' + INPUT_CSS + ';color:#86868B;font-size:11px" readonly>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button id="kol-pf-cancel" style="' + BTN_CANCEL + '">\u53D6\u6D88</button>' +
        '<button id="kol-pf-save" style="' + BTN_PRIMARY + '">\u4FDD\u5B58</button>' +
      '</div>';

    overlay.appendChild(form);
    document.body.appendChild(overlay);
    setTimeout(function () { var el = document.getElementById('kol-pf-title'); if (el) el.focus(); }, 100);
    addInputFocus(form);
    addBtnHover('kol-pf-cancel', '#F5F5F7', '#FFFFFF');
    addBtnHover('kol-pf-save', '#0066D6', '#007AFF');

    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.getElementById('kol-pf-cancel').addEventListener('click', function () { overlay.remove(); });

    document.getElementById('kol-pf-save').addEventListener('click', function () {
      var title = document.getElementById('kol-pf-title').value.trim();
      var blogger = document.getElementById('kol-pf-blogger').value.trim();
      var likes = parseInt(document.getElementById('kol-pf-likes').value.trim() || '0', 10);
      var followers = parseInt(document.getElementById('kol-pf-followers').value.trim() || '0', 10);
      if (!title) {
        var el = document.getElementById('kol-pf-title');
        el.style.borderColor = '#FF3B30'; el.focus(); return;
      }
      if (!blogger) {
        var el = document.getElementById('kol-pf-blogger');
        el.style.borderColor = '#FF3B30'; el.focus(); return;
      }
      if (opts.onSave) {
        opts.onSave(overlay, {
          id: opts.autoId || ('post_' + Date.now()),
          title: title, bloggerName: blogger,
          likes: likes, followers: followers,
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
      width: '44px', height: '44px', borderRadius: '50%', border: 'none',
      backgroundColor: '#FFFFFF', color: '#1D1D1F', fontSize: '18px',
      cursor: 'pointer',
      boxShadow: '0 2px 12px rgba(0,0,0,0.1), 0 0 0 0.5px rgba(0,0,0,0.04)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
    mainBtn.addEventListener('mouseenter', function () {
      mainBtn.style.transform = 'scale(1.08)';
      mainBtn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(0,0,0,0.04)';
    });
    mainBtn.addEventListener('mouseleave', function () {
      mainBtn.style.transform = 'scale(1)';
      mainBtn.style.boxShadow = '0 2px 12px rgba(0,0,0,0.1), 0 0 0 0.5px rgba(0,0,0,0.04)';
    });

    var menu = document.createElement('div');
    menu.className = 'kol-menu';
    Object.assign(menu.style, {
      position: 'absolute', bottom: '52px', right: '0',
      backgroundColor: '#FFFFFF', borderRadius: '10px', padding: '4px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.04)',
      display: 'none', flexDirection: 'column', gap: '2px', minWidth: '130px'
    });

    menuActions.forEach(function (item) {
      var btn = document.createElement('button');
      btn.textContent = item.label;
      Object.assign(btn.style, {
        padding: '8px 14px', border: 'none', borderRadius: '7px',
        backgroundColor: 'transparent', color: '#1D1D1F', fontSize: '13px',
        fontWeight: '500', cursor: 'pointer', textAlign: 'left',
        whiteSpace: 'nowrap', transition: 'background-color 0.15s',
        fontFamily: FONT
      });
      btn.addEventListener('mouseenter', function () { btn.style.backgroundColor = '#F5F5F7'; });
      btn.addEventListener('mouseleave', function () { btn.style.backgroundColor = 'transparent'; });
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

  // ========== SPA 路由监听 ==========

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

  // 全局点击关闭菜单
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
