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

| 能力 | 说明 |
| --- | --- |
| 📦 **代码库接入** | ZIP 上传 或 本地路径直连，自动递归扫描 `.py`，跳过 `__pycache__` / `.venv` / `node_modules` 等噪声目录 |
| ✂️ **智能分块** | 按字符数切分但对齐到**行边界**（不腰斩一行代码），相邻块带 overlap 重叠，防止函数被切断导致语义丢失 |
| 🧠 **向量检索** | ChromaDB 持久化 + 余弦相似度 Top-K 检索，支持独立检索试验场 |
| 💬 **RAG 流式对话** | SSE 四阶段（检索 → 拼 Prompt → 逐字生成 → 持久化），回答引用文件路径 + 行号 |
| 🔍 **RAG 过程可视化** | 每轮回答可展开查看：检索到了哪些代码块、相似度分数、实际发给 LLM 的完整 Prompt、token 估算——把 RAG 黑盒拆开给你看 |
| 🧪 **搜索试验场** | 不经 LLM 单独测试检索效果，含问题向量前 10 维可视化、Prompt 预览 |
| 🌓 **现代化 UI** | 深色优先 + 浅色可切，响应式布局适配桌面与移动端，流式打字机动效 |

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

## 🛠️ 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18 · TypeScript 5 · Vite 5 · Tailwind CSS v4 · Motion · Phosphor Icons |
| 后端 | FastAPI · Uvicorn · Pydantic |
| 向量库 | ChromaDB（cosine 距离，PersistentClient 落盘） |
| LLM / Embedding | OpenAI 兼容 API（DeepSeek / DashScope / OpenAI 等均可，可配置） |

## 📁 项目结构

```
Code-Probe/
├── backend/                       # 🐍 Python 后端
│   ├── app/
│   │   ├── main.py               # FastAPI 入口（CORS + 5 个路由挂载）
│   │   ├── api/                  # HTTP 路由薄层（repos/chunks/search/chat/settings）
│   │   ├── services/             # 业务核心
│   │   │   ├── index_service.py  # 🔑 分块 + 向量化 + ChromaDB 入库
│   │   │   ├── search_service.py # 🔑 余弦相似度检索
│   │   │   ├── chat_service.py   # 🔑 SSE 4 阶段流式问答 + 会话
│   │   │   ├── repo_service.py   # 仓库 CRUD + zip 解压 + 扫描
│   │   │   └── llm_client.py     # OpenAI 兼容客户端
│   │   └── config/               # defaults.py + manager.py（配置持久化）
│   └── requirements.txt
│
├── frontend/                      # ⚛️ React 前端
│   └── src/
│       ├── pages/                # Home / Repos / RepoDetail / Chat / Search / Settings
│       ├── components/           # CodeBlock / StatusBadge / ScoreBar / Layout 等
│       ├── components/ui/        # shadcn 风格基础组件（11 个）
│       ├── lib/api.ts            # 🔑 19 个 endpoint 封装 + SSE 解析
│       ├── hooks/                # useToast / useTheme
│       └── types/index.ts        # TS 类型契约
│
├── ZHIDAO.md                      # 📖 10 章项目导读（强烈推荐先读）
├── .env.example                   # 配置模板
└── requirements.txt
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
cp .env.example .env            # 填入你的 API Key
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

| 变量 | 说明 |
| --- | --- |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | 对话模型（OpenAI 兼容） |
| `EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` | 向量模型（OpenAI 兼容） |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | 分块字符数 / 重叠字符数 |
| `TOP_K` | 检索返回片段数 |

## 🖥️ 界面一览

| 页面 | 功能 |
| --- | --- |
| 🏠 概览 | 项目能力卡片 + RAG 流程说明 |
| 📦 仓库管理 | 列表、zip 上传 / 本地路径导入、触发索引、状态轮询 |
| 📊 仓库详情 | 索引统计、文件分布、分块分页浏览、源码上下文高亮定位 |
| 💬 AI 对话 | 会话管理 + SSE 流式问答 + RAG 过程抽屉（检索结果 / Prompt / token） |
| 🧪 搜索试验场 | 语义检索 + Prompt 预览 + 问题向量可视化 |
| ⚙️ 设置 | 模型 / 分块 / 检索参数运行时配置 |

## 📚 文档

- [**ZHIDAO.md**](ZHIDAO.md) — 10 章项目导读：架构解析、逐文件导读、阅读顺序、常见问题（复刻本项目建议先读）
- [docs/](docs/) — 设计文档

## 📄 License

[MIT](LICENSE)
