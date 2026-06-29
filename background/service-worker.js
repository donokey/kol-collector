// KOL 采集助手 - Background Service Worker
// 负责数据存储管理（chrome.storage.local）

// 初始化存储
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['bloggers', 'posts'], (result) => {
    if (!result.bloggers) {
      chrome.storage.local.set({ bloggers: [] });
    }
    if (!result.posts) {
      chrome.storage.local.set({ posts: [] });
    }
  });
});

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'saveBlogger':
      saveBlogger(message.data).then(sendResponse);
      return true; // 异步响应

    case 'savePost':
      savePost(message.data).then(sendResponse);
      return true;

    case 'getAllData':
      getAllData().then(sendResponse);
      return true;

    case 'updateNote':
      updateNote(message.type, message.id, message.note).then(sendResponse);
      return true;

    case 'updateFollowers':
      updateFollowers(message.id, message.followers).then(sendResponse);
      return true;

    case 'deleteItem':
      deleteItem(message.type, message.id).then(sendResponse);
      return true;

    case 'clearAll':
      clearAll().then(sendResponse);
      return true;

    case 'importData':
      importData(message.bloggers, message.posts).then(sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: 'unknown action: ' + message.action });
      return false;
  }
});

// ========== 存储操作 ==========

async function saveBlogger(data) {
  try {
    const result = await chrome.storage.local.get('bloggers');
    const bloggers = result.bloggers || [];

    // 去重：以 id 为 key，已存在则更新
    const existingIndex = bloggers.findIndex(b => b.id === data.id);
    if (existingIndex >= 0) {
      // 保留原有备注，更新其他字段
      bloggers[existingIndex] = { ...data, note: bloggers[existingIndex].note };
    } else {
      bloggers.push(data);
    }

    await chrome.storage.local.set({ bloggers });
    return { success: true };
  } catch (e) {
    console.error('[KOL采集] saveBlogger error:', e);
    return { success: false, error: e.message };
  }
}

async function savePost(data) {
  try {
    const result = await chrome.storage.local.get('posts');
    const posts = result.posts || [];

    const existingIndex = posts.findIndex(p => p.id === data.id);
    if (existingIndex >= 0) {
      posts[existingIndex] = { ...data, note: posts[existingIndex].note };
    } else {
      posts.push(data);
    }

    await chrome.storage.local.set({ posts });
    return { success: true };
  } catch (e) {
    console.error('[KOL采集] savePost error:', e);
    return { success: false, error: e.message };
  }
}

async function getAllData() {
  try {
    const result = await chrome.storage.local.get(['bloggers', 'posts']);
    return {
      success: true,
      bloggers: result.bloggers || [],
      posts: result.posts || []
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function updateNote(type, id, note) {
  try {
    const key = type === 'blogger' ? 'bloggers' : 'posts';
    const result = await chrome.storage.local.get(key);
    const items = result[key] || [];

    const index = items.findIndex(item => item.id === id);
    if (index >= 0) {
      items[index].note = note;
      await chrome.storage.local.set({ [key]: items });
      return { success: true };
    }
    return { success: false, error: '未找到该条目' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function updateFollowers(id, followers) {
  try {
    const result = await chrome.storage.local.get('posts');
    const posts = result.posts || [];
    const index = posts.findIndex(p => p.id === id);
    if (index >= 0) {
      posts[index].bloggerFollowers = followers;
      await chrome.storage.local.set({ posts });
      return { success: true };
    }
    return { success: false, error: '未找到该帖子' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function deleteItem(type, id) {
  try {
    const key = type === 'blogger' ? 'bloggers' : 'posts';
    const result = await chrome.storage.local.get(key);
    const items = result[key] || [];

    const filtered = items.filter(item => item.id !== id);
    await chrome.storage.local.set({ [key]: filtered });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function clearAll() {
  try {
    await chrome.storage.local.set({ bloggers: [], posts: [] });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function importData(newBloggers, newPosts) {
  try {
    const result = await chrome.storage.local.get(['bloggers', 'posts']);
    const existingBloggers = result.bloggers || [];
    const existingPosts = result.posts || [];

    let importedBloggers = 0, skippedBloggers = 0;
    let importedPosts = 0, skippedPosts = 0;

    // 合并博主：按 ID upsert，保留已有备注
    const bloggerMap = new Map(existingBloggers.map(b => [b.id, b]));
    newBloggers.forEach(b => {
      const exists = bloggerMap.has(b.id);
      if (exists) {
        // 保留已有备注，更新其他字段
        const oldNote = bloggerMap.get(b.id).note;
        bloggerMap.set(b.id, { ...b, note: oldNote || b.note || '' });
        skippedBloggers++;
      } else {
        bloggerMap.set(b.id, b);
        importedBloggers++;
      }
    });

    // 合并帖子：按 ID upsert，保留已有备注
    const postMap = new Map(existingPosts.map(p => [p.id, p]));
    newPosts.forEach(p => {
      const exists = postMap.has(p.id);
      if (exists) {
        const oldNote = postMap.get(p.id).note;
        postMap.set(p.id, { ...p, note: oldNote || p.note || '' });
        skippedPosts++;
      } else {
        postMap.set(p.id, p);
        importedPosts++;
      }
    });

    await chrome.storage.local.set({
      bloggers: Array.from(bloggerMap.values()),
      posts: Array.from(postMap.values())
    });

    return { success: true, importedBloggers, importedPosts, skippedBloggers, skippedPosts };
  } catch (e) {
    console.error('[KOL采集] importData error:', e);
    return { success: false, error: e.message };
  }
}
