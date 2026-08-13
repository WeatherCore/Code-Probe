###################
# Configuration Defaults — 全项目的参数出厂设置
# 整个项目的“宪法”————定义了最底层的路径规则和默认值
# 项目里所有可调的东西（模型密钥、接口地址、切块大小、检索数量、系统提示词）都先在这里定好默认值；settings.json 里没存或存漏的字段，运行时都从这里兜底。
# 同时负责加载 .env 环境变量。想调 RAG 超参，改这一个文件就够了。
###################

import os
from dotenv import load_dotenv

# 项目根目录：backend 文件夹根目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# __file__：当前文件 defaults.py 的文件名
# os.path.abspath(__file__)：拿到 defaults.py 的绝对物理路径，例：xxx/backend/app/config/defaults.py
#  第一层 dirname：往上跳一级 → xxx/backend/app/config/
#  第二层 dirname：再跳一级 → xxx/backend/app/
#  第三层 dirname：再跳一级 → xxx/backend/

# 数据目录：backend/data，os.path.join 安全拼接路径，等价于 backend/data/
# 这个目录存放所有运行时生成文件：settings.json 用户配置、repos.json 仓库列表、sessions.json 对话历史、chroma/ 向量数据库持久化文件、uploads/ 上传 ZIP 解压目录
DATA_DIR = os.path.join(BASE_DIR, "data")

# 设置文件：backend/data/settings.json
# 所有前端页面填写的 API Key、模型参数都会持久化到这个 JSON 文件，下次启动时自动加载
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")

# 项目根
ROOT_DIR = os.path.dirname(BASE_DIR)                       
load_dotenv(os.path.join(ROOT_DIR, ".env"))                # 把 .env 注入 os.environ

# 系统提示词：要求 LLM 基于检索到的代码片段回答，并引用文件路径+行号——
# 这是"代码 RAG"区别于普通问答的关键约束，让回答可溯源回源码位置。
DEFAULT_SYSTEM_PROMPT = """你是一个代码库智能助手。根据检索到的代码片段回答用户问题。
回答时请引用具体的文件路径和行号，保持简洁准确。"""

# 全局默认配置（运行时可在设置页改，落盘到 settings.json）
DEFAULT_SETTINGS = {
    "llm_api_key": "",                                     # LLM大模型密钥，默认空
    "llm_base_url": "https://api.openai.com/v1",           # LLM接口地址
    "llm_model": "gpt-4o",                                 # 对话使用的模型名称
    "embedding_api_key": "",                               # 向量模型独立密钥
    "embedding_base_url": "https://api.openai.com/v1",     # 向量接口地址
    "embedding_model": "text-embedding-3-small",           # 向量化模型
    "chunk_size": 1000,                                    # 代码切块单块最大字符数
    "chunk_overlap": 200,                                  # 相邻块重叠字符（防止语义截断）
    "top_k": 5,                                            # 向量检索返回最相似5个代码块
    "system_prompt": DEFAULT_SYSTEM_PROMPT,                # 绑定上面写好的默认提示词
}

# 1.配置缺失自动兜底，防止程序崩溃
#  用户本地第一次启动项目，data/settings.json 文件根本不存在。manager.py 检测不到配置文件时，直接把 DEFAULT_SETTINGS 完整返回，后端所有服务（切块、向量检索、LLM 调用）拿到有效值正常运行，不会报键不存在、变量为空的错误。
# 2.老配置文件向下兼容，新增参数不用手动改 JSON
#  版本迭代时，如果我在字典里新增了一个配置键（比如 rerank_enable: false），用户电脑上旧的 settings.json 里没有这个字段。
#  加载逻辑是：拷贝一份默认字典 → 用用户 json 里的内容覆盖默认值。
# 新增加的键会自动保留默认值，程序不会因为 json 少字段直接抛出 KeyError，不用让用户手动去补 JSON 内容。
# 3.前端配置页面的初始渲染数据源
#  前端进入设置页时，后端返回合并后的完整配置，前端表单默认填充的值全部来源于这个字典。比如切块大小默认 1000、top_k 默认 5，前端打开页面直接显示，不用前端硬编码写死默认数字。
# 4.全项目唯一参数源头，统一管控 RAG 超参
#  后端各处业务直接导入读取：
#   - 索引服务 index_service 取 chunk_size、chunk_overlap 做代码分割；
#   - 检索服务 search_service 取 top_k 控制返回片段数量；
#   - LLM 客户端 llm_client 读取 api_key、base_url、模型名称；
#   - 聊天服务 chat_service 读取系统提示词。
#  后续要调整 RAG 策略，只改这一处默认值即可，不用分散在各个业务文件里逐个修改