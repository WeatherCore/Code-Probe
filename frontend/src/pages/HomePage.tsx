import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  DatabaseIcon,
  ChatsCircleIcon,
  MagnifyingGlassIcon,
  GearIcon,
  ArrowRightIcon,
  StackPlusIcon,
  CodeIcon,
  LightningIcon,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Repo, ChatSession } from "@/types";

export function HomePage() {
  const navigate = useNavigate();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    api.repos.list().then(setRepos).catch(() => {});
    api.chat.sessions.list().then(setSessions).catch(() => {});
  }, []);

  const indexedCount = repos.filter((r) => r.status === "indexed").length;
  const totalChunks = repos.reduce((a, r) => a + r.chunk_count, 0);

  const cards = [
    {
      title: "代码仓库",
      desc: "添加本地目录或上传 zip，建立向量索引",
      icon: DatabaseIcon,
      to: "/repos",
      stat: `${repos.length} 个仓库 · ${indexedCount} 已索引`,
      accent: "text-accent",
    },
    {
      title: "AI 对话",
      desc: "基于代码库的 RAG 流式问答，4 阶段过程可视化",
      icon: ChatsCircleIcon,
      to: "/chat",
      stat: `${sessions.length} 个会话`,
      accent: "text-info",
    },
    {
      title: "搜索试验场",
      desc: "独立测试语义检索效果，查看向量命中与 prompt",
      icon: MagnifyingGlassIcon,
      to: "/search",
      stat: `共 ${totalChunks} 个代码分块`,
      accent: "text-warning",
    },
    {
      title: "设置",
      desc: "配置 LLM / Embedding 模型与 RAG 超参",
      icon: GearIcon,
      to: "/settings",
      stat: "模型 · 分块 · 检索",
      accent: "text-foreground-muted",
    },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent shadow-lg shadow-accent/20">
              <StackPlusIcon size={24} weight="bold" className="text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Code Probe</h1>
              <p className="text-sm text-foreground-muted">代码库 RAG 工作台</p>
            </div>
          </div>
          <p className="max-w-2xl text-base text-foreground-muted leading-relaxed">
            把代码库切片向量化，用自然语言提问，AI 基于检索到的代码片段回答并引用文件位置。
            完整可视化的 RAG 流程：检索 → 提示词 → 流式生成 → 持久化。
          </p>
        </motion.div>

        {/* 能力卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {cards.map((c, i) => (
            <motion.button
              key={c.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
              onClick={() => navigate(c.to)}
              className="text-left group"
            >
              <Card className="p-5 h-full hover:border-border-strong hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated", c.accent)}>
                    <c.icon size={20} />
                  </div>
                  <ArrowRightIcon
                    size={16}
                    className="text-foreground-subtle opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                  />
                </div>
                <h3 className="text-base font-semibold mb-1">{c.title}</h3>
                <p className="text-sm text-foreground-muted leading-relaxed mb-3">{c.desc}</p>
                <Badge variant="outline">{c.stat}</Badge>
              </Card>
            </motion.button>
          ))}
        </div>

        {/* RAG 流程说明 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <LightningIcon size={18} className="text-accent" weight="fill" />
              <h3 className="text-sm font-semibold">RAG 流程</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { step: "01", title: "索引建库", desc: "扫描 .py 文件，滑动窗口分块，批量 Embedding 入 ChromaDB", icon: CodeIcon },
                { step: "02", title: "语义检索", desc: "问题向量化，cosine 相似度找 Top-K 最相关代码块", icon: MagnifyingGlassIcon },
                { step: "03", title: "提示词拼接", desc: "system + 代码上下文 + 历史对话 + 当前问题", icon: StackPlusIcon },
                { step: "04", title: "流式生成", desc: "SSE 逐字推送回答，引用文件路径与行号", icon: ChatsCircleIcon },
              ].map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="relative"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs text-accent">{s.step}</span>
                    <s.icon size={14} className="text-foreground-muted" />
                    <span className="text-sm font-medium">{s.title}</span>
                  </div>
                  <p className="text-xs text-foreground-muted leading-relaxed">{s.desc}</p>
                  {i < 3 && (
                    <ArrowRightIcon
                      size={14}
                      className="hidden md:block absolute -right-2 top-2 text-foreground-subtle"
                    />
                  )}
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* 快速开始 */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button size="lg" onClick={() => navigate("/repos")}>
            <DatabaseIcon size={16} weight="bold" />
            开始添加仓库
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/chat")}>
            <ChatsCircleIcon size={16} />
            直接对话
          </Button>
        </div>
      </div>
    </div>
  );
}
