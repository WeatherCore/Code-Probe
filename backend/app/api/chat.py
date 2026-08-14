###################
# Chat Routes — 问答对话入口（HTTP 层）
# 前端"AI 对话"页的所有请求都进这里：/chat 用 SSE 把回答逐字推给前端、
# prompt-preview 先预览"会拼出什么提示词"，外加会话的增删查。
# 真正干活的是 chat_service，这里只做参数校验、转发、把事件包装成 SSE 格式。
###################

import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services import chat_service

# 聊天路由：RAG 问答的 HTTP 入口。核心是 /chat 的 SSE 流式接口（4 阶段事件），
# 另含 prompt 预览（非流式，给"搜索试验场"页看拼好的提示词）和会话 CRUD。
router = APIRouter()


class PromptPreviewRequest(BaseModel):
    # prompt 预览请求：用户提问前先看"会检索到什么、拼出什么提示词"，不真正调用 LLM。
    message: str
    session_id: str | None = None
    repo_id: str
    top_k: int | None = None


class ChatRequest(BaseModel):
    # 真正的流式问答请求：必须带已存在的 session_id（chat_stream 会往里追加消息）。
    message: str
    session_id: str
    repo_id: str


class CreateSessionRequest(BaseModel):
    # 建会话：repo_id 可选（建会话时不一定先选仓库，但提问时必须指定）。
    repo_id: str | None = None


@router.post("/chat/prompt-preview")
def prompt_preview(req: PromptPreviewRequest):
    # prompt_preview（提示词预览）：非流式版 RAG——检索 + 拼 context + 组 prompt_parts + 估 token，
    # 但不调 LLM。给"搜索试验场"页用，让用户提问前先看检索效果和提示词长什么样。
    try:
        return chat_service.build_prompt(req.message, req.session_id, req.repo_id, req.top_k)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/chat")
async def chat_sse(req: ChatRequest):
    # chat_sse（流式问答入口）：本项目最核心的接口。
    # 用 StreamingResponse + text/event-stream 把 chat_stream 的 4 阶段事件流式推给前端：
    #   retrieval(检索结果) → prompt(提示词+token) → chunk ×N(LLM逐字) → done(持久化)
    # validate session exists before starting stream
    if not chat_service.get_session(req.session_id):
        raise HTTPException(status_code=404, detail=f"Session not found: {req.session_id}")

    async def event_generator():
        # 把每个事件 dict 序列化成 SSE 格式 "data: {...}\n\n"，前端 api.ts 的 chatStream 按 \n 切分行解析。
        async for event in chat_service.chat_stream(
            req.message, req.session_id, req.repo_id
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/chat/sessions")
def list_sessions():
    # list_sessions（会话列表）：给前端侧边栏展示历史会话用。
    return chat_service.get_sessions()


@router.post("/chat/sessions", status_code=201)
def create_session(req: CreateSessionRequest):
    # create_session（建会话）：生成 12 位 session_id，落盘 sessions.json。
    return chat_service.create_session(req.repo_id)


@router.get("/chat/sessions/{session_id}")
def get_session(session_id: str):
    # get_session（取单个会话）：回放历史消息（含 assistant 的 rag_data 快照，能还原当时的 RAG 过程）。
    session = chat_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/chat/sessions/{session_id}", status_code=204)
def delete_session(session_id: str):
    # delete_session（删会话）：从 sessions.json 移除，返回 204 无-body。
    if not chat_service.delete_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
