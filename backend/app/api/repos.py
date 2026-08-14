###################
# Repo Routes — 代码库管理入口（HTTP 层）
# 前端"仓库管理"页的操作都打到这里：加本地路径、传 zip、删仓库、触发索引、查索引状态。
# 索引是耗时活，用 FastAPI 后台任务异步跑，接口先回 202，前端轮询状态。
# 业务逻辑在 repo_service / index_service，这里只做参数校验和转发。
###################

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel
from app.services import repo_service, index_service
import os
import tempfile

# 仓库路由：代码库的导入（本地路径 / zip 上传）、查询、删除、索引触发与状态轮询。
# 索引是耗时操作，用 BackgroundTasks 异步执行并立即返回 202，前端轮询状态。
router = APIRouter()


class AddRepoRequest(BaseModel):
    # 本地路径导入请求：path 必须是已存在的目录（repo_service 会校验）。
    path: str
    name: str | None = None


@router.post("/repos", status_code=201)
def add_repo(req: AddRepoRequest):
    # add_repo（本地路径导入）：注册一个本地目录为代码库，不拷贝文件（直接引用原路径）。
    # 适合本地开发调试；生产/分享场景用 upload。
    try:
        return repo_service.add_repo(req.path, req.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/repos/upload", status_code=201)
async def upload_repo(
    file: UploadFile = File(...),
    name: str = Form(default=""),
):
    # upload_repo（zip 上传导入）：把上传的 zip 解压到 data/uploads/{repo_id}/ 并注册。
    # 比"本地路径"更通用（不依赖服务器本地文件系统），是前端的默认导入方式。
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="仅支持 .zip 格式的压缩文件")
    # Save to temp file then hand off to repo_service
    # 先落临时文件再交给 service：UploadFile 是流式的，service 需要 seekable 的本地 zip 路径。
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    try:
        content = await file.read()
        tmp.write(content)
        tmp.close()
        return repo_service.add_repo_from_upload(tmp.name, name or None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        # 兜底清理：非 ValueError 异常（如解压失败）时删临时文件，避免 /tmp 堆积。
        if os.path.exists(tmp.name):
            os.remove(tmp.name)
        raise


@router.get("/repos")
def list_repos():
    # list_repos（仓库列表）：前端"仓库管理"页展示所有已注册仓库及其索引状态。
    return repo_service.list_repos()


@router.delete("/repos/{repo_id}", status_code=204)
def delete_repo(repo_id: str):
    # delete_repo（删仓库）：移除记录 + 清 chunks.json + 清 uploads 目录。
    # [注意] 已知缺陷：未清 ChromaDB collection，会留孤儿向量数据（见 ZHIDAO.md Q3）。
    if not repo_service.delete_repo(repo_id):
        raise HTTPException(status_code=404, detail="Repo not found")


@router.post("/repos/{repo_id}/index", status_code=202)
def trigger_index(repo_id: str, background_tasks: BackgroundTasks):
    # trigger_index（触发索引）：本项目"建库"的入口。
    # 关键设计：用 FastAPI BackgroundTasks 把 index_repo 丢后台异步执行，立即返回 202。
    # 前端拿到 202 后轮询 /index/status 直到 indexed/error。
    # 先置状态 indexing 让前端立即反馈，再异步跑（避免请求长时间挂起）。
    repo = repo_service.get_repo(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    repo_service.update_repo(repo_id, {"status": "indexing", "error_msg": None})
    background_tasks.add_task(index_service.index_repo, repo_id)
    return {"status": "indexing", "repo_id": repo_id}


@router.get("/repos/{repo_id}/index/status")
def index_status(repo_id: str):
    # index_status（索引状态轮询）：前端触发索引后每隔几秒调一次，直到 status 变 indexed/error。
    repo = repo_service.get_repo(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    return {"repo_id": repo_id, "status": repo["status"], "error_msg": repo.get("error_msg")}
