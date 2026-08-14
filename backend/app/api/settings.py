###################
# Settings Routes — 设置读写接口（HTTP 层）
# 给前端设置页提供配置读写：GET 返回当前配置（API Key 脱敏成"前8位****"，
# 不把明文密钥发给浏览器），PUT 接受部分字段更新。顺带一个健康检查接口给前端探活。
###################

from fastapi import APIRouter
from pydantic import BaseModel
from app.config.manager import get_settings, update_settings

# 设置路由：运行时配置的读写 + 健康检查。所有字段 Optional，支持部分更新。
# GET 接口对 api_key 脱敏（前8位+****），PUT 接口过滤掉含 **** 的占位符字段。
router = APIRouter()


# 设置更新请求：所有字段 Optional，前端只传改动的字段，与 DEFAULT_SETTINGS 一一对应。
class SettingsUpdate(BaseModel):
    llm_api_key: str | None = None
    llm_base_url: str | None = None
    llm_model: str | None = None
    embedding_api_key: str | None = None
    embedding_base_url: str | None = None
    embedding_model: str | None = None
    chunk_size: int | None = None
    chunk_overlap: int | None = None
    top_k: int | None = None
    system_prompt: str | None = None


@router.get("/settings")
def get_settings_endpoint():
    # get_settings_endpoint（读设置）：返回当前配置，但 api_key 脱敏——
    # 前端拿到的是"前8位****"占位符，避免明文密钥暴露到前端。
    s = get_settings()
    # mask api keys
    result = dict(s)
    if result.get("llm_api_key"):
        result["llm_api_key"] = result["llm_api_key"][:8] + "****"
    if result.get("embedding_api_key"):
        result["embedding_api_key"] = result["embedding_api_key"][:8] + "****"
    return result


@router.put("/settings")
def update_settings_endpoint(req: SettingsUpdate):
    # update_settings_endpoint（更新设置）：过滤两层——v is None（未传字段不覆盖）+
    # 含 "****" 不写入（前端用脱敏占位符回显，提交时不能把占位符当真 key 写回）。
    partial = {
        k: v for k, v in req.model_dump().items()
        if v is not None and "****" not in str(v)
    }
    return update_settings(partial)


@router.get("/health")
def health_check():
    # health_check（健康检查）：给前端启动时探活用，确认后端在跑。
    return {"status": "ok", "version": "2.0.0"}
