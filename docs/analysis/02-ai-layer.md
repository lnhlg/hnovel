# AI 层深入分析（NovelWriter）

> 分析对象：`src/main/ai.ts`、`ipc/aiOutline.ts`、`ipc/wizard.ts`、`ipc/assets.ts`、`ipc/helpers.ts`、`ipcValidation.ts`（AI 相关 schema），以及渲染端 `AIChatDialog.tsx`、`AIWizardDialog.tsx`、`ModelSelector.tsx`、`store/aiSettings.ts`。
> 日期：2026-07；结论基于当前代码快照。

## 修复记录（2026-07）

- ✅ **风险 1 chunk 推送不一致**：`aiOutline.ts` 的 `ai:generateChapter` / `ai:planChapters` 由 `BrowserWindow.getFocusedWindow()` 改为 `BrowserWindow.fromWebContents(event.sender)`，多窗口/失焦时流式 chunk 不再丢失。
- ✅ **风险 2 apiKey 明文**：`fileStorage.ts` 增加 `encryptApiKey`/`decryptApiKey`（Electron `safeStorage`，落盘存 `enc:<base64>`；不可用时回退明文，旧明文文件读取兼容）。加载时解密供请求使用，行为不变。
- ✅ **风险 3 prompt 收敛**：新建 `src/main/prompts.ts`（`PROMPT_VERSION = '2026-07'`）——主进程全部 prompt 模板（生成章节/规划章节/向导系统提示词/资产生成）从 aiOutline.ts、wizard.ts、assets.ts 迁入，三处改为引用。渲染端 `AIChatDialog` 的 `ENTITY_CONFIG` 未迁（跨 bundle 共享需另建 src/shared 目录，留待后续）。
- ✅ **风险 4 关联改进（外部）**：`isReasoningModel` 被抽到 `src/shared/aiModels.ts`，主进程与渲染进程共享单一实现（外部并发修改，与本分析建议一致）。
- ✅ **风险 5 ensureModel**：优先级改为"供应商 model → 拉取列表第一个（仅活跃供应商持久化）→ 全局当前模型 → 明确报错"，去掉硬编码 `gpt-3.5-turbo`/`qwen2.5` 默认名，且不再把非活跃供应商的模型写进活跃供应商配置。
- ✅ **风险 6 重试**：`ai.ts` 新增 `fetchWithRetry`（网络错误与 5xx 重试 2 次，退避 500ms×n，4xx/AbortError 不重试），应用于 chatOpenAI 与 chatOllama 全部请求；重试决策在读取响应体之前，流式安全。
- ✅ **风险 7 wizard 会话上限**：`MAX_WIZARD_SESSIONS = 20`，超限淘汰最旧会话（Map 插入序）。
- ✅ **风险 8 JSON 提取加固**：`helpers.ts` 新增 `extractFirstBalanced`（```json 围栏优先 + 括号配对），`planChapters` 与 `assets.extractJson` 共用，不再用贪婪正则误抓说明文字。
- ⏳ 采样参数 UI（temperature/topP）暴露：schema 与主进程已就绪，待产品确认后加控件。

## 1. 能力地图

| 能力 | 入口（IPC） | 说明 |
|---|---|---|
| 供应商管理 | ai:saveProvider / listProviders / setActiveProvider / deleteProvider / testConnection | 多供应商，`isActive=1` 活跃；apiKey 存本地 JSON |
| 模型列表 | ai:listModels / listAllModels | OpenAI `/v1/models`、Ollama `/api/tags`；listAllModels 聚合全部供应商供组合下拉 |
| 通用对话 | ai:chat | 流式/非流式，临时覆盖（provider/model/reasoningEffort/temperature/topP），requestId 精准中止 |
| 中止 | ai:abort | 按 requestId 或全部 |
| 生成章节 | ai:generateChapter | 复杂 prompt 组装（见 §3），流式 |
| 规划章节 | ai:planChapters | 非流式，JSON 数组提取 |
| 故事进展 | storyProgress:get/save/autoUpdate | 从章纲结构化字段自动汇总 |
| 引导建项 | wizard:init/send/regenerate/createProject/end | 会话式，`project` 纯文本块解析 |
| 资产生成 | ai:generateAsset | 单条/批量：角色/世界观/时间线/地点/关系/灵感/参考/章纲 |
| 实体对话 | AIChatDialog（渲染端） | 角色/世界观/地点/章纲的自然语言创建修改，JSON 落库 |

## 2. 传输与流式

- **OpenAI 兼容**：SSE，逐行 `data: ` 前缀解析；`remainder` 机制处理跨 chunk 半行；`[DONE]` 跳过；`delta.content` 累加。流结束处理残留行。实现稳健。
- **Ollama**：逐行 JSON（`message.content`），无残余行处理（Ollama 按行 flush，风险低）。
- **推送**：`ai:chunk` / `wizard:chunk` 经 `webContents.send`；`ai.ts` 用 `BrowserWindow.fromWebContents(event.sender)`（**正确**，多窗口安全）；`aiOutline.ts` 用 `BrowserWindow.getFocusedWindow()`（**不一致**，失焦/多窗口时 chunk 丢失——建议统一为 fromWebContents）。
- **中止**：`ai:chat` 每请求生成 requestId（未传自动 UUID），AbortController 登记 Map，finally 释放；`ai:abort` 精准中止。设计良好。
- **推理模型参数纪律**（亮点）：
  - `isReasoningModel` 按名称判定（o1/o3/o4/gpt-5、deepseek-v4/r1、reasoning/reasoner/thinking）；
  - 推理模型：附加 `reasoning_effort`（低/中/高/最高），**剥除 temperature/top_p**（避免 400 与规范冲突）；
  - 非推理模型：不传 reasoning_effort，正常传采样参数。
  - 风险：名称启发式误判（如自建模型名含 "thinking" 但 API 不接受该参数 → 400；反向误判则采样参数被剥除）。可加"供应商可选显式标记"兜底。

## 3. ai:generateChapter prompt 组装（核心资产）

分层注入顺序：
1. 【小说大纲】synopsis
2. 【故事进展摘要】storyProgress（已发生剧情/伏笔/角色变化）
3. 【记忆数据】从实体抽取并按章节排序：
   - 角色状态变化（importantEvents 中 `[ch:xxx]` 标记 → 章节序）
   - 物品记录（chapterId 关联）
   - 已发生事件（时间线描述含 `[ch:xxx]`）
   - 关键对话（dialogues 截断 60 字）
   - 人物关系演变（角色关系 description 含 `[ch:xxx]`，按对合并为 `a→b` 链）
   - 人物关联（世界观分类"人物-物品关系/人物-组织关系"）
4. 【写作风格指令】项目选中文风 > 全部文风
5. 【写作技能指令（去AI味）】项目选中技能
6. 【前章正文】最近 2 章全文（去 HTML 标签、修标点）
7. 【本章概要】紧挨生成指令，强调严格遵循
8. 生成要求（2000-5000 字、遵循大纲）

**评价**：这是本项目的核心差异化——"记忆数据"用 `[ch:xxx]` 章节锚点把角色/物品/事件/对话/关系串成时序上下文，比单纯塞全文聪明得多。**脆弱点**：锚点依赖用户在实体字段里手写 `[ch:xxx]`（AI 抽取流程写入），解析是正则；锚点缺失时条目被静默过滤（`chOf < 999`），用户无感知。建议：生成章纲/事件时由系统自动附加锚点（章纲字段里其实有 prevChapter 等，可自动打标）。

## 4. 临时覆盖层（ADR 0005 的实现）

- `ai:chat` options 全量透传临时覆盖：`providerId / model / reasoningEffort / temperature / topP / requestId`，只影响本次请求，不写回供应商配置（`setCurrentModel` 只在用户显式切换模型时调用）。
- 渲染端 AIChatDialog：本地 state `reasoningEffort` + `chatReasoningEffort`（app store）记住上次选择——符合"对话框通过本地交互状态记住上次选择"。
- schema 已支持 temperature/topP，但**渲染端 AIChatDialog 未暴露采样参数 UI**（grep 未见 temperature 控件），当前实际只有推理力度 + 模型选择覆盖。若产品计划开放采样参数，schema/主进程已就绪，只需 UI。

## 5. 引导建项（wizard）

- 会话存主进程内存 Map（无持久化、无过期清理；重启即失，可接受）。
- 系统提示词是精心设计的"创作顾问"人格：逐步收集、`[[OPTION:xxx]]` 选项按钮、触发词、````project``` 输出格式。
- `parseProjectText`：正则切 `=== 段 ===` + `---项N---` + `键：值`（值可跨行），兼容中英字段名。**脆弱点**：依赖 AI 严格输出格式；任一字段错位（如列表项分隔符被 AI 写成 `--- 角色1 ---`）整段解析失败。已有降级：解析失败返回 null，用户可 regenerate；解析成功后 `wizard:createProject` 全量落库（JSON + saveAllProjectDataMD）。

## 6. 风险清单（按严重度）

1. **getFocusedWindow vs fromWebContents 不一致**（中）：aiOutline.ts 两处用 `getFocusedWindow()`，多窗口/失焦时流式 chunk 丢失（最终返回完整文本兜底，但实时体验与中断反馈受损）。统一改 `BrowserWindow.fromWebContents(event.sender)`。
2. **apiKey 明文存储**（中）：`aiProviders.json` 明文。本地单机应用可接受，但 Electron 提供 `safeStorage` 加密，成本低、收益明确（至少 apiKey 字段加密）。
3. **prompt 与解析器耦合在主进程内联**（中）：prompt 模板分散在 aiOutline.ts / wizard.ts / assets.ts / AIChatDialog（渲染端也有 systemPrompt）。改动规格需要多处同步，且与 `specs/章纲格式规范.md` 三方一致。建议收敛到单一 `prompts/` 目录 + 版本号，并让 AI 生成的章纲严格按 spec 模板（当前章纲对话模式已要求字段，但生成正文时只注入概要）。
4. **`[ch:xxx]` 锚点依赖人工/半自动写入**（低-中）：见 §3。可让 autoUpdate 故事进展时自动为实体补锚。
5. **ensureModel 默认值硬编码**（低）：模型为空时取列表第一个，失败回退 `gpt-3.5-turbo` / `qwen2.5`——老默认模型名可能已下线。建议改为用户可见的"请选择模型"错误。
6. **无重试/退避**（低）：网络抖动即失败，AI 生成 2000-5000 字请求失败重来成本高。可对非流式小请求（planChapters/listModels）加重试；流式至少提示"可重试"。
7. **wizard 会话无上限**（低）：Map 无清理策略，极端场景内存增长；加个 LRU/过期即可。
8. **planChapters JSON 提取**（低）：`result.match(/\[[\s\S]*\]/)` 抓第一个数组——AI 若在数组外还输出说明文字且含 `[` 可能误抓；当前顺序（先找数组）通常 OK。

## 7. 架构评价与建议

**做得好的**：
- 供应商抽象干净（openai/ollama 一个接口、两种路径/格式细节封装在 ai.ts）；
- 请求生命周期完整（requestId → abort → release，finally 保证不泄漏）；
- 推理模型参数纪律是少见的细致处理（按模型名剥采样参数）；
- 记忆注入设计（时序锚点）是产品级思路，非玩具。

**建议下一步（按性价比）**：
1. 统一 chunk 推送用 `fromWebContents`（一行改，消一个真 bug 类风险）。
2. apiKey 走 `safeStorage.encryptString`（主进程启动解密进内存，改动集中在 fileStorage + ai.ts）。
3. prompt 模板收敛 + 版本化（为后续 prompt 实验/回滚铺路）。
4. 章纲生成自动打 `[ch:xxx]` 锚点，让记忆数据自举。
