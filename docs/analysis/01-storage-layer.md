# 存储层深入分析（NovelWriter）

> 分析对象：`src/main/` 下 fileStorage / markdownStorage / atomicWrite / indexDocs / indexStore / indexRebuild / indexRebuildScheduler / storageMigration / projectBackup，以及 ipc/search.ts、ipc/chapters.ts、ipc/docs.ts、ipc/world.ts、ipc/characters.ts 的存储调用。
> 日期：2026-07；结论基于当前代码快照。

## 修复记录（2026-07）

- ✅ **R3 索引并发写窗口**：`indexRebuild.ts` 增加同项目串行队列 `runExclusive`，调度器重建、`index:rebuild`、搜索路径空索引现场重建全部互斥；`search.ts` 的空索引重建改走统一 `rebuildProjectIndex` 路径（`saveIndex`/`rebuildSearchIndex`/`collectIndexableDocs` 导入随之清理）。
- ✅ **R1 实体回写字段丢失**：`docs.ts` 单实体 `doc:save`（character/worldSetting/location）改为"MD 缺失字段保留 JSON 现值"的合并保护，不再用空串覆盖。
- ✅ **R2 量级警戒**：`indexRebuild.ts` 重建耗时 >2s 时输出 warn（含项目名/文档数/FTS5 提示），为未来换 FTS5 决策积累数据。
- ✅ **CONTEXT.md 分层事实源边界**：补充"章节正文 MD 事实源 / 实体元数据 JSON 运行时事实源 + MD 单向投影"的现状表述，双写条目修正为"正文层已消除、实体层单向投影"。
- ⏳ **R5/R6 文件名与备份策略**：维持现状，属已知取舍。

## 1. 分层模型（实际实现 vs CONTEXT 声明）

| 层 | 位置 | 角色 | 事实源？ |
|---|---|---|---|
| 书稿目录 MD | 项目目录（章节/角色/...） | 章节正文：**是事实源**（`loadChapters` 从 MD 读正文）；实体：MD 是**单向投影**（JSON→MD） | 部分 |
| 项目数据 JSON | `.novelwriter/*.json` | 实体 CRUD 的运行时事实源（角色/世界观/地点/关系/灵感/日志/参考/伏笔线/章节元数据） | 是（实体层） |
| 搜索索引 | `.novelwriter/index.db`（sql.js） | 派生数据，允许滞后、可整体重建 | 否 |
| 全局数据 | `userData/novelwriter/` | projects.json、aiProviders.json、文风/技能、无路径项目数据 | 是（全局层） |
| 备份 | `.novelwriter-backups/` 或 `userData/backups/` | 快照 | 否 |

**要点**：CONTEXT.md 声明"书稿目录是创作内容的事实源"，但实现是**分层事实源**——章节正文以 MD 为准，实体元数据以 JSON 为准、MD 为投影。这与 ADR 0001 "消除 JSON/Markdown 双写" 的原始意图不完全一致（双写仍在，但方向单向、入口收敛在 IPC 层）。评价：正文优先写 MD 解决了核心体验问题（内容可读、可 diff、可同步），实体投影是折中——AI 生成的实体 JSON 结构字段远超 MD 模板字段，MD 仅承载展示字段。风险是**同一实体两处副本的字段集不同步**（见 §5）。

## 2. 模块职责与调用链

```
原子写 atomicWrite（tmp + rename，文本/JSON/二进制统一）
  ▲
fileStorage（JsonStore 泛型 CRUD，全部实体 + 全局文件）
  ▲ 实体读写
ipc/*（各域处理器，save 时调用 markdownStorage 写 MD 投影）
  ▲
markdownStorage（书稿目录 MD 模板化读写 + 解析正则 + 聚合文档）
```

索引链：

```
保存章节 → scheduleProjectIndexRebuild(projectId)   [indexRebuild.ts]
  → indexRebuildScheduler（防抖 2000ms；执行链中再请求只标脏，链尾补跑）
  → rebuildProjectIndex：openIndex → collectIndexableDocs（跳过 .novelwriter/.novelwriter-backups/.arts/.codeartsdoer/node_modules/.git）
  → 每 100 条一批 insert，批次间 setImmediate 让出事件循环
  → saveIndex（atomicWriteBuffer）→ db.close()
退出：before-quit 检测 hasPendingIndexRebuilds → flushPendingIndexRebuilds → app.quit()
```

## 3. 亮点（值得保留的设计）

1. **原子写全覆盖**：所有写路径（MD/JSON/索引二进制）统一 `tmp + rename`；启动 `cleanupTmpFiles` 清理崩溃残留；`readJson` 解析失败自动留存 `.corrupt.bak` 并限频（`backedUpCorruptFiles` 集合）。数据安全性设计非常扎实。
2. **索引重建不阻塞主进程**：分批插入 + `setImmediate` 让出事件循环（commit 3586645 的修复），配合防抖 + 脏标记 + 退出 flush 三件套，解决了"保存后主进程卡死/写完就关丢索引"两个真实问题。调度器是纯逻辑模块（无 electron/文件依赖），可单测——测试覆盖了防抖合并与 flush。
3. **迁移可重入、有标记**：`.storage-v2` / `.md-normalized-v1` 标记文件防重入，迁移前强制备份，JSON 旧文件 `.migrated-*.bak` 留存。
4. **降级路径完整**：无 `path` 的旧式项目（正文存 `.novelwriter/chapters/{id}.json`）与有 `path` 项目并存，`loadChapters` 按 project.path 分流，旧数据不丢。
5. **损坏自愈**：`index:search` 检测到空索引自动现场重建；伏笔线从 index.db 迁到 foreshadows.json 时做了首次读取迁移。

## 4. 风险点（按严重度排序）

### R1. 实体双写字段漂移（中）
`saveCharacterMD` 只投影约 10 个字段，而 `Character` 有 24 个字段；`readCharacterMD` 只解析回 9 个字段。**凡是"从 MD 读实体"的路径（docs.ts 编辑后回写、ExtractCharacters/ExtractMemory 解析）都可能丢字段**。目前 AI 抽取/编辑后 `saveCharacter` 走 JSON upsert（以 IPC 传入对象为准）才不丢——但依赖调用方传全字段。建议：实体层要么明确"JSON 为唯一事实源、MD 仅展示"，要么给 MD 模板补齐字段并双向解析（成本高，不推荐）；至少把这条边界写进 CONTEXT.md。

### R2. 搜索是整表 LIKE 扫描（中，规模敏感）
`WHERE title LIKE ? OR body LIKE ?` + `ORDER BY chapter_order`，无 FTS、无分词（ADR 0004 已知取舍）。当前数 MB 文本毫秒级 OK；若单项目涨到数百章 × 万级字数（几十 MB），每次搜索全表扫描 + 每次保存全量重建的线性成本会开始感知。建议：预留量级警戒（如 >50MB 时提示换 FTS5 实现），接口已隔离（indexStore 可替换）。

### R3. 索引并发写窗口（低-中）
`index:search` 在"索引为空"时会**同步**执行 rebuildSearchIndex + saveIndex；若此时调度器正持有另一连接做重建，两者对同一 `index.db` 的原子写可能互相覆盖（最后一次写胜，内容取决于谁先完成，可能丢数据）。当前触发条件窄（仅空索引时），但值得加一个进程内互斥（简单 `isRebuilding` 标志即可）。

### R4. 全量 JSON 读写（低）
`JsonStore.load()` 每次全量读 + parse；`upsert` 全量写。对单文件几百条实体可接受，但写频繁（自动保存）时主进程同步 IO 重复全量序列化。目前规模无碍，属"知情的简单性"。

### R5. 章节文件名 = 序号 + 标题（低）
重排章节（sortOrder 变化）或改标题会改文件名；`saveChapterWithMd` 已处理旧文件删除，但**项目历史目录**中的同章节旧文件可能因标题清理规则不一致残留（normalize 已处理一次，新改标题场景仍可能留旧文件）。低风险，git 视角可接受。

### R6. 备份策略局限（低）
每日一次 + 保留 8 份：对"当天多次误操作"无保护（同日内覆盖即丢）；备份目录在项目目录内（`.novelwriter-backups`），若项目目录本身损坏（磁盘级），备份同盘失效。可选增强：跨盘副本或频率提升；当前满足"防手滑"目标。

## 5. 数据流走读（保存一章会发生什么）

1. 编辑器 `chapter:save` → `helpers.saveChapterWithMd`：
   - 标题解析：正文区起始章节标题 > preamble H1 > data.title > existing.title（注意：正文里手改"第X章"标题会改章节标题，这是特性）
   - `saveChapter(projectId, chapter)`：JSON upsert（**正文 content 置空**，防 JSON 与 MD 双存）
   - 有 path：删旧 MD 文件（标题变了）→ `saveChapterMD`（元信息 + 本章概要 + 正文段，正文从 content 里剥 `## 正文内容` 段）
2. `scheduleProjectIndexRebuild(projectId)`：防抖合并，2s 后全量重建。
3. 退出前若有挂起重建 → flush。

## 6. 改进建议（按性价比）

1. **补 CONTEXT.md**：明确"正文 MD 事实源 / 实体 JSON 事实源 + MD 投影"的现状与边界，消除文档与实现的落差（当前文档宣称消除双写，实现未完全消除）。
2. **索引写互斥**：search.ts 空索引重建与调度器重建加进程内互斥（~10 行）。
3. **MD 投影只读化**：docs.ts / 抽取流程的"读 MD → 回写"链路加字段合并保护（先 load JSON 实体再 merge MD 解析结果），防字段丢失。
4. **量级警戒**：`debug-measure-rebuild.mjs` 已有测量工具，可在 indexRebuild 里加耗时告警日志（如 >2s warn），为换 FTS5 决策留数据。
