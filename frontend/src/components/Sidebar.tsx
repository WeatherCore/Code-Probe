import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  StackPlusIcon,
  ChatsCircleIcon,
  MagnifyingGlassIcon,
  GearIcon,
  PlusIcon,
  DatabaseIcon,
  HouseIcon,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Repo } from "@/types";

// 主导航项
const navItems = [
  { to: "/", label: "概览", icon: HouseIcon, end: true },
  { to: "/repos", label: "代码仓库", icon: DatabaseIcon },
  { to: "/chat", label: "AI 对话", icon: ChatsCircleIcon },
  { to: "/search", label: "搜索试验场", icon: MagnifyingGlassIcon },
  { to: "/settings", label: "设置", icon: GearIcon },
];

interface SidebarProps {
  onNavigate?: () => void; // 移动端点击后关闭抽屉
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const navigate = useNavigate();

  const loadRepos = async () => {
    try {
      const data = await api.repos.list();
      setRepos(data.slice(0, 5)); // 只展示最近 5 个
    } catch {
      /* 后端没起也不阻塞导航 */
    }
  };

  useEffect(() => {
    loadRepos();
    // 每 10 秒刷新一次（捕获索引状态变化）
    const timer = setInterval(loadRepos, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-surface">
      {/* Logo 区 */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-border shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent shadow-sm">
          <StackPlusIcon size={18} weight="bold" className="text-accent-foreground" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Code Probe</span>
          <span className="text-[11px] text-foreground-subtle">代码库 RAG 工作台</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-4">
          {/* 主导航 */}
          <nav className="space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent-soft text-accent"
                      : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                  )
                }
              >
                <item.icon size={18} weight="regular" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* 仓库快捷列表 */}
          <div className="mt-6">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">
                最近仓库
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => {
                  navigate("/repos");
                  onNavigate?.();
                }}
              >
                <PlusIcon size={14} />
              </Button>
            </div>
            <div className="space-y-0.5">
              {repos.length === 0 ? (
                <div className="px-3 py-2 text-xs text-foreground-subtle">
                  还没有仓库
                </div>
              ) : (
                repos.map((repo) => (
                  <NavLink
                    key={repo.repo_id}
                    to={`/repos/${repo.repo_id}`}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors group",
                        isActive
                          ? "bg-surface-hover text-foreground"
                          : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                      )
                    }
                  >
                    <span className="truncate font-medium">{repo.name}</span>
                    <StatusBadge status={repo.status} />
                  </NavLink>
                ))
              )}
            </div>
            {repos.length > 0 && (
              <NavLink
                to="/repos"
                onClick={onNavigate}
                className="mt-1 block px-3 py-1.5 text-xs text-accent hover:underline"
              >
                查看全部 →
              </NavLink>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* 底部：版本信息 */}
      <div className="border-t border-border px-5 py-3 shrink-0">
        <p className="text-[11px] text-foreground-subtle">
          v2.0.0 · FastAPI + ChromaDB
        </p>
      </div>
    </div>
  );
}
