# CodeProbe · 代码库智能检索问答系统

## 它是干什么的
面对一个陌生代码库（比如刚接手的老项目、开源仓库、或者自己几个月前写的代码），想搞懂「某个功能在哪实现」「这段逻辑为什么这么写」「这个函数被谁调用」，传统做法是全文搜索 + 逐文件翻 + 靠脑子拼凑上下文，效率低且容易迷路。

CodeProbe 把这事变成对话：你用自然语言提问，它先用语义检索从整个代码库里捞出最相关的代码片段，再交给大模型基于这些片段组织答案，回答里直接带「文件路径 + 行号」引用，点开就能看到对应代码。本质是把 RAG（检索增强生成）从「文档问答」搬到了「代码问答」场景。

## 核心能力

- **代码库接入** —  支持本地路径添加或 ZIP 上传，自动递归扫描 .py 文件，跳过 __pycache__、.venv、node_modules 等噪声目录
- **智能分块** — 按字符数切分但对齐到行边界（不会把一行代码腰斩），支持相邻块重叠（overlap），避免函数被切断导致语义丢失
- **向量检索** — ChromaDB 存储 + 余弦相似度搜索，构建可语义检索的索引库
- **RAG 对话** — 提问时：检索 top-k 相关片段 → 组装 system prompt + 代码上下文 + 历史对话 → 大模型流式生成回答 → 引用文件路径和行号
- **分块可视化** — 单独查看任意代码块在原文件中的精确位置和高亮，理解索引粒度
- **检索过程回溯** — 每轮回答旁边能展开看到：检索到了哪几个 chunk、相似度分数、实际发给 LLM 的完整 Prompt、token 消耗估算。把 RAG 的黑盒拆开给你看

## 技术栈

| 层        | 技术                                    |
| --------- | --------------------------------------- |
| 前端      | React 18 + TypeScript + Vite + Tailwind |
| 后端      | FastAPI + Uvicorn                       |
| 向量库    | ChromaDB (cosine)                       |
| LLM       | OpenAI 兼容 API (可配置)                |
| Embedding | text-embedding-3-small (可配置)         |

## 项目结构

```
CodeProbe/
├── backend/                        # ===== Python 后端 =====
│   ├── app/
│   │   ├── main.py                # FastAPI 应用入口，注册路由 & CORS
│   │   ├── api/                   # API 路由层（Controller）
│   │   │   ├── chat.py            # 聊天 & 会话管理接口
│   │   │   ├── chunks.py          # 代码块浏览接口
│   │   │   ├── repos.py           # 仓库管理接口
│   │   │   ├── search.py          # 向量搜索接口
│   │   │   └── settings.py        # 系统配置接口
│   │   ├── services/              # 业务逻辑层（Service）
│   │   │   ├── chat_service.py    # 会话管理 + RAG 流式问答
│   │   │   ├── index_service.py   # 代码分块 + ChromaDB 索引
│   │   │   ├── llm_client.py      # LLM & Embedding 客户端
│   │   │   ├── repo_service.py    # 仓库 CRUD + 文件扫描
│   │   │   └── search_service.py  # 向量相似度检索
│   │   └── config/                # 配置管理
│   │       ├── defaults.py        # 默认配置项定义
│   │       └── manager.py         # 配置持久化（JSON 读写）
│   ├── data/                      # 持久化数据目录
│   │   ├── settings.json          # 用户配置（API Key、模型、参数）
│   │   ├── repos.json             # 仓库元数据
│   │   ├── sessions.json          # 聊天会话历史
│   │   ├── {repo_id}_chunks.json  # 各仓库的代码块数据
│   │   ├── chroma/                # ChromaDB 向量存储
│   │   └── uploads/               # 上传的 ZIP 解压目录
│   ├── requirements.txt           # Python 依赖清单
│   └── .venv/                     # Python 虚拟环境
│
├── frontend/                       # ===== React 前端 =====
│   ├── src/
│   │   ├── main.tsx               # React 入口，挂载根组件
│   │   ├── App.tsx                # 主应用：路由 + 导航栏 + 主题切换
│   │   ├── index.css              # Tailwind 配置 + 暗色模式 CSS 变量
│   │   ├── pages/                 # 页面组件
│   │   │   ├── ChatPage.tsx       # 💬 主聊天界面（含 RAG 抽屉）
│   │   │   ├── RepoManager.tsx    # 📦 仓库管理（添加/删除/索引）
│   │   │   ├── ChunksExplorer.tsx # 🔍 代码块浏览器
│   │   │   ├── SearchPlayground.tsx # 🧪 向量搜索测试台
│   │   │   └── SettingsPage.tsx   # ⚙️ 系统配置页
│   │   ├── components/            # 可复用组件
│   │   │   ├── MarkdownMessage.tsx # Markdown 渲染（代码高亮 + 折叠）
│   │   │   ├── RagDrawer.tsx      # RAG 过程可视化抽屉
│   │   │   └── RagPanel.tsx       # RAG 面板（旧版，保留兼容）
│   │   ├── services/
│   │   │   └── api.ts             # HTTP 客户端（封装所有后端 API 调用）
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript 类型定义
│   │   └── lib/
│   │       └── utils.ts           # 工具函数（className 合并）
│   ├── public/
│   │   └── logo.png               # 应用 Logo
│   ├── index.html                 # HTML 入口
│   ├── package.json               # Node 依赖 & 脚本
│   ├── vite.config.ts             # Vite 配置（含 API 代理）
│   ├── tailwind.config.js         # Tailwind 配置
│   ├── tsconfig.json              # TypeScript 配置
│   └── postcss.config.js          # PostCSS 配置
│
├── scripts/                        # ===== 启动脚本 =====
│   ├── start-macos-linux.sh       # macOS/Linux 一键启动
│   └── start-windows.bat          # Windows 一键启动
│
├── docs/                           # ===== 文档 =====
│   └── plans/                     # 设计文档 & 实现计划
│
└── README.md                       # 项目说明文档
```

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+

### 一键启动

#### 后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

#### 前端

```bash
cd frontend
npm install
npm run dev
```

启动后访问：
- **前端界面**: http://localhost:5173
- **后端 API**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs

> 💡 **提示**: 首次启动后，请先在「设置」页面配置 LLM 和 Embedding 的 API Key。


## 使用流程

1. **配置模型** — 在「设置」页面填入 LLM 和 Embedding 的 API Key、Base URL、模型名
2. **添加代码库** — 在「代码库管理」页面输入本地路径或上传 ZIP 文件
3. **索引代码** — 点击「开始索引」，等待分块和向量化完成
4. **开始对话** — 在「对话」页面新建会话，向代码库提问
5. **查看检索过程** — 点击 assistant 消息下方的「检索过程」按钮，右侧面板展示 RAG 细节

## API 端点

| 方法    | 路径                                | 描述            |
| ------- | ----------------------------------- | --------------- |
| POST    | `/api/repos`                        | 添加本地代码库  |
| POST    | `/api/repos/upload`                 | 上传 ZIP 代码库 |
| GET     | `/api/repos`                        | 列出所有代码库  |
| DELETE  | `/api/repos/{repo_id}`              | 删除代码库      |
| POST    | `/api/repos/{repo_id}/index`        | 触发索引        |
| GET     | `/api/repos/{repo_id}/index/status` | 查询索引状态    |
| POST    | `/api/search`                       | 向量检索        |
| POST    | `/api/chat`                         | 流式对话 (SSE)  |
| GET     | `/api/chat/sessions`                | 列出会话        |
| GET/PUT | `/api/settings`                     | 读取/更新配置   |

## 📌 当前局限与后续迭代计划

本项目作为 **RAG 检索原型系统**，已实现核心向量索引与检索流程，但在生产级场景下仍有明显短板。以下列出已知局限及对应的工程化解决方案（已列入后续迭代优先级）：

### 1. 分块策略过于粗放 ⭐ 最高优先级
- **现状**：仅按固定字符数（如 512/1024）硬截断，未考虑代码语义边界。
- **影响**：对**代码型 RAG**，函数/类被切断会导致检索出的片段缺失完整上下文，LLM 难以理解逻辑。
- **改进方向**：
  - 引入 **AST 语法树解析**（Python 用 `ast`，Java 用 `javaparser`），以函数、类、方法为原子单元切分。
  - 对非代码文本采用 **语义分块（Semantic Chunker）**，利用 embedding 相似度动态调整断点。

### 2. 缺失重排（Rerank）环节
- **现状**：向量检索直接返回 Top-K 结果，未经精排即送入 LLM。
- **影响**：首轮召回可能含噪声，影响生成质量；尤其当库中相似片段较多时，简单向量距离排序并非最优。
- **改进方向**：
  - 引入 **Cross-Encoder 重排模型**（如 `BAAI/bge-reranker-base`），对候选集进行二次打分。
  - 将 Rerank 作为独立流水线，支持动态截断 Top-N。

### 3. 仅依赖向量检索，缺乏混合检索
- **现状**：只使用 FAISS 内积相似度，未融合关键词匹配（BM25 / TF-IDF）。
- **影响**：函数名、变量名等精确符号的匹配能力弱，纯向量可能漏掉精准命中的文档。
- **改进方向**：
  - 实现 **多路召回（向量 + BM25）**，结合 `Reciprocal Rank Fusion (RRF)` 或加权合并。
  - 对代码场景，可增加 **符号索引（Symbol Index）** 专门存储标识符。

### 4. 编程语言支持单一
- **现状**：目前仅支持 `.py` 文件解析，未扩展至 Java、C++、Go 等。
- **影响**：项目适用面窄，难以用于多语言代码库。
- **改进方向**：
  - 设计 **插件式解析器**，基于文件扩展名动态加载对应语言解析器（如 `tree-sitter` 通用语法树）。

### 5. 持久化方案存在性能瓶颈
- **现状**：`sessions`、`repos`、`chunks` 全部存为 JSON 文件，无并发锁、无索引。
- **影响**：多进程写入时存在数据损坏风险；JSON 全量加载，大数据量下内存占用飙升。
- **改进方向**：
  - 迁移至 **SQLite / PostgreSQL** 存储元数据，利用事务与索引。
  - 向量索引本身沿用 FAISS 二进制，只将关联 ID 存入数据库，实现松耦合。

### 6. 代码质量与工程规范问题
- **注释与实现不一致**：`index_service.py` 中注释声称 `batch_size=50`，实际代码为 `6`，易误导维护者。
- **无单元测试**：整个项目缺少自动化测试，无法保证修改后功能正确性。

### 7. 对话历史管理未做截断
- **现状**：长对话直接将全量历史拼入 Prompt，无滑动窗口或摘要。
- **影响**：容易超过 LLM 上下文窗口（尤其 8K/16K 模型）；且 `1 token ≈ 4 字符` 对中文注释不准确，可能低估实际 token 数。
- **改进方向**：
  - 实现 **对话轮次截断**（保留最近 N 轮）或 **历史摘要压缩**。
  - 引入 **tiktoken** 精确计数，按模型实际 context 长度动态裁剪。

---

### 🚀 优先级排序建议

| 优先级 | 改进项                 | 预期收益           |
| :----: | :--------------------- | :----------------- |
| **P0** | 基于 AST 的代码分块    | 检索精准度大幅提升 |
| **P0** | 增加 BM25 混合检索     | 补齐符号匹配短板   |
| **P1** | 接入 Rerank 模型       | 生成质量跃升       |
| **P1** | 替换 JSON 为关系数据库 | 支持并发与海量数据 |
| **P2** | 支持多语言解析         | 扩大适用场景       |
| **P2** | 完善测试与文档         | 工程健壮性         |

---

*上述问题将在后续版本中逐一解决，欢迎贡献代码或提出建议。*

## License

MIT
