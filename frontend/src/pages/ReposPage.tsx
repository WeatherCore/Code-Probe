import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  DatabaseIcon,
  PlusIcon,
  UploadSimpleIcon,
  FolderOpenIcon,
  TrashIcon,
  PlayIcon,
  EyeIcon,
  FileTextIcon,
  ClockIcon,
} from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Repo } from "@/types";

export function ReposPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Repo | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await api.repos.list();
      setRepos(data);
    } catch (e) {
      toast.error("加载仓库列表失败", e instanceof Error ? e.message : "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // 轮询：有 indexing 状态的仓库时加速刷新
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleTriggerIndex = async (repo: Repo) => {
    try {
      await api.repos.triggerIndex(repo.repo_id);
      toast.success("索引已启动", `正在为「${repo.name}」建立向量索引`);
      load();
    } catch (e) {
      toast.error("触发索引失败", e instanceof Error ? e.message : "");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.repos.remove(deleteTarget.repo_id);
      toast.success("仓库已删除", deleteTarget.name);
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error("删除失败", e instanceof Error ? e.message : "");
    }
  };

  const hasIndexing = repos.some((r) => r.status === "indexing");

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">代码仓库</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              管理代码库数据源，建立向量索引供 RAG 检索
              {hasIndexing && <span className="text-warning ml-2">· 有仓库正在索引</span>}
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon size={16} weight="bold" />
                添加仓库
              </Button>
            </DialogTrigger>
            <AddRepoDialog onSuccess={() => { setAddOpen(false); load(); }} />
          </Dialog>
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : repos.length === 0 ? (
          <EmptyState
            icon={<DatabaseIcon size={28} weight="regular" />}
            title="还没有任何代码仓库"
            description="添加一个本地目录或上传 zip 压缩包，建立向量索引后即可开始 RAG 问答"
            action={
              <Button onClick={() => setAddOpen(true)}>
                <PlusIcon size={16} weight="bold" />
                添加第一个仓库
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {repos.map((repo, i) => (
              <motion.div
                key={repo.repo_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
              >
                <Card className="p-4 hover:border-border-strong transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-accent">
                        <DatabaseIcon size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">{repo.name}</h3>
                          <StatusBadge status={repo.status} />
                          {repo.source === "upload" && (
                            <span className="text-[11px] text-foreground-subtle">zip 上传</span>
                          )}
                        </div>
                        <p className="text-xs text-foreground-subtle truncate font-mono mb-2">
                          {repo.path}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-foreground-muted">
                          <span className="flex items-center gap-1">
                            <FileTextIcon size={13} />
                            {repo.file_count} 文件
                          </span>
                          <span className="flex items-center gap-1">
                            <DatabaseIcon size={13} />
                            {repo.chunk_count} 分块
                          </span>
                          <span className="flex items-center gap-1">
                            <ClockIcon size={13} />
                            {formatTime(repo.created_at)}
                          </span>
                        </div>
                        {repo.status === "error" && repo.error_msg && (
                          <p className="mt-2 text-xs text-danger break-all">
                            错误：{repo.error_msg}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(repo.status === "pending" || repo.status === "error") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTriggerIndex(repo)}
                        >
                          <PlayIcon size={14} weight="fill" />
                          索引
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/repos/${repo.repo_id}`)}
                        title="查看详情"
                      >
                        <EyeIcon size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(repo)}
                        title="删除"
                        className="text-foreground-muted hover:text-danger"
                      >
                        <TrashIcon size={16} />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 删除确认 */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除仓库</DialogTitle>
            <DialogDescription>
              确认删除「{deleteTarget?.name}」？此操作会移除仓库记录、分块缓存和上传的源码文件，不可恢复。
              <br />
              <span className="text-warning">注意：ChromaDB 中的向量集合不会被清理（已知限制）。</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="danger" onClick={handleDelete}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 添加仓库对话框：Tab 切换 zip 上传 / 本地路径
function AddRepoDialog({ onSuccess }: { onSuccess: () => void }) {
  const [tab, setTab] = useState("upload");
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      toast.warning("请先选择 zip 文件");
      return;
    }
    setUploading(true);
    try {
      const repo = await api.repos.upload(file, name || undefined);
      toast.success("仓库已添加", repo.name);
      onSuccess();
      setFile(null);
      setName("");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "上传失败";
      toast.error("添加失败", msg);
    } finally {
      setUploading(false);
    }
  };

  const handleLocal = async () => {
    if (!path.trim()) {
      toast.warning("请输入本地路径");
      return;
    }
    setUploading(true);
    try {
      const repo = await api.repos.addLocal(path.trim(), name || undefined);
      toast.success("仓库已添加", repo.name);
      onSuccess();
      setPath("");
      setName("");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "添加失败";
      toast.error("添加失败", msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>添加代码仓库</DialogTitle>
        <DialogDescription>上传 zip 压缩包或直接引用服务器本地目录</DialogDescription>
      </DialogHeader>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="upload" className="flex-1">
            <UploadSimpleIcon size={14} /> ZIP 上传
          </TabsTrigger>
          <TabsTrigger value="local" className="flex-1">
            <FolderOpenIcon size={14} /> 本地路径
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="space-y-3 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="zip-file">压缩文件</Label>
            <div className="flex items-center gap-2">
              <Input
                id="zip-file"
                readOnly
                value={file?.name || ""}
                placeholder="选择 .zip 文件"
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={() => document.getElementById("zip-input")?.click()}
              >
                选择
              </Button>
              <input
                id="zip-input"
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zip-name">仓库名称（可选）</Label>
            <Input
              id="zip-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="留空则用文件名"
            />
          </div>
        </TabsContent>
        <TabsContent value="local" className="space-y-3 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="local-path">服务器目录绝对路径</Label>
            <Input
              id="local-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="例如 D:/projects/my-repo"
              className="font-mono text-xs"
            />
            <p className="text-xs text-foreground-subtle">
              路径必须是后端服务器上真实存在的目录
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="local-name">仓库名称（可选）</Label>
            <Input
              id="local-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="留空则用目录名"
            />
          </div>
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button
          onClick={tab === "upload" ? handleUpload : handleLocal}
          disabled={uploading}
        >
          {uploading ? "添加中..." : "添加"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
