import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  PlusIcon,
  TrashIcon,
  PaperPlaneTiltIcon,
  ChatCircleIcon,
  DatabaseIcon,
  XIcon,
  MagnifyingGlassIcon,
  FileTextIcon,
  HashIcon,
  LightningIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import { cn, formatRelative, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScoreBar } from "@/components/ScoreBar";
import { CodeBlock } from "@/components/CodeBlock";
import { EmptyState } from "@/components/EmptyState";
import type { ChatSession, ChatMessage, Repo, SearchHit, PromptParts } from "@/types";

export function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [loadingSession, setLoadingSession] = useState(false);
  const [drawerMsg, setDrawerMsg] = useState<ChatMessage | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  // 加载会话列表 + 仓库列表
  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api.chat.sessions.list());
    } catch {
      /* ignore */
    }
  }, []);

  const loadRepos = useCallback(async () => {
    try {
      const data = await api.repos.list();
      setRepos(data.filter((r) => r.status === "indexed"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadRepos();
  }, [loadSessions, loadRepos]);

  // 加载/切换会话
  useEffect(() => {
    if (!sessionId) {
      setCurrentSession(null);
      setMessages([]);
      return;
    }
    setLoadingSession(true);
    api.chat.sessions
      .get(sessionId)
      .then((s) => {
        setCurrentSession(s);
        setMessages(s.messages || []);
        if (s.repo_id) setSelectedRepoId(s.repo_id);
      })
      .catch(() => {
        toast.error("会话不存在或已被删除");
        navigate("/chat");
      })
      .finally(() => setLoadingSession(false));
  }, [sessionId, navigate]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleNewSession = async () => {
    try {
      const s = await api.chat.sessions.create(selectedRepoId || null);
      await loadSessions();
      navigate(`/chat/${s.session_id}`);
      setMobileListOpen(false);
    } catch (e) {
      toast.error("创建会话失败", e instanceof Error ? e.message : "");
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.chat.sessions.remove(id);
      if (id === sessionId) navigate("/chat");
      await loadSessions();
      toast.success("会话已删除");
    } catch {
      toast.error("删除失败");
    }
  };

  // 核心发送逻辑：SSE 4 阶段流式
  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    if (!currentSession) {
      toast.warning("请先创建会话", "点击侧栏的「新建会话」按钮");
      return;
    }
    if (!selectedRepoId) {
      toast.warning("请先选择代码仓库", "只有已索引的仓库才能问答");
      return;
    }

    abortRef.current = false;
    setStreaming(true);
    setInput("");

    // 乐观追加 user 消息 + 占位 assistant 消息
    const userMsg: ChatMessage = { role: "user", content: text };
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      rag_data: {
        retrieval: [],
        prompt_parts: { system: "", context: "", history: [], user_message: text },
        total_tokens_estimate: 0,
      },
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    // 不可变更新最后一条 assistant 消息的工具
    const updateLast = (updater: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = updater(last);
        return next;
      });
    };

    try {
      for await (const event of api.chat.stream(text, currentSession.session_id, selectedRepoId)) {
        if (abortRef.current) break;

        if (event.type === "retrieval") {
          updateLast((m) => ({
            ...m,
            rag_data: m.rag_data
              ? { ...m.rag_data, retrieval: event.results }
              : m.rag_data,
          }));
        } else if (event.type === "prompt") {
          updateLast((m) => ({
            ...m,
            rag_data: m.rag_data
              ? {
                  ...m.rag_data,
                  prompt_parts: event.prompt_parts,
                  total_tokens_estimate: event.total_tokens_estimate,
                }
              : m.rag_data,
          }));
        } else if (event.type === "chunk") {
          updateLast((m) => ({ ...m, content: m.content + event.content }));
        } else if (event.type === "error") {
          updateLast((m) => ({
            ...m,
            content: m.content + `\n\n> ⚠️ 错误：${event.message}`,
          }));
          toast.error("回答出错", event.message);
        } else if (event.type === "done") {
          // 流式完成
        }
      }
    } catch (e) {
      updateLast((m) => ({
        ...m,
        content: m.content + `\n\n> ⚠️ 请求失败：${e instanceof Error ? e.message : "未知错误"}`,
      }));
      toast.error("请求失败", e instanceof Error ? e.message : "");
    } finally {
      setStreaming(false);
      loadSessions(); // 刷新会话列表（messages 已更新）
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const indexedRepos = repos;

  return (
    <div className="flex h-full">
      {/* 会话列表（桌面） */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-border flex-col bg-surface">
        <SessionList
          sessions={sessions}
          currentId={sessionId}
          onSelect={(id) => navigate(`/chat/${id}`)}
          onDelete={handleDeleteSession}
          onNew={handleNewSession}
        />
      </aside>

      {/* 会话列表（移动端抽屉） */}
      <AnimatePresence>
        {mobileListOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileListOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="fixed left-0 top-0 z-50 h-full w-64 border-r border-border bg-surface md:hidden"
            >
              <SessionList
                sessions={sessions}
                currentId={sessionId}
                onSelect={(id) => {
                  navigate(`/chat/${id}`);
                  setMobileListOpen(false);
                }}
                onDelete={handleDeleteSession}
                onNew={handleNewSession}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 主聊天区 */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* 顶栏 */}
        <div className="flex items-center gap-3 border-b border-border px-4 h-14 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileListOpen(true)}
          >
            <ChatCircleIcon size={18} />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">
              {currentSession ? `会话 ${currentSession.session_id.slice(0, 8)}` : "AI 对话"}
            </h2>
            <p className="text-[11px] text-foreground-subtle">
              {currentSession ? formatTime(currentSession.created_at) : "选择或创建会话开始"}
            </p>
          </div>
          {/* 仓库选择器 */}
          <div className="w-48 shrink-0">
            <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="选择仓库" />
              </SelectTrigger>
              <SelectContent>
                {indexedRepos.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-foreground-subtle">
                    暂无已索引仓库
                  </div>
                ) : (
                  indexedRepos.map((r) => (
                    <SelectItem key={r.repo_id} value={r.repo_id}>
                      {r.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 消息列表 */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          {!currentSession && !loadingSession ? (
            <EmptyState
              icon={<ChatCircleIcon size={28} />}
              title="开始一段 AI 对话"
              description="创建会话并选择已索引的代码仓库，即可基于代码库进行 RAG 问答"
              action={
                <Button onClick={handleNewSession}>
                  <PlusIcon size={16} weight="bold" />
                  新建会话
                </Button>
              }
            />
          ) : loadingSession ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-16 w-3/4" />
              <Skeleton className="h-24 w-5/6 ml-auto" />
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={i}
                  msg={msg}
                  streaming={streaming && i === messages.length - 1 && msg.role === "assistant"}
                  onShowRag={() => setDrawerMsg(msg)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 输入区 */}
        <div className="border-t border-border p-3 shrink-0 bg-surface">
          <div className="mx-auto max-w-3xl flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentSession ? "输入问题，Enter 发送，Shift+Enter 换行" : "请先创建会话"}
              disabled={streaming}
              className="flex-1 min-h-[40px] max-h-[160px] resize-none"
              rows={1}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={streaming || !input.trim()}
              className="h-10 w-10"
            >
              <PaperPlaneTiltIcon size={16} weight="fill" />
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-foreground-subtle">
            回答基于检索到的代码片段生成，引用以文件路径+行号标注
          </p>
        </div>
      </div>

      {/* RAG 过程抽屉 */}
      <RagDrawer msg={drawerMsg} onClose={() => setDrawerMsg(null)} />
    </div>
  );
}

// ============ 会话列表子组件 ============
function SessionList({
  sessions,
  currentId,
  onSelect,
  onDelete,
  onNew,
}: {
  sessions: ChatSession[];
  currentId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onNew: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="text-sm font-semibold">会话</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNew} title="新建会话">
          <PlusIcon size={14} weight="bold" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {sessions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-foreground-subtle text-center">
              还没有会话
              <br />
              点击 + 创建
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.session_id}
                onClick={() => onSelect(s.session_id)}
                className={cn(
                  "group w-full text-left rounded-lg px-3 py-2 transition-colors",
                  currentId === s.session_id
                    ? "bg-accent-soft"
                    : "hover:bg-surface-hover"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-xs font-medium truncate",
                      currentId === s.session_id ? "text-accent" : "text-foreground"
                    )}
                  >
                    {s.messages[0]?.content.slice(0, 30) || `会话 ${s.session_id.slice(0, 6)}`}
                    {s.messages[0]?.content && s.messages[0].content.length > 30 ? "…" : ""}
                  </span>
                  <button
                    onClick={(e) => onDelete(s.session_id, e)}
                    className="opacity-0 group-hover:opacity-100 text-foreground-subtle hover:text-danger transition-all"
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-foreground-subtle">
                    {formatRelative(s.created_at)}
                  </span>
                  {s.messages.length > 0 && (
                    <span className="text-[10px] text-foreground-subtle">
                      · {s.messages.length} 条
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}

// ============ 消息气泡 ============
function MessageBubble({
  msg,
  streaming,
  onShowRag,
}: {
  msg: ChatMessage;
  streaming: boolean;
  onShowRag: () => void;
}) {
  const isUser = msg.role === "user";
  const hasRag = msg.role === "assistant" && msg.rag_data;
  const retrievalCount = msg.rag_data?.retrieval.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* 头像 */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
          isUser
            ? "bg-surface-elevated text-foreground"
            : "bg-accent text-accent-foreground"
        )}
      >
        {isUser ? "你" : <LightningIcon size={16} weight="fill" />}
      </div>

      <div className={cn("flex flex-col gap-1.5 max-w-[85%] min-w-0", isUser ? "items-end" : "items-start")}>
        {/* 气泡 */}
        <div
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm leading-relaxed break-words",
            isUser
              ? "bg-accent text-accent-foreground"
              : "bg-surface-elevated text-foreground border border-border"
          )}
        >
          {msg.content ? (
            <div className={cn("whitespace-pre-wrap", streaming && "typing-cursor")}>
              {msg.content}
            </div>
          ) : streaming ? (
            <div className="flex items-center gap-1.5 text-foreground-muted">
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-xs"
              >
                正在检索代码库…
              </motion.span>
            </div>
          ) : (
            <span className="text-foreground-muted text-xs">（空回复）</span>
          )}
        </div>

        {/* RAG 元信息条 */}
        {hasRag && (retrievalCount > 0 || msg.rag_data!.total_tokens_estimate > 0) && !streaming && (
          <button
            onClick={onShowRag}
            className="flex items-center gap-2 text-[11px] text-foreground-subtle hover:text-accent transition-colors group"
          >
            <MagnifyingGlassIcon size={12} />
            <span>
              检索到 {retrievalCount} 个代码片段 · 预估 {msg.rag_data!.total_tokens_estimate} tokens
            </span>
            <ArrowSquareOutIcon size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ============ RAG 过程抽屉 ============
function RagDrawer({ msg, onClose }: { msg: ChatMessage | null; onClose: () => void }) {
  const [tab, setTab] = useState<"retrieval" | "prompt">("retrieval");

  useEffect(() => {
    if (msg) setTab("retrieval");
  }, [msg]);

  return (
    <Dialog open={!!msg} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LightningIcon size={18} className="text-accent" />
            RAG 过程详情
          </DialogTitle>
        </DialogHeader>

        {msg?.rag_data && (
          <>
            <div className="flex gap-1 border-b border-border">
              <button
                onClick={() => setTab("retrieval")}
                className={cn(
                  "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                  tab === "retrieval"
                    ? "border-accent text-accent"
                    : "border-transparent text-foreground-muted hover:text-foreground"
                )}
              >
                检索结果 ({msg.rag_data.retrieval.length})
              </button>
              <button
                onClick={() => setTab("prompt")}
                className={cn(
                  "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                  tab === "prompt"
                    ? "border-accent text-accent"
                    : "border-transparent text-foreground-muted hover:text-foreground"
                )}
              >
                提示词组成 ({msg.rag_data.total_tokens_estimate} tokens)
              </button>
            </div>

            <ScrollArea className="flex-1 max-h-[60vh]">
              {tab === "retrieval" ? (
                <RetrievalList hits={msg.rag_data.retrieval} />
              ) : (
                <PromptView parts={msg.rag_data.prompt_parts} />
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// 检索结果列表
function RetrievalList({ hits }: { hits: SearchHit[] }) {
  if (hits.length === 0) {
    return <p className="p-6 text-sm text-foreground-muted text-center">没有检索到相关代码片段</p>;
  }
  return (
    <div className="p-3 space-y-3">
      {hits.map((hit, i) => (
        <div key={hit.chunk_id} className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between gap-2 p-2.5 bg-surface-elevated">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] text-foreground-subtle font-mono">#{i + 1}</span>
              <FileTextIcon size={13} className="text-accent shrink-0" />
              <span className="text-xs font-mono text-foreground truncate">{hit.file_path}</span>
              <Badge variant="outline" className="shrink-0">
                L{hit.line_start}-{hit.line_end}
              </Badge>
            </div>
            <ScoreBar score={hit.score} />
          </div>
          <div className="p-0">
            <CodeBlock
              code={hit.content}
              language="python"
              showLineNumbers={false}
              maxHeight={240}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// 提示词四大组成
function PromptView({ parts }: { parts: PromptParts }) {
  const sections = [
    {
      key: "system",
      label: "System 角色",
      icon: <LightningIcon size={13} />,
      content: parts.system,
    },
    {
      key: "context",
      label: "代码上下文",
      icon: <DatabaseIcon size={13} />,
      content: parts.context,
    },
    {
      key: "history",
      label: `历史对话 (${parts.history.length} 条)`,
      icon: <ChatCircleIcon size={13} />,
      content: parts.history.map((m) => `[${m.role}] ${m.content}`).join("\n\n"),
    },
    {
      key: "user",
      label: "当前问题",
      icon: <HashIcon size={13} />,
      content: parts.user_message,
    },
  ];

  return (
    <div className="p-3 space-y-3">
      {sections.map((s) => (
        <div key={s.key} className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-elevated text-xs font-medium">
            <span className="text-accent">{s.icon}</span>
            {s.label}
          </div>
          <pre className="p-3 text-xs font-mono text-foreground-muted whitespace-pre-wrap break-words max-h-48 overflow-auto">
            {s.content || "（空）"}
          </pre>
        </div>
      ))}
    </div>
  );
}
