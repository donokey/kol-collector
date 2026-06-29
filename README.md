# KOL 采集助手

Chrome / Edge 扩展，一键采集小红书/抖音/B站/微博的博主和帖子数据，支持 Excel/JSON 导出。

适用于品牌投放、KOL 筛选等需要快速收集社交平台博主信息的场景。

## 安装

从 [Releases](../../releases) 页面下载对应浏览器的 zip 包解压后侧载安装。

**Chrome**
1. 下载 `kol-collector-chrome-vX.X.X.zip` 并解压
2. 打开 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择解压后的文件夹

**Edge**
1. 下载 `kol-collector-edge-vX.X.X.zip` 并解压
2. 打开 `edge://extensions/`
3. 开启左下角「开发人员模式」
4. 点击「加载解压缩的扩展」，选择解压后的文件夹

> 两个版本代码完全一致，仅 manifest 名称不同。Edge 也可以直接加载 Chrome 版。

## 支持平台

| 平台 | 博主采集 | 帖子采集 | 数据源 |
|------|---------|---------|--------|
| 小红书 | 主页自动识别 | 帖子详情页 + SPA导航 | `__INITIAL_STATE__` / API拦截 / DOM / 手动表单 |
| 抖音 | 主页自动识别 | 手动表单 | `RENDER_DATA`（博主）/ DOM粉丝数尝试 |
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
- 导出 Excel（双 Sheet，含蓝链/千分位/冻结首行）或 JSON 文件，支持 JSON 导入合并

### Excel 导出字段

**博主库**：平台、博主名称、主页链接（蓝链）、粉丝数、内容方向（手填）、合作状态（手填）、备注、采集时间

**帖子收藏**：平台、帖子标题、帖子链接（蓝链）、博主名称、博主粉丝、点赞、评论、收藏、互动总量（自动求和）、备注、采集时间

## 构建

项目代码只维护一份，通过构建脚本同时生成 Chrome 和 Edge 两个 zip 包：

```bash
npm install
npm run build
# 输出: dist/kol-collector-chrome-vX.X.X.zip
#       dist/kol-collector-edge-vX.X.X.zip
```

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
    douyin.js               # 抖音博主采集 + 帖子手动表单
    bilibili.js             # B站（API + CSRF token）
    weibo.js                # 微博（m.weibo.cn API，跨域走 service worker）
  lib/
    shared-ui.js            # 通用 UI（toast/表单/浮动按钮/帖子选择器）
    exceljs.min.js          # ExcelJS v4.4.0 (MIT License)
  popup/
    popup.html/css/js       # 弹出面板 UI（macOS 极简白风格）
  icons/                    # 扩展图标
  build.js                  # 构建脚本（Chrome + Edge 双包输出）
```

数据存储使用 `chrome.storage.local`，数据仅保存在本地浏览器中，不上传任何服务器。

## 已知限制

- **抖音帖子**：反爬严格，帖子采集为手动表单；博主粉丝数尝试从 DOM 读取，失败时需手填
- **微博 API**：跨域请求通过 service worker 代理，公开数据无需登录；私有内容可能受限
- **B站**：部分 API 需要登录态（CSRF token），未登录时会回退到手动表单

## Changelog

**v1.7.0**
- 新增：Edge 适配版本，构建脚本同时输出 Chrome 和 Edge 两个 zip
- 新增：博主表 Excel 导出增加「内容方向」和「合作状态」列（手填）
- 新增：帖子表增加「互动总量」列（点赞+评论+收藏自动求和）
- 新增：抖音帖子采集（手动表单），支持 modal_id 和 feed 视频检测
- 新增：抖音博主粉丝数尝试从 DOM 自动读取并预填表单
- 优化：帖子表去掉「转发」列和「博主主页」列
- 优化：手动表单去掉转发字段，布局更紧凑
- 升级：ExcelJS 替代 SheetJS，支持蓝链/千分位/冻结首行/交替行色

**v1.6.0**
- 升级：Excel 导出改用 ExcelJS，全面美化排版

**v1.5.0**
- 新增：小红书/B站帖子收藏数采集
- 新增：四平台帖子字段统一（点赞/评论/收藏/转发）

**v1.4.0**
- 新增：微博主页批量采集博文（勾选列表一键保存）
- 新增：小红书 SPA 导航后无需刷新即可采集帖子（4 层回退链）
- 修复：微博跨域 CORS（service worker 代理）
- 修复：B站/小红书粉丝数和互动数据准确性

**v1.0.0 - v1.3.0**
- 初始版本至小红书 API 拦截、SPA 导航检测

## License

MIT
