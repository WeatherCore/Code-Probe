<div align="center">

# 🔍 Code Probe

### 代码库智能检索问答系统 · RAG-Powered Codebase Q&A

把任意代码库变成**可以对话的知识库**——用自然语言提问，得到**带文件路径和行号**的答案，RAG 全过程透明可见。

![frontend](https://img.shields.io/badge/frontend-React%2018%20%7C%20Vite%205%20%7C%20Tailwind%20v4-10b981)
![backend](https://img.shields.io/badge/backend-FastAPI%20%7C%20Uvicorn-4f8cc9)
![vector](https://img.shields.io/badge/vector-ChromaDB%20(cosine)-eab308)
![stream](https://img.shields.io/badge/streaming-SSE%204%E9%98%B6%E6%AE%B5-ef4444)

</div>

---

## 💡 它是干什么的

面对一个陌生代码库（刚接手的老项目、开源仓库、或自己几个月前的代码），想搞懂「某个功能在哪实现」「这个函数被谁调用」「这段逻辑为什么这么写」——传统做法是全文搜索 + 逐文件翻 + 靠脑子拼上下文，效率低且容易迷路。

**Code Probe 把这事变成对话**：你用自然语言提问，系统先做语义检索从整个代码库捞出最相关的代码片段，再交给大模型基于这些真实代码组织答案，回答直接带「文件路径 + 行号」引用。本质是把 RAG（检索增强生成）从「文档问答」迁移到了「代码问答」场景。

## ✨ 核心特性

| 能力                 | 说明                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 📦 **代码库接入**     | ZIP 上传 或 本地路径直连，自动递归扫描 `.py`，跳过 `__pycache__` / `.venv` / `node_modules` 等噪声目录            |
| ✂️ **智能分块**       | 按字符数切分但对齐到**行边界**（不腰斩一行代码），相邻块带 overlap 重叠，防止函数被切断导致语义丢失               |
| 🧠 **向量检索**       | ChromaDB 持久化 + 余弦相似度 Top-K 检索，支持独立检索试验场                                                       |
| 💬 **RAG 流式对话**   | SSE 四阶段（检索 → 拼 Prompt → 逐字生成 → 持久化），回答引用文件路径 + 行号                                       |
| 🔍 **RAG 过程可视化** | 每轮回答可展开查看：检索到了哪些代码块、相似度分数、实际发给 LLM 的完整 Prompt、token 估算——把 RAG 黑盒拆开给你看 |
| 🧪 **搜索试验场**     | 不经 LLM 单独测试检索效果，含问题向量前 10 维可视化、Prompt 预览                                                  |
| 🌓 **现代化 UI**      | 深色优先 + 浅色可切，响应式布局适配桌面与移动端，流式打字机动效                                                   |

## 🏗️ 系统架构

```
┌─────────────────────────────── 前端 React (5173) ───────────────────────────────┐
│  ReposPage ── RepoDetailPage ── ChatPage ◄──SSE 流式── SearchPage ── SettingsPage │
│   ▲  ▲        │  ▲              │ ▲ RAG 抽屉(检索/prompt)                        │
│   │  └────────┼──┴──────────────┴──► lib/api.ts（19 个 endpoint 封装）            │
└───┼───────────┼──────────────────────────────────────────────────────────────────┘
    │  /api 代理 (Vite → 127.0.0.1:8000)
┌───▼───────────▼──────────────────────────────────────────────────────────────────┐
│  FastAPI (8000)  api/ 路由薄层 → services/ 业务层                                 │
│                                                                                   │
│  索引侧:  scan_files → chunk_text(行边界对齐) → Embedding → ChromaDB(cosine)      │
│  问答侧:  query → 向量检索 Top-K → 拼 prompt_parts → LLM 流式(SSE 4 阶段) → 持久化 │
│  存储侧:  repos.json / sessions.json / settings.json / {id}_chunks.json / chroma/ │
└───────────────────────────────────────────────────────────────────────────────────┘
```

## 🔍 运行流程全景图

系统有两条主流程：**索引流程**（建库）和**问答流程**（用库）。

###  索引流程（建库）

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

###  问答流程（用库，SSE 4 阶段）

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

## 🛠️ 技术栈

| 层              | 技术                                                                         |
| --------------- | ---------------------------------------------------------------------------- |
| 前端            | React 18 · TypeScript 5 · Vite 5 · Tailwind CSS v4 · Motion · Phosphor Icons |
| 后端            | FastAPI · Uvicorn · Pydantic                                                 |
| 向量库          | ChromaDB（cosine 距离，PersistentClient 落盘）                               |
| LLM / Embedding | OpenAI 兼容 API（DeepSeek / DashScope / OpenAI 等均可，可配置）              |

## 📁 项目结构

```
Code-Probe/
│
├── backend/                           # 🐍 Python 后端
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
├── frontend/                          # ⚛️ React 前端 + Vite 5 + TS + Tailwind v4
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

## 🚀 快速开始

### 前置要求

- Python ≥ 3.11
- Node.js ≥ 18
- 一个 OpenAI 兼容的 LLM / Embedding API（如 OpenAI、DeepSeek、阿里云 DashScope）

### 1. 相关环境

```bash
# 创建虚拟环境并安装依赖
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

pip install -r requirements.txt

# 配置环境变量
cp .env.example .env            # 填入你的相关 API Key
```

### 2. 后端

```bash
# 启动（默认 8000 端口）
cd backend

python -m uvicorn app.main:app --reload
```

### 3. 前端

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

> 前端 `vite.config.ts` 已配置 `/api` 代理到后端，无需额外跨域配置。

### 3. 开始使用

1. 打开「设置」填写模型配置（LLM + Embedding，兼容 OpenAI 格式）
2. 「仓库管理」添加代码库（上传 zip 或指定本地路径）→ 点击**建立索引**
3. 等待状态变为 `已索引`，即可在「AI 对话」中提问，或在「搜索试验场」单独测试检索

## ⚙️ 配置说明

所有配置通过 `.env`（或运行时「设置」页）管理：

| 变量                                                           | 说明                    |
| -------------------------------------------------------------- | ----------------------- |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`                   | 对话模型（OpenAI 兼容） |
| `EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` | 向量模型（OpenAI 兼容） |
| `CHUNK_SIZE` / `CHUNK_OVERLAP`                                 | 分块字符数 / 重叠字符数 |
| `TOP_K`                                                        | 检索返回片段数          |

## 🖥️ 界面一览

| 页面         | 功能                                                                |
| ------------ | ------------------------------------------------------------------- |
| 🏠 概览       | 项目能力卡片 + RAG 流程说明                                         |
| 📦 仓库管理   | 列表、zip 上传 / 本地路径导入、触发索引、状态轮询                   |
| 📊 仓库详情   | 索引统计、文件分布、分块分页浏览、源码上下文高亮定位                |
| 💬 AI 对话    | 会话管理 + SSE 流式问答 + RAG 过程抽屉（检索结果 / Prompt / token） |
| 🧪 搜索试验场 | 语义检索 + Prompt 预览 + 问题向量可视化                             |
| ⚙️ 设置       | 模型 / 分块 / 检索参数运行时配置                                    |

## 📚 文档

- [**ZHIDAO.md**](ZHIDAO.md) — 10 章项目导读：架构解析、逐文件导读、阅读顺序、常见问题（复刻本项目建议先读）
- [docs/](docs/) — 设计文档

## 📄 License

[MIT](LICENSE)
