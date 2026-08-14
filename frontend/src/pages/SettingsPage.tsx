import { useEffect, useState } from "react";
import {
  BrainIcon,
  CubeIcon,
  ScissorsIcon,
  ChatTeardropIcon,
  FloppyDiskIcon,
  KeyIcon,
  GlobeIcon,
  CpuIcon,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label, Skeleton, Separator } from "@/components/ui/primitives";
import { Card } from "@/components/ui/card";
import type { Settings } from "@/types";

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings
      .get()
      .then(setSettings)
      .catch((e) => toast.error("加载设置失败", e instanceof Error ? e.message : ""))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      // 直接提交整个表单，后端会过滤掉含 **** 的占位符字段
      const updated = await api.settings.update(settings);
      setSettings(updated);
      toast.success("设置已保存", "下次索引/检索/对话时生效");
    } catch (e) {
      toast.error("保存失败", e instanceof Error ? e.message : "");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="h-full overflow-auto p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4 max-w-3xl">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              配置 LLM / Embedding 模型与 RAG 超参，保存后立即生效
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <FloppyDiskIcon size={16} weight="fill" />
            {saving ? "保存中" : "保存"}
          </Button>
        </div>

        <div className="space-y-5">
          {/* LLM 配置 */}
          <Card className="p-5">
            <SectionHeader icon={<BrainIcon size={16} />} title="LLM 对话模型" />
            <Separator className="my-4" />
            <div className="space-y-4">
              <Field
                label="API Key"
                hint="脱敏回显，不改动则保持原值"
                icon={<KeyIcon size={14} />}
              >
                <Input
                  type="password"
                  value={settings.llm_api_key}
                  onChange={(e) => update("llm_api_key", e.target.value)}
                  placeholder="sk-..."
                  className="font-mono"
                />
              </Field>
              <Field label="接口地址" icon={<GlobeIcon size={14} />}>
                <Input
                  value={settings.llm_base_url}
                  onChange={(e) => update("llm_base_url", e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="font-mono"
                />
              </Field>
              <Field label="模型名称" icon={<CpuIcon size={14} />}>
                <Input
                  value={settings.llm_model}
                  onChange={(e) => update("llm_model", e.target.value)}
                  placeholder="gpt-4o"
                  className="font-mono"
                />
              </Field>
            </div>
          </Card>

          {/* Embedding 配置 */}
          <Card className="p-5">
            <SectionHeader icon={<CubeIcon size={16} />} title="Embedding 向量模型" />
            <Separator className="my-4" />
            <div className="space-y-4">
              <Field
                label="API Key"
                hint="可与 LLM Key 不同，独立配置"
                icon={<KeyIcon size={14} />}
              >
                <Input
                  type="password"
                  value={settings.embedding_api_key}
                  onChange={(e) => update("embedding_api_key", e.target.value)}
                  placeholder="sk-..."
                  className="font-mono"
                />
              </Field>
              <Field label="接口地址" icon={<GlobeIcon size={14} />}>
                <Input
                  value={settings.embedding_base_url}
                  onChange={(e) => update("embedding_base_url", e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="font-mono"
                />
              </Field>
              <Field label="模型名称" icon={<CpuIcon size={14} />}>
                <Input
                  value={settings.embedding_model}
                  onChange={(e) => update("embedding_model", e.target.value)}
                  placeholder="text-embedding-3-small"
                  className="font-mono"
                />
              </Field>
            </div>
          </Card>

          {/* 分块 + 检索参数 */}
          <Card className="p-5">
            <SectionHeader icon={<ScissorsIcon size={16} />} title="RAG 超参" />
            <Separator className="my-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="分块大小" hint="单块最大字符数">
                <Input
                  type="number"
                  value={settings.chunk_size}
                  onChange={(e) => update("chunk_size", Number(e.target.value))}
                  className="font-mono"
                />
              </Field>
              <Field label="分块重叠" hint="相邻块重叠字符">
                <Input
                  type="number"
                  value={settings.chunk_overlap}
                  onChange={(e) => update("chunk_overlap", Number(e.target.value))}
                  className="font-mono"
                />
              </Field>
              <Field label="Top-K" hint="检索返回条数">
                <Input
                  type="number"
                  value={settings.top_k}
                  onChange={(e) => update("top_k", Number(e.target.value))}
                  className="font-mono"
                />
              </Field>
            </div>
            <p className="mt-3 text-xs text-foreground-subtle">
              分块参数变更后需重新索引已有仓库才生效；Top-K 立即生效
            </p>
          </Card>

          {/* 系统提示词 */}
          <Card className="p-5">
            <SectionHeader icon={<ChatTeardropIcon size={16} />} title="系统提示词" />
            <Separator className="my-4" />
            <Field label="System Prompt" hint="约束 LLM 的角色与回答风格">
              <Textarea
                value={settings.system_prompt}
                onChange={(e) => update("system_prompt", e.target.value)}
                rows={4}
                className="resize-y"
              />
            </Field>
          </Card>

          {/* 保存按钮（底部） */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="lg">
              <FloppyDiskIcon size={16} weight="fill" />
              {saving ? "保存中..." : "保存设置"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-accent">{icon}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

function Field({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          {icon && <span className="text-foreground-subtle">{icon}</span>}
          {label}
        </Label>
        {hint && <span className="text-[11px] text-foreground-subtle">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
