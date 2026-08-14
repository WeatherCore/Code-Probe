import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  MagnifyingGlassIcon,
  DatabaseIcon,
  FileTextIcon,
  HashIcon,
  EyeIcon,
  LightningIcon,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScoreBar } from "@/components/ScoreBar";
import { CodeBlock } from "@/components/CodeBlock";
import { EmptyState } from "@/components/EmptyState";
import type { Repo, SearchResponse, PromptPreview } from "@/types";

export function SearchPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoId, setRepoId] = useState("");
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [preview, setPreview] = useState<PromptPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    api.repos.list().then((data) => {
      setRepos(data.filter((r) => r.status === "indexed"));
      if (data.length > 0 && !repoId) {
        const firstIndexed = data.find((r) => r.status === "indexed");
        if (firstIndexed) setRepoId(firstIndexed.repo_id);
      }
    }).catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!query.trim() || !repoId) {
      toast.warning("请输入查询并选择仓库");
      return;
    }
    setLoading(true);
    setResult(null);
    setPreview(null);
    try {
      const res = await api.search.query(query.trim(), repoId, topK);
      setResult(res);
    } catch (e) {
      toast.error("检索失败", e instanceof Error ? e.message : "");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!query.trim() || !repoId) {
      toast.warning("请输入查询并选择仓库");
      return;
    }
    setPreviewLoading(true);
    try {
      const p = await api.chat.promptPreview(query.trim(), repoId, null, topK);
      setPreview(p);
    } catch (e) {
      toast.error("预览失败", e instanceof Error ? e.message : "");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* 页头 */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">搜索试验场</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            独立测试语义检索效果，不经过 LLM。查看向量相似度命中、prompt 拼接、token 估算
          </p>
        </div>

        {/* 查询表单 */}
        <Card className="p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_120px_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="query">查询问题</Label>
              <Input
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="例如：用户登录验证逻辑在哪"
              />
            </div>
            <div className="space-y-1.5">
              <Label>代码仓库</Label>
              <Select value={repoId} onValueChange={setRepoId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择仓库" />
                </SelectTrigger>
                <SelectContent>
                  {repos.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-foreground-subtle">
                      暂无已索引仓库
                    </div>
                  ) : (
                    repos.map((r) => (
                      <SelectItem key={r.repo_id} value={r.repo_id}>
                        {r.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Top-K</Label>
              <Select value={String(topK)} onValueChange={(v) => setTopK(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 8, 10].map((k) => (
                    <SelectItem key={k} value={String(k)}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={loading}>
                <MagnifyingGlassIcon size={16} weight="bold" />
                {loading ? "检索中" : "检索"}
              </Button>
              <Button variant="outline" onClick={handlePreview} disabled={previewLoading}>
                <EyeIcon size={16} />
                {previewLoading ? "预览中" : "预览 Prompt"}
              </Button>
            </div>
          </div>
        </Card>

        {/* 结果区 */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : !result && !preview ? (
          <EmptyState
            icon={<MagnifyingGlassIcon size={28} />}
            title="输入查询开始检索"
            description="语义检索会把问题向量化，在代码库里找最相似的代码片段，按余弦相似度排序返回"
          />
        ) : (
          <Tabs defaultValue={result ? "results" : "prompt"}>
            <TabsList>
              <TabsTrigger value="results" disabled={!result}>
                <FileTextIcon size={14} /> 检索结果 {result ? `(${result.results.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="prompt" disabled={!preview}>
                <LightningIcon size={14} /> Prompt 预览
              </TabsTrigger>
              <TabsTrigger value="vector" disabled={!result}>
                <HashIcon size={14} /> 向量预览
              </TabsTrigger>
            </TabsList>

            {/* 检索结果 */}
            <TabsContent value="results">
              {result && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs text-foreground-muted">
                    <Badge variant="info">向量库 {result.total_searched} 条</Badge>
                    <span>共命中 {result.results.length} 个片段</span>
                  </div>
                  {result.results.map((hit, i) => (
                    <motion.div
                      key={hit.chunk_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Card className="overflow-hidden">
                        <div className="flex items-center justify-between gap-2 p-3 border-b border-border bg-surface-elevated">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] text-foreground-subtle font-mono">#{i + 1}</span>
                            <FileTextIcon size={14} className="text-accent shrink-0" />
                            <span className="text-xs font-mono text-foreground truncate">{hit.file_path}</span>
                            <Badge variant="outline" className="shrink-0">
                              L{hit.line_start}-{hit.line_end}
                            </Badge>
                          </div>
                          <ScoreBar score={hit.score} />
                        </div>
                        <CodeBlock
                          code={hit.content}
                          language="python"
                          showLineNumbers={false}
                          maxHeight={280}
                        />
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Prompt 预览 */}
            <TabsContent value="prompt">
              {preview && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs text-foreground-muted">
                    <Badge variant="accent">
                      预估 {preview.total_tokens_estimate} tokens
                    </Badge>
                    <Badge variant="info">
                      检索 {preview.retrieval_results.length} 片段
                    </Badge>
                  </div>
                  {[
                    { label: "System 角色", content: preview.prompt_parts.system, icon: <LightningIcon size={13} /> },
                    { label: "代码上下文", content: preview.prompt_parts.context, icon: <DatabaseIcon size={13} /> },
                    { label: "当前问题", content: preview.prompt_parts.user_message, icon: <HashIcon size={13} /> },
                  ].map((s) => (
                    <Card key={s.label} className="overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-elevated text-xs font-medium">
                        <span className="text-accent">{s.icon}</span>
                        {s.label}
                      </div>
                      <pre className="p-4 text-xs font-mono text-foreground-muted whitespace-pre-wrap break-words max-h-72 overflow-auto">
                        {s.content || "（空）"}
                      </pre>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 向量预览 */}
            <TabsContent value="vector">
              {result && (
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <HashIcon size={16} className="text-accent" />
                    <h3 className="text-sm font-semibold">问题向量预览</h3>
                    <Badge variant="outline">前 10 维</Badge>
                  </div>
                  <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                    {result.query_embedding_preview.map((v, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded-md border border-border bg-surface-elevated p-2 text-center"
                      >
                        <div className="text-[10px] text-foreground-subtle mb-0.5">[{i}]</div>
                        <div className="font-mono text-xs text-accent">
                          {v.toFixed(3)}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-foreground-subtle leading-relaxed">
                    这是问题文本经 Embedding 模型向量化后的前 10 个维度值。完整向量用于在 ChromaDB 中做余弦相似度检索，找到最接近的代码块向量。
                  </p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
