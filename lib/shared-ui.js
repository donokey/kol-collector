// KOL 采集助手 - 共享 UI 模块 (macOS 极简白风格)
// 提供 toast、表单弹窗、浮动按钮、帖子选择器、SPA 路由监听等通用功能
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
      backgroundColor: 'rgba(0,0,0,0.08)',
      backdropFilter: 'blur(1px)', WebkitBackdropFilter: 'blur(1px)',
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
        '<input id="kol-bf-name" type="text" value="' + (opts.prefillName || '') + '" placeholder="\u8F93\u5165\u535A\u4E3B\u540D\u79F0" style="' + INPUT_CSS + '">' +
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
          '<label style="' + LABEL_CSS + '">\u8BC4\u8BBA\u6570</label>' +
          '<input id="kol-pf-comments" type="text" placeholder="0" style="' + INPUT_CSS + '">' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:12px;margin-bottom:14px">' +
        '<div style="flex:1">' +
          '<label style="' + LABEL_CSS + '">\u6536\u85CF\u6570</label>' +
          '<input id="kol-pf-favorites" type="text" placeholder="0" style="' + INPUT_CSS + '">' +
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
      var comments = parseInt(document.getElementById('kol-pf-comments').value.trim() || '0', 10);
      var favorites = parseInt(document.getElementById('kol-pf-favorites').value.trim() || '0', 10);
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
          likes: likes, comments: comments, favorites: favorites, shares: 0,
          followers: followers,
          postUrl: opts.prefillUrl || ''
        });
      } else {
        overlay.remove();
      }
    });
  }

  // ========== 帖子选择器（批量采集） ==========

  function showPostSelector(opts) {
    opts = opts || {};
    removeForm();

    var overlay = createOverlay();

    var box = document.createElement('div');
    Object.assign(box.style, {
      backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '20px',
      width: '420px', maxHeight: '80vh',
      boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)',
      fontFamily: FONT, display: 'flex', flexDirection: 'column'
    });

    // 标题行
    var header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: '14px'
    });

    var titleEl = document.createElement('div');
    titleEl.textContent = opts.title || '\u9009\u62E9\u5E16\u5B50';
    Object.assign(titleEl.style, { fontSize: '15px', fontWeight: '600', color: '#1D1D1F', letterSpacing: '-0.2px' });

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    Object.assign(closeBtn.style, {
      border: 'none', background: 'none', fontSize: '16px', color: '#86868B',
      cursor: 'pointer', padding: '4px 8px', borderRadius: '6px'
    });
    closeBtn.addEventListener('mouseenter', function () { this.style.background = '#F5F5F7'; });
    closeBtn.addEventListener('mouseleave', function () { this.style.background = 'none'; });
    closeBtn.addEventListener('click', function () { overlay.remove(); });

    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    box.appendChild(header);

    var posts = opts.posts || [];

    // 搜索和筛选工具栏（仅在有帖子且启用时显示）
    var filterBar = null;
    var searchInput, startDateInput, endDateInput, countDisplay;

    if (posts.length > 0 && opts.showFilters) {
      filterBar = document.createElement('div');
      Object.assign(filterBar.style, {
        marginBottom: '10px', padding: '10px 12px', borderRadius: '8px',
        backgroundColor: '#F5F5F7', display: 'flex', flexDirection: 'column', gap: '8px'
      });

      // 搜索框
      searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = '\uD83D\uDD0D \u641C\u7D22\u5173\u952E\u8BCD\u7B5B\u9009...';
      Object.assign(searchInput.style, {
        width: '100%', padding: '7px 10px', border: '0.5px solid #D2D2D7',
        borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box',
        fontFamily: FONT, color: '#1D1D1F', background: '#FFFFFF', outline: 'none'
      });
      searchInput.addEventListener('focus', function () { this.style.borderColor = '#007AFF'; });
      searchInput.addEventListener('blur', function () { this.style.borderColor = '#D2D2D7'; });
      filterBar.appendChild(searchInput);

      // 时间范围行
      var dateRow = document.createElement('div');
      Object.assign(dateRow.style, { display: 'flex', gap: '8px', alignItems: 'center' });

      var dateLabel = document.createElement('span');
      dateLabel.textContent = '\u65F6\u95F4\u8303\u56F4';
      Object.assign(dateLabel.style, { fontSize: '11px', color: '#86868B', flexShrink: '0' });
      dateRow.appendChild(dateLabel);

      var dateInputStyle = 'flex:1;padding:5px 8px;border:0.5px solid #D2D2D7;border-radius:6px;font-size:11px;font-family:' + FONT + ';color:#1D1D1F;background:#FFFFFF;outline:none';

      startDateInput = document.createElement('input');
      startDateInput.type = 'date';
      Object.assign(startDateInput.style, { cssText: dateInputStyle });
      startDateInput.style.cssText = dateInputStyle;
      dateRow.appendChild(startDateInput);

      var dash = document.createElement('span');
      dash.textContent = '—';
      Object.assign(dash.style, { fontSize: '11px', color: '#86868B' });
      dateRow.appendChild(dash);

      endDateInput = document.createElement('input');
      endDateInput.type = 'date';
      Object.assign(endDateInput.style, { cssText: dateInputStyle });
      endDateInput.style.cssText = dateInputStyle;
      dateRow.appendChild(endDateInput);

      filterBar.appendChild(dateRow);

      // 结果计数
      countDisplay = document.createElement('div');
      Object.assign(countDisplay.style, { fontSize: '11px', color: '#86868B' });
      countDisplay.textContent = '\u5171 ' + posts.length + ' \u6761';
      filterBar.appendChild(countDisplay);

      box.appendChild(filterBar);
    }

    // 帖子列表（可滚动）
    var listEl = document.createElement('div');
    Object.assign(listEl.style, {
      flex: '1', overflowY: 'auto', marginBottom: '14px',
      maxHeight: '45vh'
    });

    if (posts.length === 0) {
      var empty = document.createElement('div');
      empty.textContent = '\u6CA1\u6709\u53EF\u91C7\u96C6\u7684\u5E16\u5B50';
      Object.assign(empty.style, { textAlign: 'center', color: '#86868B', padding: '40px 0', fontSize: '13px' });
      listEl.appendChild(empty);
    } else {
      posts.forEach(function (post, i) {
        var card = document.createElement('div');
        card.dataset.index = i;
        card.dataset.rawdate = post.rawDate ? post.rawDate.toISOString() : '';
        Object.assign(card.style, {
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '10px 12px', borderRadius: '8px',
          border: '0.5px solid #E5E5EA', marginBottom: '6px',
          cursor: 'pointer', transition: 'background 0.15s'
        });
        card.addEventListener('mouseenter', function () { this.style.background = '#F5F5F7'; });
        card.addEventListener('mouseleave', function () { this.style.background = 'transparent'; });

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'kol-ps-cb';
        cb.dataset.index = i;
        Object.assign(cb.style, { marginTop: '3px', accentColor: '#007AFF', cursor: 'pointer', flexShrink: '0' });
        cb.addEventListener('change', function (e) { e.stopPropagation(); });

        var info = document.createElement('div');
        Object.assign(info.style, { flex: '1', minWidth: '0' });

        var textEl = document.createElement('div');
        textEl.textContent = (post.title || '').substring(0, 60) + ((post.title || '').length > 60 ? '...' : '');
        Object.assign(textEl.style, { fontSize: '13px', color: '#1D1D1F', marginBottom: '4px', lineHeight: '1.4', wordBreak: 'break-all' });

        var metaEl = document.createElement('div');
        metaEl.textContent = '\uD83D\uDC4D ' + (post.likesText || '0') + '   \uD83D\uDCAC ' + (post.commentsText || '0') + (post.dateText ? '   ' + post.dateText : '');
        Object.assign(metaEl.style, { fontSize: '11px', color: '#86868B' });

        info.appendChild(textEl);
        info.appendChild(metaEl);

        card.appendChild(cb);
        card.appendChild(info);

        // 点击卡片切换 checkbox
        card.addEventListener('click', function (e) {
          if (e.target === cb) return;
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change'));
        });

        listEl.appendChild(card);
      });
    }

    box.appendChild(listEl);

    // 过滤函数
    function applyFilter() {
      if (!filterBar) return;
      var keyword = searchInput.value.trim().toLowerCase();
      var startDate = startDateInput.value ? new Date(startDateInput.value + 'T00:00:00') : null;
      var endDate = endDateInput.value ? new Date(endDateInput.value + 'T23:59:59') : null;
      var visibleCount = 0;

      var cards = listEl.children;
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var idx = parseInt(card.dataset.index);
        var post = posts[idx];
        var show = true;

        // 关键词过滤
        if (keyword) {
          var title = (post.title || '').toLowerCase();
          var bloggerName = (post.bloggerName || '').toLowerCase();
          if (title.indexOf(keyword) === -1 && bloggerName.indexOf(keyword) === -1) {
            show = false;
          }
        }

        // 日期范围过滤
        if (show && (startDate || endDate) && post.rawDate) {
          var postDate = post.rawDate;
          if (startDate && postDate < startDate) show = false;
          if (endDate && postDate > endDate) show = false;
        }

        card.style.display = show ? 'flex' : 'none';
        if (show) visibleCount++;
      }

      countDisplay.textContent = '\u663E\u793A ' + visibleCount + ' / ' + posts.length + ' \u6761';
    }

    // 绑定过滤事件
    if (filterBar) {
      searchInput.addEventListener('input', applyFilter);
      startDateInput.addEventListener('change', applyFilter);
      endDateInput.addEventListener('change', applyFilter);
    }

    // 底部按钮行
    var footer = document.createElement('div');
    Object.assign(footer.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' });

    var leftBtns = document.createElement('div');
    Object.assign(leftBtns.style, { display: 'flex', gap: '8px' });

    var selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = '\u5168\u9009';
    Object.assign(selectAllBtn.style, {
      border: '0.5px solid #D2D2D7', borderRadius: '6px', background: '#FFFFFF',
      color: '#1D1D1F', fontSize: '12px', padding: '6px 12px', cursor: 'pointer',
      fontFamily: FONT, transition: 'background 0.15s'
    });
    selectAllBtn.addEventListener('mouseenter', function () { this.style.background = '#F5F5F7'; });
    selectAllBtn.addEventListener('mouseleave', function () { this.style.background = '#FFFFFF'; });
    selectAllBtn.addEventListener('click', function () {
      // 全选只选可见的
      var cards = listEl.children;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].style.display !== 'none') {
          var cb = cards[i].querySelector('.kol-ps-cb');
          if (cb) cb.checked = true;
        }
      }
    });

    var deselectBtn = document.createElement('button');
    deselectBtn.textContent = '\u53D6\u6D88\u9009\u62E9';
    Object.assign(deselectBtn.style, {
      border: '0.5px solid #D2D2D7', borderRadius: '6px', background: '#FFFFFF',
      color: '#1D1D1F', fontSize: '12px', padding: '6px 12px', cursor: 'pointer',
      fontFamily: FONT, transition: 'background 0.15s'
    });
    deselectBtn.addEventListener('mouseenter', function () { this.style.background = '#F5F5F7'; });
    deselectBtn.addEventListener('mouseleave', function () { this.style.background = '#FFFFFF'; });
    deselectBtn.addEventListener('click', function () {
      // 取消选择只取消可见的
      var cards = listEl.children;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].style.display !== 'none') {
          var cb = cards[i].querySelector('.kol-ps-cb');
          if (cb) cb.checked = false;
        }
      }
    });

    leftBtns.appendChild(selectAllBtn);
    leftBtns.appendChild(deselectBtn);

    var saveBtn = document.createElement('button');
    saveBtn.textContent = '\u91C7\u96C6\u5DF2\u9009';
    Object.assign(saveBtn.style, {
      border: 'none', borderRadius: '8px', background: '#007AFF',
      color: '#FFFFFF', fontSize: '13px', fontWeight: '500', padding: '8px 20px',
      cursor: 'pointer', fontFamily: FONT, transition: 'background 0.15s'
    });
    saveBtn.addEventListener('mouseenter', function () { this.style.background = '#0066D6'; });
    saveBtn.addEventListener('mouseleave', function () { this.style.background = '#007AFF'; });
    saveBtn.addEventListener('click', function () {
      var checked = listEl.querySelectorAll('.kol-ps-cb:checked');
      var selected = [];
      checked.forEach(function (cb) {
        selected.push(posts[parseInt(cb.dataset.index)]);
      });
      if (selected.length === 0) {
        showToast('\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u6761\u5E16\u5B50', true);
        return;
      }
      if (opts.onSave) opts.onSave(selected);
      overlay.remove();
    });

    footer.appendChild(leftBtns);
    footer.appendChild(saveBtn);
    box.appendChild(footer);

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
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
      timer = setTimeout(createFab, 800);
    }

    function check() {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        schedule();
      }
    }

    setInterval(check, 500);
    setTimeout(createFab, 1000);
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
    showPostSelector: showPostSelector,
    createFloatingButton: createFloatingButton,
    initRouter: initRouter
  };
})();
