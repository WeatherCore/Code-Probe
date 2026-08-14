###################
# Chunk Routes — 分块数据出口（HTTP 层）
# 前端"分块探查"页的数据来源：列出一个仓库切出的所有代码块、某个块在源文件里的
# 上下文（前端高亮定位用）、以及索引统计。直接转发 index_service 的结果，没有业务逻辑。
###################

from fastapi import APIRouter, HTTPException
from app.services import index_service

# 分块路由：查看已建索引的代码块、定位块在源文件的位置、看索引统计。
# 给前端的"分块探查"页用——让用户看见代码被切成什么样了。
router = APIRouter()


@router.get("/repos/{repo_id}/chunks")
def list_chunks(repo_id: str):
    # list_chunks（列出分块）：返回某仓库全部分块，前端分页/浏览用。
    chunks = index_service.get_chunks(repo_id)
    return {"total": len(chunks), "chunks": chunks}


@router.get("/repos/{repo_id}/chunks/{chunk_id:path}/context")
def chunk_context(repo_id: str, chunk_id: str):
    # chunk_context（块上下文）：回读源文件，返回该块在源文件中的高亮行号区间。
    # 给前端"源码定位"用——点某个检索结果能跳到源文件对应行。
    # 路由用 {chunk_id:path} 是因为 chunk_id 格式是 "repo_id/file_path#index"，含 / 和 #。
    try:
        return index_service.get_chunk_context(repo_id, chunk_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/repos/{repo_id}/stats")
def repo_stats(repo_id: str):
    # repo_stats（索引统计）：分块总数、文件分布、embedding 维度、分块参数等，
    # 给前端展示"这个库索引成了什么样"。
    return index_service.get_stats(repo_id)
