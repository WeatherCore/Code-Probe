import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeftIcon,
  FileTextIcon,
  DatabaseIcon,
  HashIcon,
  ScissorsIcon,
  CodeIcon,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import { cn, truncate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { CodeBlock } from "@/components/CodeBlock";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Repo, RepoStats, Chunk, ChunkContext } from "@/types";

export function RepoDetailPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  const [repo, setRepo] = useState<Repo | null>(null);
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChunk, setSelectedChunk] = useState<Chunk | null>(null);
  const [context, setContext] = useState<ChunkContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    if (!repoId) return;
    (async () => {
      try {
        const [repoList, statsData, chunksData] = await Promise.all([
          api.repos.list(),
          api.chunks.stats(repoId),
          api.chunks.list(repoId),
        ]);
        const found = repoList.find((r) => r.repo_id === repoId);
        setRepo(found || null);
        setStats(statsData);
        setChunks(chunksData.chunks);
      } catch (e) {
        toast.error("加载失败", e instanceof Error ? e.message : "");
      } finally {
        setLoading(false);
      }
    })();
  }, [repoId]);

  const handleViewContext = async (chunk: Chunk) => {
    setSelectedChunk(chunk);
    setContextLoading(true);
    setContext(null);
    try {
      const ctx = await api.chunks.context(repoId!, chunk.chunk_id);
      setContext(ctx);
    } catch (e) {
      toast.error("加载源码上下文失败", e instanceof Error ? e.message : "");
    } finally {
      setContextLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-auto p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!repo) {
    return (
      <EmptyState
        icon={<DatabaseIcon size={28} />}
        title="仓库不存在"
        description="该仓库可能已被删除"
        action={<Button onClick={() => navigate("/repos")}>返回仓库列表</Button>}
      />
    );
  }

  const pagedChunks = chunks.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(chunks.length / pageSize);

  const statCards = [
    { label: "代码文件", value: stats?.total_files ?? 0, icon: FileTextIcon, suffix: "个" },
    { label: "分块总数", value: stats?.total_chunks ?? 0, icon: DatabaseIcon, suffix: "块" },
    { label: "向量维度", value: stats?.embedding_dim ?? 0, icon: HashIcon, suffix: "维" },
    { label: "分块大小", value: stats?.chunk_size ?? 0, icon: ScissorsIcon, suffix: "字符" },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* 页头 */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/repos")}>
            <ArrowLeftIcon size={18} />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight truncate">{repo.name}</h1>
              <StatusBadge status={repo.status} />
            </div>
            <p className="mt-0.5 text-xs text-foreground-subtle font-mono truncate">{repo.path}</p>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="p-4">
                <div className="flex items-center gap-2 text-foreground-subtle mb-2">
                  <s.icon size={15} />
                  <span className="text-xs">{s.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold tabular-nums">{s.value}</span>
                  <span className="text-xs text-foreground-muted">{s.suffix}</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* 分块参数 + 文件分布 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ScissorsIcon size={16} className="text-accent" />
              <h3 className="text-sm font-semibold">分块参数</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground-muted">chunk_size</span>
                <span className="font-mono">{stats?.chunk_size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">chunk_overlap</span>
                <span className="font-mono">{stats?.chunk_overlap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">平均块大小</span>
                <span className="font-mono">
                  {chunks.length > 0
                    ? Math.round(chunks.reduce((a, c) => a + c.char_count, 0) / chunks.length)
                    : 0}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileTextIcon size={16} className="text-accent" />
                <h3 className="text-sm font-semibold">文件分布</h3>
              </div>
              <Badge variant="outline">{stats?.file_distribution.length ?? 0} 个文件</Badge>
            </div>
            <div className="space-y-1 max-h-64 overflow-auto pr-1">
              {(stats?.file_distribution || []).map((f) => (
                <div
                  key={f.file_path}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface-hover transition-colors text-xs"
                >
                  <span className="font-mono text-foreground-muted truncate" title={f.file_path}>
                    {f.file_path}
                  </span>
                  <span className="shrink-0 font-mono text-foreground">{f.chunk_count} 块</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* 分块列表 */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <CodeIcon size={16} className="text-accent" />
              <h3 className="text-sm font-semibold">代码分块</h3>
              <Badge variant="outline">{chunks.length} 块</Badge>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一页
                </Button>
                <span className="text-xs text-foreground-muted font-mono">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </div>

          {chunks.length === 0 ? (
            <EmptyState
              icon={<CodeIcon size={24} />}
              title="暂无分块数据"
              description="该仓库尚未索引或索引失败，请先触发索引"
            />
          ) : (
            <div className="divide-y divide-border">
              {pagedChunks.map((chunk) => (
                <button
                  key={chunk.chunk_id}
                  onClick={() => handleViewContext(chunk)}
                  className="w-full text-left p-4 hover:bg-surface-hover transition-colors group"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-foreground truncate">
                        {chunk.file_path}
                      </span>
                      <Badge variant="default" className="shrink-0">
                        L{chunk.line_start}-{chunk.line_end}
                      </Badge>
                      {chunk.chunk_index > 0 && (
                        <Badge variant="outline" className="shrink-0">
                          块 #{chunk.chunk_index}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-foreground-subtle shrink-0 font-mono">
                      {chunk.char_count} 字符
                    </span>
                  </div>
                  <pre className="text-xs font-mono text-foreground-muted overflow-hidden line-clamp-3 group-hover:text-foreground-muted">
                    <code>{truncate(chunk.content, 200)}</code>
                  </pre>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 源码上下文 Dialog */}
      <Dialog open={!!selectedChunk} onOpenChange={(o) => !o && setSelectedChunk(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <CodeIcon size={18} className="text-accent" />
              <span className="font-mono text-sm">{selectedChunk?.file_path}</span>
              {selectedChunk && (
                <Badge variant="accent">
                  L{selectedChunk.line_start}-{selectedChunk.line_end}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            {contextLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : context ? (
              <CodeBlock
                code={context.file_content}
                language="python"
                highlightStart={context.highlight_start}
                highlightEnd={context.highlight_end}
                maxHeight="none"
              />
            ) : (
              <p className="text-sm text-foreground-muted">无法加载源码</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
