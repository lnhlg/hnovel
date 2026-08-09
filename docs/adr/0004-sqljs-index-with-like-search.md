# 索引实现采用 sql.js（wasm），检索用 LIKE

Status: accepted

索引库从 better-sqlite3 调整为 sql.js：better-sqlite3 需要与 Electron ABI 匹配的原生模块，本机无 MSVC 编译器且 GitHub 预编译二进制不可达，无法构建；sql.js 为 wasm、零原生依赖，可在 Electron 主进程直接运行。

标准 sql.js 构建不含 FTS5 模块，且 SQLite 默认分词器对中文不支持分词；因此检索采用 `LIKE` 子串匹配。当前单项目文本规模为数 MB，毫秒级响应，满足需求；索引结构保持可整体重建，未来如需复杂检索可替换为带 FTS5 的实现而不影响事实源。
