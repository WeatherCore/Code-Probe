# 📖 Code-Probe 项目导读指南

> 本文件是 `Code-Probe`（代码库智能问答）项目的中文导读，帮助你从零开始理解这个全栈 RAG 系统的架构、代码和运行方式。

---

## 目录

1. [这个项目是干什么的？](#1-这个项目是干什么的)
2. [核心概念速览](#2-核心概念速览)
3. [项目目录结构详解](#3-项目目录结构详解)
4. [运行流程全景图](#4-运行流程全景图)
5. [逐文件代码导读](#5-逐文件代码导读)
6. [关键设计模式解析](#6-关键设计模式解析)
7. [配置系统详解](#7-配置系统详解)
8. [如何运行和测试](#8-如何运行和测试)
9. [复刻建议与学习路线](#9-复刻建议与学习路线)
10. [常见问题](#10-常见问题)

---

## 1. 这个项目是干什么的？

**一句话总结**：你把一个代码库丢给它，它帮你切块、做向量索引，然后你就能用自然语言问"这个项目的 XX 功能在哪实现"，它检索相关代码片段交给 LLM 生成带文件路径和行号的回答。

**更具体地说**：

```
上传/指定代码库 → 切分代码块 → 向量化(Embedding)存入 ChromaDB
                                        ↓
用户提问 → 问题向量化 → 相似度检索 Top-K → 拼上下文 → LLM 流式生成回答(SSE)
```

它不是一个简单的"ChatGPT 套壳"，而是一个 **面向代码库的 RAG（Retrieval-Augmented Generation）系统**，把"文档问答"的思路迁移到了代码场景：

- **索引侧**：扫描代码文件 → 按字符数分块（对齐行边界）→ 调 Embedding 模型向量化 → 存进 ChromaDB
- **问答侧**：问题向量化 → 向量检索 Top-K 代码块 → 拼成上下文喂给 LLM → SSE 流式吐字
- **可视化侧**：前端把"检索到哪些块、拼了什么提示词、token 估算"全程展示出来，让 RAG 过程透明可见

**为什么值得读**：项目小而全（后端 13 个 .py + 前端 30+ 个 .tsx/.ts），一条完整的 RAG 数据流从 HTTP 接口到向量库到流式渲染全打通，是理解 RAG 工程化的优质样本。

---

## 2. 核心概念速览

读代码前先懂这几个概念：

### 2.1 RAG（检索增强生成）

RAG = 先检索再生成。LLM 本身不懂你的私有代码，RAG 的做法是：先把问题相关的代码片段检索出来，作为"上下文"塞进提示词，让 LLM 基于这些真实代码回答，而不是凭空编造。**把它理解为**：开卷考试——LLM 不是背书答题，而是翻到你指定的几页再作答。

### 2.2 Embedding（向量化）

把一段文本映射成一个高维浮点向量（本项目用 `text-embedding-3-small`）。语义相近的文本，向量在空间里也相近。**把它理解为**：给每段代码发一张"语义身份证"，检索时比身份证号码的距离就行。

### 2.3 ChromaDB（向量数据库）

专门存向量、做相似度检索的数据库。本项目用 `PersistentClient`（数据落盘到 `data/chroma/`），每个代码库一个 collection，距离度量用 **cosine（余弦相似度）**。**把它理解为**：一个能"按语义相近度查代码"的保险柜。

### 2.4 Chunk（代码块）

RAG 不能把整个文件塞给 LLM，要切块。本项目的切法是**按字符数切（默认 1000 字符）+ 行边界对齐 + 重叠（默认 200 字符）**，并记录每块的 `line_start`/`line_end`，方便回答时定位回源码行号。

### 2.5 SSE（Server-Sent Events）流式

后端用 `StreamingResponse` + `text/event-stream` 把回答一个字一个字推给前端，而不是等全写完再返回。前端用 `fetch` + `ReadableStream` 手动解析 `data: {...}` 行。**把它理解为**：水龙头滴水而不是等满桶再倒。

---

## 3. 项目目录结构详解

```
Code-Probe/
│
├── backend/                           # ⭐ 后端：FastAPI + ChromaDB + OpenAI
│   ├── app/
│   │   ├── main.py                    # 🔓 FastAPI 入口，挂载 5 个路由 + CORS
│   │   ├── config/
│   │   │   ├── defaults.py            # 配置默认值 + 路径常量(DATA_DIR/SETTINGS_FILE)
│   │   │   └── manager.py             # 配置读写（JSON 持久化 + 默认值合并）
│   │   ├── api/                       # HTTP 路由层（薄，只做参数校验+转调 service）
│   │   │   ├── repos.py               # 仓库 CRUD + 索引触发(后台任务)
│   │   │   ├── chunks.py              # 分块查看 + 上下文 + 统计
│   │   │   ├── search.py              # 语义搜索
│   │   │   ├── chat.py                # 聊天(SSE流式) + 会话CRUD + prompt预览
│   │   │   └── settings.py            # 设置读写(脱敏) + 健康检查
│   │   └── services/                  # ⭐ 业务逻辑层（RAG 核心全在这）
│   │       ├── repo_service.py        # 仓库管理(repos.json 持久化 + zip解压 + 文件扫描)
│   │       ├── index_service.py       # 🔑 索引核心：分块 + 向量化 + 存 ChromaDB
│   │       ├── search_service.py      # 🔑 检索核心：问题向量化 + cosine 查询
│   │       ├── chat_service.py        # 🔑 问答核心：build_prompt + SSE 4阶段流式
│   │       └── llm_client.py          # OpenAI 兼容客户端(同步/异步/Embedding)
│   └── tests/                         # 🧪 测试(test_api.py / test_services.py)
│
├── frontend/                          # ⭐ 前端：React 18 + Vite 5 + TS + Tailwind v4
│   ├── index.html                     # 入口 HTML（深色 class 默认）
│   ├── vite.config.ts                 # Vite 配置：/api 代理 → 127.0.0.1:8000（IPv4，防 ::1 拒绝）
│   ├── package.json / tsconfig.json   # 依赖与 TS 编译配置
│   └── src/
│       ├── main.tsx                   # React 入口：BrowserRouter + 字体 + 全局样式
│       ├── App.tsx                    # 路由表（6 条）+ Layout 组合 + Toaster
│       ├── types/index.ts             # 完整 TS 类型契约（与后端 dict 一一对应）
│       ├── lib/
│       │   ├── api.ts                 # 🔑 19 个 endpoint 封装 + SSE 流式解析
│       │   └── utils.ts               # cn() / 时间格式化 / 截断工具
│       ├── hooks/
│       │   ├── useToast.ts            # Toast 全局 store（zustand）
│       │   └── useTheme.ts            # dark/light 主题切换（localStorage 持久化）
│       ├── components/
│       │   ├── Layout.tsx             # 顶栏 + 桌面固定侧边栏 + 移动端抽屉
│       │   ├── Sidebar.tsx            # 主导航 + 仓库/会话快捷列表
│       │   ├── TopBar.tsx             # 主题切换 + 后端健康状态点
│       │   ├── CodeBlock.tsx          # 语法高亮 + 行号 + 区间高亮（react-syntax-highlighter）
│       │   ├── StatusBadge.tsx        # 索引四态徽章（待索引/索引中/已索引/失败）
│       │   ├── ScoreBar.tsx           # 相似度分数条（0-100%）
│       │   ├── EmptyState.tsx         # 空状态组件
│       │   └── ui/                    # shadcn 风格基础组件（button/card/dialog/toast/select/tabs/scroll-area 等 11 个）
│       └── pages/
│           ├── HomePage.tsx           # 概览：能力卡片 + RAG 流程说明 + 快捷入口
│           ├── ReposPage.tsx          # 仓库管理：列表 + zip上传/本地路径 + 触发索引 + 轮询 + 删除
│           ├── RepoDetailPage.tsx     # 仓库详情：统计卡片 + 文件分布 + 分块分页 + 源码上下文
│           ├── ChatPage.tsx           # 🔑 AI 对话：会话侧边栏 + SSE 流式 + RAG 过程抽屉
│           ├── SearchPage.tsx         # 搜索试验场：检索结果 + Prompt 预览 + 向量预览
│           └── SettingsPage.tsx       # 设置：LLM/Embedding/分块参数/System Prompt 分组表单
│
├── docs/plans/                        # 📋 设计文档(ChatPage 重设计)
├── pyproject.toml                     # Python 项目元数据
├── requirements.txt                   # 🔑 后端依赖清单(复制即用)
└── LICENSE                            # MIT 许可
```

**要点**：
- 后端严格分层：`api/`（路由薄层）→ `services/`（业务厚层）→ `config/`（配置）。`api` 不写业务，只校验参数和转调。
- 持久化全用 **JSON 文件**（`repos.json` / `sessions.json` / `settings.json` / `{repo_id}_chunks.json`）+ ChromaDB 落盘目录，无独立数据库。
- 前端 6 个页面：1 个概览页 + 5 条业务线（仓库/详情/聊天/搜索/设置），`ChatPage.tsx` 最复杂（约 600 行，消费 SSE 流）。
- 前端技术栈：React 18 + Vite 5 + TS + Tailwind v4 + Motion（动效）+ Phosphor Icons + Geist 字体，深色优先、emerald accent。

---

## 4. 运行流程全景图

系统有两条主流程：**索引流程**（建库）和**问答流程**（用库）。

### 4.1 索引流程（建库）

```
┌─────────────────────────────────────────────────────────────────┐
│  用户操作：上传 zip / 指定本地路径 → 点"建立索引"                    │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  api/repos.py trigger_index                                       │
│  ─────────────────────────────────────                           │
│  • 校验 repo 存在 → 置状态 indexing → 把 index_repo 丢进           │
│    BackgroundTasks（异步执行，立即返回 202）                        │
│  • 退出条件：返回 {"status":"indexing"}，前端轮询 /index/status    │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  services/index_service.py index_repo（后台线程）                  │
│  ─────────────────────────────────────                           │
│  1. scan_files(repo_path) → 只收 .py 文件                         │
│     （跳过 .开头目录 / __pycache__ / node_modules / venv）         │
│  2. 逐文件读 UTF-8 → chunk_text() 切块                            │
│     • 按 chunk_size 字符切，end_char 向后扩展到下一个 \n（行对齐）  │
│     • 记录 line_start/line_end/overlap 行号                       │
│  3. _save_chunks → 落盘 {repo_id}_chunks.json                     │
│  4. 建 ChromaDB collection（cosine 距离，先 delete 再 create）    │
│  5. 分批 embed（batch_size=6）→ collection.add                    │
│  6. update_repo(status=indexed, file_count, chunk_count)          │
│  • 失败兜底：捕获异常 → update_repo(status=error, error_msg)       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 问答流程（用库，SSE 4 阶段）

```
┌─────────────────────────────────────────────────────────────────┐
│  用户在 ChatPage 输入问题 → chatStream() 发 POST /api/chat         │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  api/chat.py chat_sse → chat_service.chat_stream（异步生成器）     │
│  ─────────────────────────────────────                           │
│  • 先校验 session 存在，否则 404                                   │
│  • 用 StreamingResponse + text/event-stream 流式返回               │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌──────────── 阶段1: retrieval ────────────┐
│ search_service.search(message, repo_id)  │
│  • embed_query(问题) → 向量              │
│  • ChromaDB collection.query(cosine)     │
│  • score = 1 - distance（越大越相似）     │
│  • yield {type:"retrieval", results}     │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────── 阶段2: prompt ───────────────┐
│  • 拼 context: 📄 file_path (L行号)\n内容 │
│  • 组装 prompt_parts(system/context/      │
│    history/user_message)                  │
│  • estimate_tokens(≈ chars/4)             │
│  • yield {type:"prompt", prompt_parts,    │
│    total_tokens_estimate}                 │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────── 阶段3: chunk（LLM 流式）─────┐
│  • 组 messages: [system, 代码上下文,      │
│    ...history, user]                      │
│  • llm_client.stream_chat 逐 token        │
│  • 每个 token yield {type:"chunk",content}│
│  • 异常 yield {type:"error"} 并 return    │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────── 阶段4: done（持久化）────────┐
│  • 拼回 full_response                     │
│  • _update_session: 追加 user + assistant │
│    消息（assistant 带 rag_data 快照）      │
│  • yield {type:"done", session_id}        │
└───────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  前端 ChatPage：for await...of api.chat.stream() 按 event.type 分发 │
│  retrieval→存 rag_data.retrieval / prompt→存 prompt_parts /       │
│  chunk→追加到回答流（打字机） / done→结束 / error→报错              │
└─────────────────────────────────────────────────────────────────┘
```

**要点**：4 个阶段的 yield 顺序固定，前端靠 `event.type` 区分。`retrieval` 和 `prompt` 阶段让用户"看见 RAG 在干什么"，是本项目可视化的核心。

---

## 5. 逐文件代码导读

### 5.1 `config/defaults.py` + `config/manager.py` — 配置系统（读代码起点）

**文件作用**：定义所有默认配置项 + JSON 持久化读写。最简单，从这里开始。

**关键结构**：

| 项                           | 位置        | 说明                                         |
| ---------------------------- | ----------- | -------------------------------------------- |
| `DEFAULT_SETTINGS`           | defaults.py | 10 项默认配置（见第 7 章表）                 |
| `DATA_DIR` / `SETTINGS_FILE` | defaults.py | 数据目录与配置文件路径常量                   |
| `get_settings()`             | manager.py  | 读存储值，与默认值合并返回（新增项向后兼容） |
| `update_settings(partial)`   | manager.py  | 部分更新，合并后整体写回                     |

**要点**：
- `manager.py` 用 `import app.config.manager as _self` 模块自引用，让 `get_settings` 读 `_self.SETTINGS_FILE`——这是为了让测试能 monkeypatch 路径变量。
- `get_settings` 先返回默认值副本，再用存储值 `update` 覆盖，保证老配置文件缺新字段时不报错。

### 5.2 `services/repo_service.py` — 仓库管理

**文件作用**：代码库的注册、查询、删除，以及 zip 上传解压、文件扫描。

**阅读顺序建议**：`_load_repos/_save_repos`（持久化基操）→ `add_repo`/`add_repo_from_upload`（两种入库方式）→ `scan_files`（扫描规则）→ `delete_repo`（清理逻辑）。

**关键函数**：

| 函数                   | 行号 | 功能                                                         |
| ---------------------- | ---- | ------------------------------------------------------------ |
| `add_repo`             | ~27  | 注册本地路径，去重(同 path 报错)，生成 8 位 repo_id          |
| `add_repo_from_upload` | ~50  | 解压 zip 到 uploads/，单顶层文件夹则用它做根                 |
| `scan_files`           | ~133 | 只收 `.py`，跳过 `.开头`/`__pycache__`/`node_modules`/`venv` |
| `delete_repo`          | ~110 | 删 repos.json 记录 + chunks.json + uploads 目录              |

**要点**：
- `scan_files` 只认 `.py`——这是"只支持 Python 代码库"的根源（已知限制）。
- `delete_repo` 清了 chunks.json 和 uploads，但**没清 ChromaDB collection**（`[注意]` 见第 10 章 Q3），会留下孤儿向量数据。

### 5.3 `services/index_service.py` — 索引核心 ⭐

**文件作用**：RAG 索引侧的全部逻辑——分块算法 + 向量化 + 入库。**这是项目最值得读的文件之一**。

**阅读顺序建议**：先读 `chunk_text`（分块算法，~26-90 行，约 20 分钟）→ 再读 `index_repo`（编排，~91-151 行）→ 最后看 `get_chunk_context`/`get_stats`（查询辅助）。

**关键函数**：

| 函数                | 行号 | 功能                                            |
| ------------------- | ---- | ----------------------------------------------- |
| `chunk_text`        | ~26  | 字符数分块 + 行边界对齐 + overlap 行号记录      |
| `index_repo`        | ~91  | 编排：scan→切块→存json→建ChromaDB→批量embed→add |
| `get_chunk_context` | ~163 | 回读源文件，返回高亮行号区间（给前端定位用）    |
| `get_stats`         | ~187 | 分块统计 + 从 ChromaDB 取 embedding 维度        |

**分块算法关键点**（`chunk_text`，~28-90）：
- 用 `line_starts[]` 记录每行起始字符偏移，`char_to_line` 把字符偏移反查成行号。
- `end_char` 先按 `chunk_size` 定，再向后找到下一个 `\n` 对齐行边界——**保证块不切在行中间**。
- overlap：下一块 `start_char = end_char - overlap`，若退步（≤start）则强制前进 `chunk_size - overlap`，防死循环。
- `chunk_id = {repo_id}/{file_path}#{chunk_index}`，这个格式被前端 `getChunkContext` 用 `%23` 编码 `#` 传参。

**要点**：
- `index_repo` 里 `batch_size=6` 分批 embed，避免一次性请求过多 token。
- collection 用 `metadata={"hnsw:space":"cosine"}`，`search_service` 会校验这个值，防 L2 旧索引混入。

### 5.4 `services/search_service.py` — 检索核心 ⭐

**文件作用**：把问题向量化，到 ChromaDB 做 cosine 检索，返回 Top-K。

**关键逻辑**（`search`，~7-60）：

| 步骤          | 行号 | 说明                                                  |
| ------------- | ---- | ----------------------------------------------------- |
| 问题向量化    | ~14  | `embed_query(query)`                                  |
| 取 collection | ~18  | 不存在则抛"请先索引"                                  |
| 距离校验      | ~25  | 非 cosine 抛错（防旧 L2 索引）                        |
| 查询          | ~33  | `n_results=min(k, total)`，避免 k 超过库容量          |
| 打分          | ~46  | `score = max(0, 1 - distance)`（distance 越小越相似） |

**要点**：返回里带 `query_embedding_preview`（前 10 维），前端用来展示"问题向量长什么样"，是可视化的细节。

### 5.5 `services/chat_service.py` — 问答核心 ⭐

**文件作用**：RAG 问答侧的全部逻辑——会话管理 + prompt 组装 + SSE 4 阶段流式。**项目最核心文件**。

**阅读顺序建议**：先读会话 CRUD（~13-70，sessions.json 持久化）→ `build_prompt`（~75-111，prompt 预览用，非流式）→ `chat_stream`（~112-181，流式主流程，对照第 4.2 节全景图读）。

**关键函数**：

| 函数              | 行号 | 功能                                                                       |
| ----------------- | ---- | -------------------------------------------------------------------------- |
| `build_prompt`    | ~75  | 检索 + 拼 context + 组 prompt_parts + 估 token（给 prompt-preview 接口用） |
| `chat_stream`     | ~112 | SSE 4 阶段异步生成器（retrieval→prompt→chunk→done）                        |
| `estimate_tokens` | ~70  | 粗估 `len(text)//4`（1 token ≈ 4 字符）                                    |

**`chat_stream` 4 阶段对照**（见第 4.2 节）：
- 阶段1 `retrieval`：调 `search_service.search`，yield 检索结果。
- 阶段2 `prompt`：拼 context（`📄 file (L行号)\n内容`），组 `prompt_parts`，yield + token 估算。
- 阶段3 `chunk`：组 messages（system + 代码上下文 system + history + user），`stream_chat` 逐 token yield；异常 yield error 并 return。
- 阶段4 `done`：拼 `full_response`，`_update_session` 追加消息（assistant 带 `rag_data` 快照，含检索结果/prompt/token），yield done。

**要点**：
- `build_prompt` 和 `chat_stream` 阶段1-2 逻辑重复（都检索+拼context）——`build_prompt` 是给"prompt 预览"接口的非流式版本。
- assistant 消息存了 `rag_data` 快照，前端能回放历史消息时重新展示当时的 RAG 过程。
- `estimate_tokens` 是粗估（chars/4），不精确（见第 10 章 Q4）。

### 5.6 `services/llm_client.py` — LLM 客户端

**文件作用**：封装 OpenAI 兼容客户端，提供同步/异步/Embedding 三套。

**关键函数**：

| 函数                                      | 说明                                                              |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `get_llm_client` / `get_async_llm_client` | 同步/异步 OpenAI 客户端，key 为空时用占位符                       |
| `get_embedding_client`                    | Embedding 客户端，key 回退 `llm_api_key`，url 回退 `llm_base_url` |
| `embed_texts` / `embed_query`             | 批量/单个向量化                                                   |
| `stream_chat`                             | 异步流式聊天，逐 token yield，finally 关闭 stream                 |

**要点**：`get_embedding_client` 的回退逻辑让"LLM 和 Embedding 用同一套 key/url"也能工作——只需配 LLM 三项即可跑通。

### 5.7 `api/` 五个路由文件 — HTTP 薄层

**文件作用**：FastAPI 路由，只做参数校验（Pydantic Model）+ 转调 service + 异常转 HTTPException。**全部很薄，快速过一遍即可**。

| 文件          | 路由前缀          | 核心接口                                                          |
| ------------- | ----------------- | ----------------------------------------------------------------- |
| `repos.py`    | `/api/repos`      | POST /(upload)/ GET / DELETE /{id}/ POST index / GET index/status |
| `chunks.py`   | `/api/repos/{id}` | GET /chunks / GET /chunks/{cid}/context / GET /stats              |
| `search.py`   | `/api/search`     | POST /（query+repo_id+top_k）                                     |
| `chat.py`     | `/api/chat`       | POST /prompt-preview / POST /(SSE) / sessions CRUD                |
| `settings.py` | `/api`            | GET /settings(脱敏) / PUT /settings / GET /health                 |

**要点**：
- `chat.py` 的 `chat_sse` 是唯一异步路由（SSE 流式），用 `StreamingResponse`。
- `settings.py` GET 接口把 api_key 前 8 位 + `****` 脱敏；PUT 时过滤掉含 `****` 的字段（前端占位符不覆盖真实 key）。
- `repos.py` 的 `trigger_index` 用 `BackgroundTasks` 异步执行索引，立即返回 202。

### 5.8 `main.py` — FastAPI 入口

**文件作用**：创建 app、加 CORS（全开）、挂 5 个 router 到 `/api`。21 行，最简单。

### 5.9 前端 `App.tsx` — 路由与布局根

**文件作用**：`TooltipProvider` + `Routes`（6 条路由）+ `Layout` + `Toaster`。所有页面套在 `Layout` 里：桌面端固定 256px 侧边栏，移动端收成汉堡抽屉（`AnimatePresence` 滑入滑出）。

**路由表**：`/`(概览) → `/repos`(仓库列表) → `/repos/:repoId`(仓库详情) → `/chat` + `/chat/:sessionId`(AI 对话，复用同一组件) → `/search`(搜索试验场) → `/settings`(设置)。

**要点**：`useTheme` 默认 dark 并从 localStorage 恢复，主题 class 挂在 `<html>` 上，Tailwind v4 用 `@custom-variant dark` 实现 class 式暗色切换（而非跟随系统）。

### 5.10 前端 `lib/api.ts` — API 封装 ⭐

**文件作用**：所有后端调用的封装层。统一 `request<T>`（错误时提取 FastAPI 的 `detail` 字段）+ 4 大模块（repos/chunks/chat/search/settings）+ `api.chat.stream` SSE 解析。

**阅读顺序建议**：`request`（通用 fetch 封装，~10-40）→ 各模块方法（~45-190）→ `chat.stream`（SSE AsyncGenerator，~130-175，重点）。

**`chat.stream` SSE 解析关键**：
- 用 `fetch` + `POST` 拿 `ReadableStream`（`EventSource` 不支持 POST，这是必须手动解析的原因）。
- `getReader()` + `TextDecoder` 边读边解码，用 `buffer` 缓冲不完整帧，按 `\n\n` 切帧。
- 每帧取 `data: ` 开头的行 `JSON.parse`，`yield` 成 `ChatStreamEvent`——调用方用 `for await...of` 消费。
- 前端 ChatPage 里用不可变更新把事件落到消息气泡（retrieval/prompt 存进 `rag_data`，chunk 追加文本流）。

**要点**：`api.chunks.context` 会把 chunk_id 里的 `#` 编码成 `%23`（防 URL fragment 截断），但保留 `/`（让 FastAPI `{chunk_id:path}` 能捕获完整路径）——这是 chunk_id 格式决定的细节。zip 上传用 `FormData`（不手动设 Content-Type，浏览器自动加 boundary）；DELETE 204 无 body 单独处理。

### 5.11 前端 `pages/` + `components/` — UI 层

| 文件                             | 行数    | 作用                                                |
| -------------------------------- | ------- | --------------------------------------------------- |
| `pages/ChatPage.tsx`             | ~600    | 🔑 消费 SSE 流 + 会话侧边栏 + RAG 过程抽屉（最大文件） |
| `pages/ReposPage.tsx`            | ~330    | 仓库管理（列表/zip上传/本地路径/触发索引/轮询/删除） |
| `pages/RepoDetailPage.tsx`       | ~300    | 统计卡片 + 文件分布 + 分块分页 + 源码上下文 Dialog   |
| `pages/SearchPage.tsx`           | ~280    | 搜索试验场（检索结果/Prompt 预览/向量预览 三 Tab）  |
| `pages/SettingsPage.tsx`         | ~230    | 设置表单（LLM/Embedding/超参/System Prompt 分组）   |
| `pages/HomePage.tsx`             | ~150    | 概览：能力卡片 + RAG 流程说明 + 快捷入口            |
| `components/CodeBlock.tsx`       | ~90     | 语法高亮 + 行号 + 区间高亮（react-syntax-highlighter）|
| `components/StatusBadge.tsx`     | ~45     | 索引四态徽章（待索引/索引中/已索引/失败）           |
| `components/ScoreBar.tsx`        | ~30     | 相似度分数条（0-100%，颜色随分数变化）              |
| `components/Layout/Sidebar/TopBar.tsx` | ~190 | 应用壳：响应式布局 + 导航 + 主题/健康状态           |
| `components/ui/*.tsx`            | 11 个   | shadcn 风格基础组件（button/card/dialog/toast/select 等）|
| `types/index.ts`                 | ~120    | 全局 TS 类型（Repo/Chunk/Session/Settings/SSE 事件） |

**要点**：`ChatPage.tsx` 是前端核心，建议配合第 4.2 节流程图读——`handleSend` 里乐观追加 user+assistant 两条消息，再 `for await` 消费 SSE 事件，用 `updateLast` 不可变更新最后一条 assistant 消息（打字机效果）。点 assistant 消息下的"检索到 N 个代码片段"可打开 RAG 过程抽屉（检索结果 + prompt 四大组成）。

---

## 6. 关键设计模式解析

### 6.1 字符分块 + 行边界对齐

```
源码文本 → 按 chunk_size 字符切 → end_char 向后扩到下一个 \n → 记录行号
                ↓ (overlap)
        下一块 start_char = end_char - overlap
```

**意图**：代码有强行边界语义，不能把一行从中间切断（否则检索到的块语义残缺）。先按字符数定大致位置，再向后扩到行尾，既控制块大小又保证块完整。

### 6.2 SSE 4 阶段流式（检索→prompt→生成→持久化）

```
后端 chat_stream 异步生成器
  ├── yield retrieval  (检索结果，让用户看见"找到了哪些块")
  ├── yield prompt     (拼好的提示词 + token 估算)
  ├── yield chunk × N  (LLM 逐 token，前端实时渲染)
  └── yield done       (持久化会话)
```

**意图**：把 RAG 黑盒拆成可见阶段。用户不只看到最终回答，还能看见"检索到什么、prompt 长什么样、token 估算多少"——这是本项目"RAG 可视化"的核心卖点。

### 6.3 配置默认值 + 存储值合并（向后兼容）

```python
# manager.py get_settings
result = dict(DEFAULT_SETTINGS)   # 先拷默认值
result.update(stored)             # 再用存储值覆盖
```

**意图**：新增配置项时，老用户的 settings.json 缺新字段，合并后自动用默认值填充，不报错、不需迁移。

### 6.4 JSON 文件持久化（无独立数据库）

| 数据       | 文件                            |
| ---------- | ------------------------------- |
| 仓库元数据 | `data/repos.json`               |
| 会话消息   | `data/sessions.json`            |
| 全局设置   | `data/settings.json`            |
| 分块内容   | `data/{repo_id}_chunks.json`    |
| 向量索引   | `data/chroma/`（ChromaDB 落盘） |

**意图**：教学/原型项目零依赖部署，不引入 SQLite/Postgres。代价是并发写不安全（见第 10 章 Q5）。

### 6.5 Embedding 客户端回退

```python
key = s["embedding_api_key"] or s["llm_api_key"] or "sk-placeholder"
base_url = s["embedding_base_url"] or s["llm_base_url"]
```

**意图**：允许"LLM 和 Embedding 用同一套 key/url"（很多 OpenAI 兼容服务如此），降低配置门槛——只配 LLM 三项即可跑通。

---

## 7. 配置系统详解

### 7.1 配置项清单（`defaults.py` DEFAULT_SETTINGS）

| 配置项               | 默认值                      | 说明                                    |
| -------------------- | --------------------------- | --------------------------------------- |
| `llm_api_key`        | `""`                        | LLM API 密钥（GET 接口脱敏）            |
| `llm_base_url`       | `https://api.openai.com/v1` | LLM 基址（OpenAI 兼容）                 |
| `llm_model`          | `gpt-4o`                    | 对话模型                                |
| `embedding_api_key`  | `""`                        | Embedding 密钥（空则回退 llm_api_key）  |
| `embedding_base_url` | `https://api.openai.com/v1` | Embedding 基址（空则回退 llm_base_url） |
| `embedding_model`    | `text-embedding-3-small`    | 向量化模型                              |
| `chunk_size`         | `1000`                      | 分块字符数                              |
| `chunk_overlap`      | `200`                       | 分块重叠字符数                          |
| `top_k`              | `5`                         | 检索返回块数                            |
| `system_prompt`      | （代码助手提示词）          | 系统提示词                              |

### 7.2 加载与更新流程

```
get_settings():  DEFAULT_SETTINGS ←合并← settings.json 存储值
update_settings(partial):  当前值 ←合并← partial → 整体写回 settings.json
```

**优先级**：存储值 > 默认值（存储值覆盖默认值；未存储的字段用默认值）。

**API 脱敏**：`GET /settings` 把 api_key 显示为 `前8位****`；`PUT /settings` 过滤掉含 `****` 的字段（前端占位符不会覆盖真实 key）。

---

## 8. 如何运行和测试

### 8.1 配置依赖环境

```

# 1. 创建虚拟环境（Python >= 3.11）
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置环境变量
填写.env文件
```

### 8.2 后端

```bash
# 1. 进入项目根目录
cd backend

# 4. 启动后端（默认 8000 端口）
python -m uvicorn app.main:app --reload
```

启动后：
- API 基址：`http://127.0.0.1:8000`
- 健康检查：`GET http://127.0.0.1:8000/api/health`
- 交互文档：`http://127.0.0.1:8000/docs`

### 8.3 前端

```bash
# 1. 进入前端目录
cd frontend

# 2. 安装依赖
npm install

# 3. 启动开发服务器（Vite，默认 5173）
npm run dev
```

`vite.config.ts` 已配置 `/api` 代理到后端 `127.0.0.1:8000`（**注意用 IPv4 地址**：Node 把 `localhost` 解析成 IPv6 `::1`，而 uvicorn 只监听 IPv4，写 localhost 会报 `ECONNREFUSED ::1:8000`），前端直接访问 `http://localhost:5173`。

### 8.4 首次使用流程

1. 打开前端 →「系统设置」填 LLM API Key（兼容 OpenAI 的服务均可）→ 保存。
2.「仓库管理」上传 zip 或指定本地代码库路径 → 点「建立索引」。
3. 轮询索引状态变 `indexed` 后，去「语义搜索」或「AI 对话」使用。

### 8.4 测试

```bash
# 后端测试（pytest）
cd backend
pytest
```

---

## 9. 复刻建议与学习路线

### 9.1 推荐阅读顺序

```
第 1 步：config/defaults.py + manager.py  → 理解配置（约 10 分钟）
第 2 步：services/repo_service.py         → 理解仓库管理与扫描（约 15 分钟）
第 3 步：services/index_service.py        → 理解分块算法（约 25 分钟，重点）
第 4 步：services/search_service.py       → 理解向量检索（约 10 分钟）
第 5 步：services/chat_service.py         → 理解 SSE 4 阶段（约 30 分钟，核心）
第 6 步：api/ 五个路由 + main.py          → 理解 HTTP 层（约 15 分钟）
第 7 步：前端 lib/api.ts + ChatPage.tsx       → 理解 SSE 消费（约 30 分钟）
```

### 9.2 复刻路线建议

**阶段 1：最小索引 + 检索（1-2 天）**
- 后端：repo 注册 + 字符分块 + ChromaDB 入库 + cosine 检索
- 跳过会话/SSE，先用同步接口返回检索结果

**阶段 2：接入 LLM 问答（1-2 天）**
- 加 `llm_client` + `build_prompt` + 同步 `/chat` 接口
- 前端先做搜索页 + 简单问答页

**阶段 3：SSE 流式 + 会话（2-3 天）**
- 改 `chat_stream` 为异步生成器 + 4 阶段 yield
- 前端 `chatStream` 手动解析 SSE + 会话持久化
- 加 RAG 过程可视化面板

**阶段 4：工程化增强（3-5 天）**
- 设置页（运行时改模型/分块参数）
- 分块探查页 + 源码定位
- 索引后台任务 + 状态轮询

### 9.3 进阶方向（当前项目的已知短板）

| 方向       | 现状                      | 改进                                         |
| ---------- | ------------------------- | -------------------------------------------- |
| 分块策略   | 字符数切                  | AST 分块（按函数/类切，代码 RAG 核心差异点） |
| 检索       | 纯向量                    | 混合检索（BM25 + 向量）+ Rerank 重排         |
| 多语言     | 只扫 .py                  | 扩展 JS/TS/Go/Java 等扩展名                  |
| 持久化     | JSON 文件                 | SQLite/Postgres（并发安全）                  |
| Token 估算 | chars/4 粗估              | tiktoken 精确估算 + 历史截断                 |
| 删除一致性 | delete_repo 漏清 ChromaDB | 补 `client.delete_collection`                |

### 9.4 关键技术栈学习资源

| 技术              | 资源                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| FastAPI           | [官方文档](https://fastapi.tiangolo.com/)                                                 |
| ChromaDB          | [官方文档](https://docs.trychroma.com/)                                                   |
| OpenAI Embeddings | [官方文档](https://platform.openai.com/docs/guides/embeddings)                            |
| SSE（MDN）        | [Server-Sent Events](https://developer.mozilla.org/zh-CN/docs/Web/API/Server-sent_events) |
| React + Vite      | [Vite 官方指南](https://vitejs.dev/guide/)                                                |
| Tailwind CSS      | [官方文档](https://tailwindcss.com/docs)                                                  |

---

## 10. 常见问题

### Q1: 为什么只支持 Python 代码库？

`repo_service.scan_files` 只收 `.py` 文件（见 ~133 行）。要支持其他语言，改 `scan_files` 的扩展名过滤即可，分块和索引逻辑语言无关。

### Q2: 检索的 score 是怎么算的？

`search_service.search` 里 `score = max(0, 1 - distance)`。ChromaDB 用 cosine 距离（distance ∈ [0,2]），distance 越小越相似，所以 `1 - distance` 越大越相似。distance=0 时 score=1（完全相似）。

### Q3: 删除仓库后向量数据会残留吗？

**会**。`repo_service.delete_repo` 清了 `chunks.json` 和 `uploads/` 目录，但**没调 `chromadb` 的 `delete_collection`**，会在 `data/chroma/` 留下孤儿 collection。这是个已知缺陷（代码里已用 `[注意]` 标注），复刻时建议补上。

### Q4: token 估算准吗？

不准。`estimate_tokens` 用 `len(text) // 4`（1 token ≈ 4 字符）粗估，中文代码注释会严重低估。要精确需用 `tiktoken` 库按模型分词。

### Q5: 多人同时用会出问题吗？

会。所有持久化用 JSON 文件 + 全量读写（`_load` → 改 → `_save`），无文件锁，并发写会丢更新。教学项目单人用没问题，生产场景需换数据库。

### Q6: `build_prompt` 和 `chat_stream` 阶段1-2 为什么逻辑重复？

`build_prompt` 是给 `/chat/prompt-preview` 接口的非流式版本（用户提问前预览 prompt），`chat_stream` 是真正流式问答。两者都做"检索+拼context"，`chat_stream` 没复用 `build_prompt` 是因为流式里要分阶段 yield。可重构抽取公共部分。

### Q7: 前端怎么消费 SSE？为什么不用 EventSource？

用 `fetch` + `ReadableStream` 手动解析（见 `lib/api.ts` 的 `api.chat.stream`）。因为 `EventSource` 只支持 GET 请求，而本项目 `/chat` 是 POST（要传 message body），所以只能用 fetch + `getReader()` 手动按 `\n\n` 切帧解析 `data: ` 行，用 AsyncGenerator 逐条 `yield`。

### Q8: `chunk_id` 里的 `#` 为什么要编码？

`chunk_id` 格式是 `{repo_id}/{file_path}#{chunk_index}`。URL 里 `#` 是 fragment 分隔符，不编码会被浏览器截断。前端 `lib/api.ts` 的 `api.chunks.context` 把 `#` 替换成 `%23`，但保留 `/`（让 FastAPI `{chunk_id:path}` 能捕获完整路径）。

---

## 附录：关键术语对照表

| 英文              | 中文           | 说明                            |
| ----------------- | -------------- | ------------------------------- |
| RAG               | 检索增强生成   | 先检索相关片段再交给 LLM 生成   |
| Embedding         | 向量化/嵌入    | 文本转向量，语义相近向量相近    |
| ChromaDB          | 向量数据库     | 存向量、做相似度检索            |
| Chunk             | 代码块         | 分块算法切出的代码片段          |
| Cosine Similarity | 余弦相似度     | 向量夹角余弦，衡量语义相似度    |
| SSE               | 服务器发送事件 | HTTP 长连接流式推送             |
| Top-K             | 前 K 个        | 检索返回最相似的 K 个结果       |
| Collection        | 集合           | ChromaDB 里一个代码库的向量集合 |
| Overlap           | 重叠           | 相邻块共享的字符数，防语义断裂  |
| BackgroundTasks   | 后台任务       | FastAPI 异步执行索引的机制      |
| StreamingResponse | 流式响应       | FastAPI 返回 SSE 的响应类型     |
| Token             | 词元           | LLM 计费/上下文长度的单位       |
