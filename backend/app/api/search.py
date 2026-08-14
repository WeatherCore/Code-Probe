###################
# Search Route — 语义检索接口（HTTP 层）
# 只做一件事：接收"问题 + 仓库"，转给 search_service 做向量检索，返回最相似的几段代码。
# 给前端"语义搜索"试验场用——不经过 LLM，纯粹看检索命中得怎么样。
###################

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import search_service

# 搜索路由：语义检索入口。把问题向量化后在 ChromaDB 做 cosine Top-K 检索。
# 给前端"语义搜索"试验场页用——单独看检索效果，不经过 LLM。
router = APIRouter()


# 检索请求：top_k 留空则用配置默认值（5）。
class SearchRequest(BaseModel):
    query: str
    repo_id: str
    top_k: int | None = None


@router.post("/search")
def search(req: SearchRequest):
    # search（语义检索）：转调 search_service.search，ValueError（如仓库未索引）转 400。
    try:
        return search_service.search(req.query, req.repo_id, req.top_k)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
