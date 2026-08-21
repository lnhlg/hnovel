# NovelWriter - Code Wiki

## 项目概述

**NovelWriter** 是一个基于 Electron + React + TypeScript 的 AI 辅助小说创作桌面应用。面向中文网文作者：管理书稿、人物与世界观设定，提供 AI 辅助写作（续写、章纲、引导式建项、资产生成）与全书检索能力。

### 核心特性
- ✍️ Markdown 书稿目录为创作内容事实源（章节/角色/世界观/时间线/地点/关系/灵感/参考资料/写作日志）
- 🤖 AI 续写与章节生成（OpenAI 兼容 / Ollama 双供应商，流式输出，可中止）
- 📊 AI 引导式项目创建（对话式向导一键生成完整项目）
- 👥 角色管理与人物关系图、记忆图
- 🔍 全书搜索（sql.js 索引，LIKE 检索）与伏笔线追踪（埋设/活跃/回收）
- 🗄️ 每日自动备份、原子写入防损坏、一次性迁移/规范化
- 🌗 深色/浅色主题切换

---

## 目录结构

```
novelwriter/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts            # 应用入口、窗口管理、退出前索引刷盘
│   │   ├── ai.ts               # AI 供应商/聊天/流式/中止（IPC 处理器）
│   │   ├── fileStorage.ts      # 实体模型 + JSON 存储 + 项目/供应商/文风/技能管理
│   │   ├── markdownStorage.ts  # 书稿目录 MD 读写（事实源）
│   │   ├── atomicWrite.ts      # 原子写入（tmp + rename，文本/JSON/二进制）
│   │   ├── indexDocs.ts        # 扫描书稿目录收集可索引 MD 文档
│   │   ├── indexStore.ts       # sql.js 索引库：schema/搜索/伏笔线表
│   │   ├── indexRebuild.ts     # 全量重建（分批 + 让出事件循环）+ 默认调度器
│   │   ├── indexRebuildScheduler.ts # 防抖 + 脏标记 + 退出 flush（纯逻辑可单测）
│   │   ├── prompts.ts           # AI prompt 模板唯一收敛处（PROMPT_VERSION 版本化）
│   │   ├── storageMigration.ts # 一次性迁移 JSON→书稿目录 + 章节 MD 规范化
│   │   ├── projectBackup.ts    # 每日备份 + 保留份数裁剪
│   │   ├── ipcValidation.ts    # IPC 入参 zod 校验 schema
│   │   ├── ipc.ts              # IPC 处理器注册聚合
│   │   ├── ipc/                # 按域拆分的 IPC 处理器
│   │   │   ├── projects.ts chapters.ts characters.ts world.ts docs.ts
│   │   │   ├── aiOutline.ts    # AI 生成章节/规划章节/故事进展摘要（prompt 引用 ../prompts）
│   │   │   ├── wizard.ts       # AI 引导式项目创建（会话上限 20）
│   │   │   ├── assets.ts       # AI 资产生成（角色/世界观/时间线/...）
│   │   │   ├── search.ts       # 索引重建/搜索/伏笔线
│   │   │   ├── stylesSkills.ts dialogs.ts helpers.ts
│   │   ├── __tests__/          # vitest 单测（存储/索引/备份/调度器）
│   ├── shared/aiModels.ts      # 推理模型判定（主进程/渲染进程共享唯一实现）
│   ├── preload/
│   │   └── index.ts            # contextBridge 暴露 window.api（全部 IPC 通道）
│   ├── renderer/               # React 渲染进程
│   │   └── src/
│   │       ├── App.tsx         # 布局组装 + 全局加载
│   │       ├── store/          # Zustand：app / aiSettings / layout / theme
│   │       ├── components/     # 面板 + 编辑器 + 对话框 + 布局 + ui
│   │       └── assets/index.css
├── scripts/                    # backup-projects / debug-inspect-db / debug-measure-rebuild
├── specs/章纲格式规范.md        # AI 章纲格式规范 v2.0
├── electron.vite.config.ts     # 三进程构建配置
└── package.json
```

---

## 项目架构

### 技术栈

| 技术领域 | 技术选型 | 版本 | 用途说明 |
|---------|---------|------|---------|
| 桌面框架 | Electron | 33.4.11 | 跨平台桌面应用框架 |
| 前端框架 | React | 18.3.1 | UI 界面构建 |
| 开发语言 | TypeScript | 5.7.0 | 类型安全 |
| 构建工具 | Electron-Vite | 2.3.0 | 主/预加载/渲染三进程构建 |
| 状态管理 | Zustand | 5.0.3 | 轻量状态管理 |
| 富文本编辑 | TipTap | 2.11.5 | 章节编辑器 |
| 样式方案 | TailwindCSS | 3.4.17 | 实用优先 CSS |
| 数据存储 | sql.js | 1.14.1 | WASM SQLite（搜索索引，零原生依赖） |
| 数据校验 | Zod | 3.24.2 | IPC 入参校验 |
| 图标/布局 | lucide-react / react-resizable-panels | - | 图标 / 可拖拽三栏布局 |
| 测试 | Vitest | 4.1.10 | 主进程单测 |

### 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│ 渲染进程 (Renderer)  React UI + Zustand + TipTap             │
│   panels / dialogs / editors / graphs                        │
└───────────────────────┬─────────────────────────────────────┘
                        │ window.api.*（contextBridge，类型化）
┌───────────────────────┴─────────────────────────────────────┐
│ 预加载 (Preload)  ipcRenderer.invoke / on（ai:chunk 等推送）  │
└───────────────────────┬─────────────────────────────────────┘
┌───────────────────────┴─────────────────────────────────────┐
│ 主进程 (Main)                                                │
│  ipc/ 处理器（20 组）→ 校验(ipcValidation) → 业务              │
│  fileStorage(JSON) + markdownStorage(MD) + indexStore(sql.js) │
│  ai.ts（供应商/流式/中止）                                     │
└─────────────────────────────────────────────────────────────┘
```

### 存储架构（核心设计，详见 ADR 0001-0004）

```
书稿目录（项目目录，人类可读，创作内容）
├── 项目信息.md / 故事进展.md
├── 章节/1. xxx.md            ← 正文事实源（含 本章概要 + 正文内容）
├── 角色/角色设定.md + 角色/*.md（聚合 + 单卡）
├── 世界观/世界观设定.md + 分类/*.md
├── 时间线/时间线.md  地点/*.md  角色关系/角色关系.md
├── 灵感/灵感记录.md  参考资料/参考资料.md  写作日志/写作日志.md
├── .novelwriter/             ← 机器数据（可从书稿重建）
│   ├── 实体 JSON（chapters.json、characters.json、...）
│   ├── index.db（sql.js 搜索索引，可整体重建）
│   ├── characterPositions.json（关系图节点坐标）
│   └── 迁移标记 .storage-v2 / .md-normalized-v1
└── .novelwriter-backups/     ← 每日自动备份（保留 8 份）
```

- **写入路径**：全部经 `atomicWrite`（先写 `.tmp` 再 rename），崩溃不写坏原文；启动时清理残留 `.tmp`；JSON 解析失败自动留存 `.corrupt.bak`。
- **正文事实源**：有 `path` 的项目，章节正文从书稿目录 MD 读取（`loadChapters` 合并 `readChapterContent`）；无路径项目回退按章 JSON 文件（`.novelwriter/chapters/{id}.json`）。
- **实体（角色/世界观/地点等）**：运行时以 `.novelwriter/*.json` 为 CRUD 源，保存时 IPC 层同步写 MD 投影（单向：JSON → MD）。
- **索引**：`collectIndexableDocs` 扫描书稿目录全部 `.md`（跳过内部目录），全量重建按 100 条/批插入并在批次间 `setImmediate` 让出事件循环；保存后经调度器防抖 2s 合并重建，退出前 `before-quit` 强制 flush。
- **迁移**：启动时 `migrateAllProjects`（JSON→书稿目录，写 `.storage-v2`，迁移前强制备份）→ `normalizeAllProjects`（剥除章节 MD 重复嵌入的章纲/标题，写 `.md-normalized-v1`）。

### 数据模型（fileStorage.ts）

`Project`、`Chapter`（含 outline/draftVersion/storyProgressSynced）、`Character`（详细模板 20+ 字段）、`WorldSetting`、`Timeline`、`Location`、`Item`、`Dialogue`、`CharacterRelation`、`Inspiration`、`WritingLog`、`Reference`、`WritingStyle`（全局）、`Skill`（全局）、`AIProvider`（openai/ollama，isActive 标记）、`Foreshadow`（planted/active/resolved）。

全局存储（`app.getPath('userData')/novelwriter`）：`projects.json`、`aiProviders.json`、`writing-styles.json`、`skills.json`（首次从应用自带默认文件复制，用户编辑只写 userData）、`data/{projectId}`（无路径项目）、`backups/{projectId}`。

---

## 主进程模块

### index.ts — 启动流程

```
initStorage()（建目录/清 tmp/初始化默认文件/每日备份）
→ migrateAllProjects()（一次性迁移）
→ normalizeAllProjects()（章节 MD 规范化）
→ Menu.setApplicationMenu(null)
→ loadActiveProvider()
→ 注册 20 组 IPC 处理器
→ createWindow()
before-quit：有挂起索引重建时 preventDefault → flush 完成后退出
```

### ai.ts — AI 供应商与聊天

- **供应商**：`aiProviders.json` 多供应商，`isActive=1` 为活跃；内存缓存 `activeProvider`。
- **API 路径**：OpenAI 兼容 `{base}/v1/chat/completions`、`{base}/v1/models`；Ollama `{base}/api/chat`、`{base}/api/tags`。
- **流式**：OpenAI 走 SSE（`data: ` 行，处理跨 chunk 残余行）；Ollama 走逐行 JSON；chunk 经 `webContents.send('ai:chunk')` 推送。
- **中止**：按 `requestId` 登记 AbortController，`ai:abort` 可精准中止单个或全部。
- **推理模型判定** `isReasoningModel`：按名称前缀正则（o1/o3/o4/gpt-5、deepseek-v4/r1、含 reasoning/reasoner/thinking）；推理模型剥除 temperature/top_p，附加 `reasoning_effort`（low/medium/high/max）。

### ipc/ 处理器一览

| 域 | 文件 | 说明 |
|---|---|---|
| 项目 | projects.ts | 创建/打开/列表/保存/删除（含文件夹路径） |
| 章节 | chapters.ts | CRUD + 保存大纲 |
| 角色 | characters.ts | CRUD + MD 同步 |
| 世界观域 | world.ts | 世界观/时间线/地点/物品/对话/角色关系/灵感/日志/参考 CRUD + MD 同步 |
| 文风技能 | stylesSkills.ts | 全局写作风格 / 技能 |
| 文档 | docs.ts | 通用 MD 原文读写（doc:read/save，落 MD 并回写 JSON 实体） |
| AI 大纲 | aiOutline.ts | `ai:generateChapter`（复杂 prompt 组装）/ `ai:planChapters` / 故事进展摘要（自动解析章纲） |
| AI 向导 | wizard.ts | 会话式建项（````project``` 纯文本解析 → 全量落库+MD） |
| AI 资产 | assets.ts | 按类型生成角色/世界观/时间线/地点/关系/灵感/参考/章纲（单条/批量） |
| 搜索 | search.ts | `index:rebuild` / `index:search`（空索引自动重建）/ 伏笔线（foreshadows.json 事实源，旧 index.db 数据首次迁移） |
| 对话框 | dialogs.ts | 文件打开/保存/选目录/读文本 |
| 校验 | ipcValidation.ts | zod schema + `validateOrThrow`（宽松 passthrough，拦截明显类型错误） |

---

## 渲染进程

### Store（Zustand）
- `app.ts`：项目/章节/角色/各实体列表 + 加载/保存动作（AI 生成、章纲规划等入口）
- `layout.ts`：sidebarView、打开文档标签（openDocs/activeDocId/dirty/title/content）、记忆图刷新键
- `aiSettings.ts`：AI 设置面板开关 + 活跃供应商配置镜像
- `theme.ts`：明暗主题 + localStorage 持久化

### 组件
- **布局**：TitleBar / ActivityBar / Sidebar / RightToolbar / StatusBar / DocTabs
- **编辑器**：ChapterDocEditor（章节：章纲 + 正文，TipTap 富文本 + MD 双模式）、MarkdownDocEditor
- **面板**：Outline / Characters / WorldSettings / Timeline / Locations / CharacterRelations（+ 关系图）/ Inspirations / WritingLogs / References / WritingStyles / Skills / Search / Foreshadows / AIAssetBar
- **图**：CharacterRelationGraph（节点坐标持久化）、MemoryGraph（记忆可视化）
- **对话框**：AIChatDialog（实体对话，含章纲 JSON 落库）、AIWizardDialog（引导建项）、AIGenerateDialog、ExtractCharactersDialog、ExtractMemoryDialog、NewProjectDialog
- **其他**：ModelSelector（供应商/模型组合选择）

### 关键交互流
- 保存章节：编辑器 → `chapter:save`（helpers.saveChapterWithMd 统一入口）→ JSON + MD 双写 → 调度索引重建
- AI 对话：`ai:chat`（stream:true + 临时覆盖参数）→ 主进程流式 → `ai:chunk` 推送 → 实时渲染；`ai:abort(requestId)` 中止

---

## 数据流与通信

```
渲染进程 → window.api.xxx() → preload contextBridge
  → ipcRenderer.invoke('channel', args)
  → 主进程 handler（validateOrThrow → 业务 → 存储/AI）
  → 返回结果；流式经 webContents.send('ai:chunk' | 'wizard:chunk') 推送
```

## 测试与脚本

- `npm test`（vitest）：`src/main/__tests__/` — indexRebuildScheduler（防抖/脏标记/flush）、indexStore（搜索/伏笔线）、projectBackup（备份/裁剪）、storage（迁移/规范化）
- `scripts/backup-projects.mjs`：手动备份全部项目
- `scripts/debug-inspect-db.mjs` / `debug-measure-rebuild.mjs`：索引库检视与重建耗时测量

## 运行与构建

```bash
npm install
npm run dev          # 开发模式（HMR）
npm run typecheck    # 三 tsconfig 类型检查
npm test             # vitest 单测
npm run lint
npm run build        # electron-vite 生产构建 → out/
npm run preview
```

## 决策记录

- `CONTEXT.md`：领域术语与事实源约定（根目录）
- `docs/adr/0001`：MD 书稿目录为事实源 + 可重建索引
- `docs/adr/0002`：伏笔线结构化实体
- `docs/adr/0003`：JSON 一次性迁移
- `docs/adr/0004`：sql.js + LIKE 检索（better-sqlite3 无法构建的替代）
- `docs/adr/0005`：AI 对话框临时覆盖层（不写回全局设置）
- `specs/章纲格式规范.md`：AI 章纲输出格式 v2.0

## 维护备忘

- 实体类型与 CRUD 在 `fileStorage.ts` 定义，新增实体需同步：类型 → JsonStore 方法 → IPC schema（ipcValidation）→ preload 通道 → 渲染 store/组件 → 索引（如需）。
- 书稿目录的 MD 模板集中在 `markdownStorage.ts`，改动模板注意与 `readXxxMD` 解析正则、`specs/章纲格式规范.md` 保持三方一致。
- 索引重建是全量的：文档量大后考虑增量；当前规模（数 MB）毫秒级。

*文档版本：2.0（对齐 2026-07 当前架构）*
