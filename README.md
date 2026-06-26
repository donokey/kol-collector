# KOL 采集助手

Chrome 扩展，一键采集小红书/抖音/B站/微博的博主和帖子数据，支持 Excel/JSON 导出。

适用于品牌投放、KOL 筛选等需要快速收集社交平台博主信息的场景。

## 安装

1. 下载本项目（`git clone` 或下载 ZIP 解压）
2. 打开 Chrome，进入 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择本项目文件夹

## 使用

安装后访问以下任意平台页面，页面右下角会出现采集按钮：

| 平台 | 博主采集 | 帖子采集 |
|------|---------|---------|
| 小红书 | 博主主页自动识别 | 帖子详情页 |
| 抖音 | 博主主页自动识别 | 视频详情页 |
| B站 | UP主空间页 | 视频详情页 |
| 微博 | 博主主页 | 帖子详情页 |

点击工具栏图标打开面板，可以：

- 在「博主库」和「帖子收藏」两个 Tab 间切换查看已采集数据
- 为每条记录编辑备注（比如"垂类""待联系"）
- 点击「打开主页」/「查看帖子」跳转原始页面
- 导出 Excel（双 Sheet）或 JSON 文件

## 架构

```
kol-collector/
  manifest.json          # MV3 配置
  background/
    service-worker.js    # 数据存储（chrome.storage.local）
  content/
    xhs.js               # 小红书内容脚本
    xhs-bridge.js        # 小红书 MAIN world 桥接（读取 __INITIAL_STATE__）
    douyin.js            # 抖音（读取 RENDER_DATA + DOM）
    bilibili.js          # B站（API + DOM）
    weibo.js             # 微博（移动端 API）
  popup/
    popup.html/css/js    # 弹出面板 UI
  lib/
    xlsx.full.min.js     # SheetJS (SheetJS, MIT License)
  icons/                 # 扩展图标
```

数据存储使用 `chrome.storage.local`，数据仅保存在本地浏览器中，不上传任何服务器。

## 已知限制

- 小红书 SPA 路由切换时需手动刷新或重新进入页面
- B站 API 如果 CORS 策略收紧可能失败，可用手动表单兜底
- 抖音搜索页的采集按钮会出现在所有搜索结果上，手动表单可补救

## License

MIT
