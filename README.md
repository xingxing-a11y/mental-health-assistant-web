# MindHarbor 前端 · assistant-web

心理健康助手 **MindHarbor（心岛）** 的浏览器端。承载 AI 对话陪伴、心理测评、情绪日记、心理科普、放松小工具与后台管理界面。

> 后端仓库：[assistant-backend](https://github.com/xingxing-a11y/mental-health-assistant-backend)（Spring Boot 3.4.1，接口前缀 `/api/v1`）

---

## 技术栈

| 维度 | 选型 |
| --- | --- |
| 框架 | Vue 3.5（全量 `<script setup>` 组合式 API） |
| 构建 | Vite 7.2 |
| 图表 | ECharts 6（测评结果与后台数据概览） |
| 图标 | lucide-vue-next |
| 路由 | **手写实现**，无 `vue-router` |
| 状态 | **组件内状态 + 事件总线**，无 `pinia` |
| 网络 | 原生 `fetch`，无 `axios` |
| 样式 | 原生 CSS（`src/style.css` + `src/styles/games.css`），无 UI 组件库 |

> 关于「不用 vue-router / pinia / axios」：本项目页面数量与状态共享范围都有限，手写路由（`src/navigation.js` 单一数据源）+ 原生 `fetch` 反而让数据流更短、依赖更少。这是一次明确取舍，不是遗漏。

## 项目规模

| 指标 | 数值 |
| --- | --- |
| 源文件 | 30 个（`.vue` / `.js` / `.css`） |
| 源码行数 | 16,873 行 |
| `.vue` 组件 | 21 个（其中 `components/` 下 20 个，含 5 个小游戏） |

---

## 功能页面

导航结构由 `src/navigation.js` 单一数据源定义（侧栏渲染、路由白名单、当前页高亮全部从它派生）：

| 分组 | 页面 |
| --- | --- |
| **顶层** | 对话陪伴、心理测评、心理科普、情绪日记 |
| **放松小工具** | 呼吸放松、正念冥想、压力打卡、游戏列表 |
| **拓展功能** | 测评结果对比、测评收藏、量表推荐、消息收藏 |
| **管理后台**（仅管理员） | 数据概览、用户管理、测评量表、科普文章、知识库、系统公告、通知推送、敏感词词库、反馈工单、操作日志 |

游戏列表内含五个纯前端小游戏（`src/components/`）：戳气泡、填色放松、记忆配对、扫雷、蜘蛛纸牌。均无第三方游戏引擎依赖。

---

## 快速开始

### 前置

- **Node.js 20+**（开发使用 22.x）
- 后端服务已在 `http://localhost:8080` 运行

### 安装与启动

```bash
npm install
npm run dev
```

开发服务器监听 **5173**，并把 `/api` 代理到 `http://localhost:8080`（见 `vite.config.js`），因此浏览器只需访问：

```
http://localhost:5173
```

### 构建

```bash
npm run build      # 产物输出到 dist/（vite build 默认即为 production 模式）
```

---

## 与后端的约定

这一层是前后端唯一的耦合面，改动时请同步后端 `docs/openapi.yaml`。

| 约定 | 实现位置 |
| --- | --- |
| **接口前缀只出现一次** | `src/api/client.js` 的 `API_PREFIX = '/api/v1'`；其余所有请求一律经 `apiUrl(path)` 拼接，业务代码里不再出现字面量前缀 |
| **鉴权靠 Cookie** | 所有请求带 `credentials: 'include'`。后端把 JWT 写在 `HttpOnly` Cookie 里，前端**不读取也不保存令牌字符串** |
| **登录态失效的统一传播** | 任意请求收到 `401` 时，`client.js` 派发 `mh-auth-expired` 事件，由应用层统一清理登录态并跳回登录页 |
| **超时与错误文案** | 请求默认 30s 超时（`AbortController`）；网络不可达与超时分别给出可读中文提示，不把原始异常抛给用户 |
| **AI 回复走 SSE** | `src/api/modules.js` 的 `streamChat()` 用 `fetch` + `ReadableStream` 逐块解析 `text/event-stream`。之所以不用 `EventSource`，是因为需要 POST 请求体并携带 Cookie |
| **统一响应体** | 后端固定返回 `{ code, message, data }`，业务代码只读 `data`，错误提示取 `message` |
| **头像地址** | 后端返回相对路径 `/uploads/avatars/<文件名>`，两种存储后端对外地址一致，前端无需区分 |

接口按业务域组织在 `src/api/modules.js`：`userApi`、`chatApi`、`assessmentApi`、`articleApi`、`diaryApi`、`relaxApi`、`notificationApi`、`settingsApi`、`systemApi`、`feedbackApi`、`adminApi`、`announcementApi`。

---

## 目录结构

```
assistant-web/
├── src/
│   ├── main.js                   # 应用入口
│   ├── App.vue                   # 布局、页面切换、全局状态与登录态处理
│   ├── navigation.js             # 导航单一数据源（侧栏 + 路由白名单 + 高亮）
│   ├── style.css                 # 全局样式（含暗色主题）
│   ├── api/
│   │   ├── client.js             # API_PREFIX、fetch 封装、超时与 401 传播
│   │   └── modules.js            # 按业务域划分的接口函数 + streamChat
│   ├── components/               # 20 个页面/组件（含 5 个小游戏）
│   ├── styles/games.css          # 游戏样式（与 style.css 同步维护）
│   └── utils/                    # 背景锁定、时间格式化、游戏存档
├── public/favicon.svg
├── index.html
├── vite.config.js                # 开发端口 5173 与 /api 代理
├── nginx.conf                    # 生产环境反向代理配置（由后端 compose 挂载）
└── package.json
```

---

## 样式约定

- **亮色为主、暗色镜像**：两套色值分别写在 `src/style.css` 与 `src/styles/games.css`，改配色时两个文件必须同步。
- **全局 class 优先于 `scoped`**：组件样式写在全局样式表中，便于统一调整主题；新增样式优先追加全局 class。
- **不引入 UI 组件库与 CSS 预处理器**：`sass` 虽在依赖列表中，但项目内无 `.scss` 文件、无 `lang="scss"` 块，实际使用的是原生 CSS。
- **布局以页面级 padding 与媒体查询为准**：内容区桌面端 48px、移动端 22px；行内样式优先级高于媒体查询，覆盖时需注意层叠顺序。
- **新增 npm 依赖需谨慎**：项目刻意保持极小的依赖面，优先用原生 API 或内联 SVG 实现。

---

## 生产部署

`nginx.conf` 与本 README 同级，由后端仓库的 `docker-compose.yml` 挂载到 nginx 容器。它负责三件事：

1. 把 `/api/` 反代到后端容器 `http://backend:8080`（**同域，保证 Cookie 生效**）；
2. 对 `/api/` **关闭响应缓冲**（`proxy_buffering off`）并放宽读写超时到 300s，否则 AI 对话的 SSE 逐字输出会被 nginx 攒住；
3. 单页应用回退：`try_files $uri $uri/ /index.html`。

构建产物 `dist/` 会随 compose 挂载到 nginx 的 `/usr/share/nginx/html`，部署目录拼装方式见后端 README 的「Docker 部署」章节。

---

## 已知限制

1. **前端零自动化测试**：当前没有测试框架与用例，页面改动依赖手工验证。
2. **存在若干零引用依赖**：`axios`、`element-plus`、`pinia`、`vue-router`、`@wangeditor/editor` 在 `src/` 下无任何引用（项目改用原生 `fetch` 与手写路由）；`sass` 同理。清理它们可以显著缩小 `node_modules`。
3. **无 ESLint / Prettier 配置**，代码风格靠人工保持一致。
4. **管理后台入口为双重门控**：侧栏项由 `navigation.js` 的 `adminOnly` 标记，同时 `App.vue` 会再次校验当前用户角色，手敲 URL 也不会渲染后台页面。后端仍会独立校验 `ADMIN` 角色，前端门控仅用于界面呈现。
5. **路由白名单需与新页面同步**：新增页面时要在 `navigation.js` 登记，并在 `App.vue` 补对应的模板分支；漏登记不会报错，只会表现为刷新后退回首页。

## 关联仓库

| 仓库 | 说明 |
| --- | --- |
| [assistant-backend](https://github.com/xingxing-a11y/mental-health-assistant-backend) | 后端（Spring Boot 3.4.1 + MyBatis-Plus + MySQL + Redis + Spring AI），提供本项目所需的全部接口 |
