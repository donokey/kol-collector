# KOL 采集助手

Chrome 扩展，一键采集小红书/抖音/B站/微博的博主和帖子数据，支持 Excel/JSON 导出。

适用于品牌投放、KOL 筛选等需要快速收集社交平台博主信息的场景。

## 安装

1. 下载本项目（`git clone` 或下载 ZIP 解压）
2. 打开 Chrome，进入 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择本项目文件夹

## 支持平台

| 平台 | 博主采集 | 帖子采集 | 数据源 |
|------|---------|---------|--------|
| 小红书 | 主页自动识别 | 帖子详情页 + SPA导航 | `__INITIAL_STATE__` / API拦截 / DOM / 手动表单 |
| 抖音 | 主页自动识别 | — | `RENDER_DATA`（仅博主） |
| B站 | UP主空间页 | 视频详情页 | API（粉丝/视频详情/评论数） |
| 微博 | 主页自动识别 | 主页批量采集 + 单条详情 | `m.weibo.cn` API（service worker 代理） |

**小红书 4 层回退链**：SPA 导航后 `__INITIAL_STATE__` 数据过期时，自动切换到 API 拦截（`document_start` hook fetch/XHR）→ DOM 刮取 → 手动表单，无需刷新页面。

**微博主页批量采集**：在博主主页点击"采集博文"，自动拉取最近微博列表，勾选后一键批量保存。单条博文详情页同样支持自动采集。

## 使用

安装后访问支持平台的页面，右下角会出现 📋 浮动按钮，点击展开菜单选择采集类型。

点击工具栏图标打开面板，可以：

- 在「博主库」和「帖子收藏」两个 Tab 间切换查看已采集数据
- 为每条记录编辑备注（如"垂类""待联系"）
- 帖子记录支持补填博主粉丝数
- 点击「打开主页」/「查看帖子」跳转原始页面
- 导出 Excel（双 Sheet）或 JSON 文件，支持 JSON 导入合并

## 架构

```
kol-collector/
  manifest.json             # MV3 配置（含 host_permissions）
  background/
    service-worker.js       # 数据存储 + fetchUrl 跨域代理
  content/
    xhs-early-hook.js       # 小红书 MAIN world document_start（hook fetch/XHR）
    xhs-bridge.js           # 小红书 MAIN world document_end（读取 __INITIAL_STATE__）
    xhs.js                  # 小红书 4 层回退采集逻辑
    douyin.js               # 抖音博主采集（RENDER_DATA）
    bilibili.js             # B站（API + CSRF token）
    weibo.js                # 微博（m.weibo.cn API，跨域走 service worker）
  lib/
    shared-ui.js            # 通用 UI（toast/表单/浮动按钮/帖子选择器）
    xlsx.full.min.js        # SheetJS (MIT License)
  popup/
    popup.html/css/js       # 弹出面板 UI（macOS 极简白风格）
  icons/                    # 扩展图标
```

数据存储使用 `chrome.storage.local`，数据仅保存在本地浏览器中，不上传任何服务器。

## 已知限制

- **抖音帖子**：反爬机制严格，已移除帖子采集功能，仅保留博主采集
- **微博 API**：跨域请求通过 service worker 代理，公开数据无需登录；私有内容可能受限
- **B站**：部分 API 需要登录态（CSRF token），未登录时会回退到手动表单

## Changelog

**v1.4.0**
- 新增：微博主页批量采集博文（勾选列表一键保存）
- 新增：小红书 SPA 导航后无需刷新即可采集帖子（4 层回退链）
- 新增：小红书/B站/微博帖子评论数采集
- 修复：B站视频采集粉丝数始终为 0（添加 CSRF token）
- 修复：小红书 SPA 导航后点赞/评论数不准（document_start hook fetch/XHR）
- 移除：抖音帖子采集（反爬限制）
- UI：macOS 极简白风格全面统一，新增帖子选择器组件

**v1.3.0**
- 新增：小红书 SPA 导航检测与 stale data 跳过
- 新增：抖音帖子采集回退到手动表单

**v1.2.0**
- 新增：小红书 API 拦截（fetch/XHR hook）
- 新增：DOM 刮取作为数据回退层

**v1.1.0**
- 新增：macOS 极简白 UI 风格
- 新增：微博移动端 API 支持

**v1.0.0**
- 初始版本：小红书/抖音/B站/微博博主和帖子采集

## License

MIT
