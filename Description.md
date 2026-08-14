# Description

## 中文版

Code Probe 是基于全栈 RAG 的代码库检索增强问答系统，把任意代码库变成可自然语言提问的知识库。支持上传 ZIP 或指定本地路径导入代码，按行边界对齐分块、Embedding 向量化后存入 ChromaDB，提问时做余弦相似度 Top-K 检索，交给 LLM 流式生成带文件路径与行号的回答，并通过 SSE 四阶段事件把检索、Prompt 拼装、token 估算全程可视化。后端基于 FastAPI 与 OpenAI 兼容客户端构建，前端采用 React 18 + Vite + Tailwind CSS，深色优先响应式界面。适用于代码库智能问答、代码 RAG 学习与团队内部知识检索场景。

## English

Code Probe turns codebases into queryable knowledge bases via RAG. Code is chunked with line-boundary alignment, embedded into ChromaDB, and retrieved by cosine similarity to stream LLM answers with file-path citations; a 4-stage SSE flow visualizes retrieval and prompts. Built on FastAPI and a React + Vite + Tailwind UI.
