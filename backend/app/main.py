###################
# Application Entry — 后端启动入口
# 整个后端就从这个文件启动：建 FastAPI 应用、放开跨域、把 5 个业务模块的路由
# （仓库/分块/搜索/聊天/设置）挂到 /api 下，前端所有请求都经这里分发到对应模块。
# 项目没有鉴权层，接口全裸——适合本地学习，上生产要自己补。
###################

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import repos, chunks, search, chat, settings

# 整个后端的"总入口"：创建 FastAPI 应用实例。
app = FastAPI(title="RAG Code Search API", version="2.0.0")

# CORS 全开（allow_origins=["*"]）：让前端 Vite 开发服务器（5173）能直连后端（8000）。
# 生产环境应收紧到具体前端域名，否则任意站点都能调你的接口。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5 个路由统一挂 /api 前缀，与前端 api.ts 的 BASE='/api' 对应：
#   repos    代码库 CRUD + 索引触发（后台任务）
#   chunks   分块查看 + 上下文定位 + 索引统计
#   search   语义检索（向量 Top-K）
#   chat     SSE 流式问答 + 会话管理 + prompt 预览
#   settings 设置读写（脱敏）+ 健康检查
app.include_router(repos.router, prefix="/api")
app.include_router(chunks.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
