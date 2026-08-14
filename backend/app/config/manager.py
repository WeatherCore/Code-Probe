###################
# Settings Manager — 用户配置的读写中枢，是连接“代码逻辑”与“硬盘 JSON”的桥梁
# 整个 backend 项目只有这一个文件在 data/settings.json 上执行读写操作。其他所有 service（如 llm_client）想要获取配置，都只能通过 manager.get_settings()，绝对不能出现其他文件里自己写 open 读 JSON。这保证了配置读取的单一出口，以后如果把配置迁移到 Redis 或数据库，只需要改这 34 行代码，项目其他部分毫发无损
###################

import json
import os
from app.config.defaults import DEFAULT_SETTINGS
from app.config.defaults import SETTINGS_FILE as _DEFAULT_SETTINGS_FILE
from app.config.defaults import DATA_DIR as _DEFAULT_DATA_DIR

# 设置文件：backend/data/settings.json
SETTINGS_FILE = _DEFAULT_SETTINGS_FILE
# 数据目录：backend/data
DATA_DIR = _DEFAULT_DATA_DIR

import app.config.manager as _self
# 关键技巧：用 import app.config.manager as _self
# 自己导入自己这个模块，后续函数内部用 _self.DATA_DIR、_self.SETTINGS_FILE 读取路径常量。如果直接写 DATA_DIR，在测试时（conftest.py 里用 tmp_path 去 monkeypatch 这个变量），你会发现打补丁根本打不上，因为 DATA_DIR 在导入时就已经被固定了。但如果通过 _self.DATA_DIR 去访问，Python 每次都会去 _self 这个模块对象里动态查找属性。测试时只要 monkeypatch 掉 manager.DATA_DIR，所有函数立刻生效。这是纯手工实现的“依赖注入”

# 启动前兜底的“防御式编程”：这个函数保证 backend/data 文件夹一定存在，假设运行中有人手贱把 data/ 文件夹删了，下一次调用 save_settings 时，_ensure_data_dir 会静默重建文件夹，保证 open 写入时不会因为目录不存在而报 FileNotFoundError
# 所有读写配置的方法第一行都会调用它，避免写文件时报「目录不存在」错误
def _ensure_data_dir():
    # exist_ok=True：文件夹已存在不会抛异常，只有不存在时才创建
    os.makedirs(_self.DATA_DIR, exist_ok=True)

# get_settings（读配置）：默认值 + 存储记忆值合并返回
def get_settings() -> dict:
    # 关键设计：先拷 DEFAULT_SETTINGS 再 update(stored)，
    # 后期在 defaults.py 的 DEFAULT_SETTINGS 新增配置项（比如增加 rerank_model），用户旧的 settings.json 里没有这个 key。result 先带上新默认值，再被旧 json 覆盖，新字段自动生效，程序不会报 KeyError 崩溃，不需要用户手动去改 JSON 文件

    # 先确保data目录存在
    _ensure_data_dir()

    # 场景1：本地没有settings.json配置文件
    if not os.path.exists(_self.SETTINGS_FILE):
        # 直接返回默认配置的拷贝
        return dict(DEFAULT_SETTINGS)
    
    # 场景2：有配置文件，读取用户保存的配置
    # 显式 UTF-8：Windows 默认 GBK 读 UTF-8 的 JSON 会抛 'gbk' codec can't decode
    with open(_self.SETTINGS_FILE, "r", encoding="utf-8") as f:
        stored = json.load(f)

    # 关键兼容逻辑
    result = dict(DEFAULT_SETTINGS)   # 第一步：复制全套默认参数（含 .env 注入的 key/base_url）
    for k, v in stored.items():
        # 第二步：用用户本地配置覆盖同名默认字典的 key
        # 空值不覆盖：settings.json 里残留的空 api_key / 空字段，不能把 .env 配好的 key 顶掉
        if v is None or v == "":
            continue
        result[k] = v
    return result

# save_settings（写配置）：接收一整个完整配置字典，直接整体覆盖写回 settings.json（非增量）
def save_settings(settings: dict) -> None:

    # 先确保data目录存在
    _ensure_data_dir()

    # w模式：直接覆盖重写整个json文件（显式 UTF-8，保证跨平台/跨工具可读）
    with open(_self.SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)
        # indent=2 让 JSON 格式化换行，方便人工打开查看

# update_settings（部分更新）：读当前值 → 合并 partial → 整体写回
def update_settings(partial: dict) -> dict:
    
    # 1. 拿到当前完整生效配置（默认+用户合并后的）
    current = get_settings()
    # 2. 只更新传入的部分字段
    current.update(partial)
    # 3. 持久化写入文件
    save_settings(current)
    # 4. 返回更新后的完整配置给前端展示
    return current
