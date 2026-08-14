import { useEffect, useState } from "react";
import { ListIcon, SunIcon, MoonIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useTheme } from "@/hooks/useTheme";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TopBarProps {
  onMenuClick?: () => void;
}

// TopBar：移动端汉堡菜单 + 页面标题占位 + 主题切换 + 后端健康状态点
export function TopBar({ onMenuClick }: TopBarProps) {
  const { theme, toggle } = useTheme();
  const [health, setHealth] = useState<"ok" | "down" | "checking">("checking");

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        await api.health();
        if (active) setHealth("ok");
      } catch {
        if (active) setHealth("down");
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/80 px-4 backdrop-blur-md shrink-0 z-30">
      <div className="flex items-center gap-3">
        {/* 移动端汉堡 */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <ListIcon size={20} />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        {/* 后端健康状态 */}
        <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
          <motion.span
            animate={{
              opacity: health === "checking" ? [0.4, 1, 0.4] : 1,
            }}
            transition={
              health === "checking"
                ? { duration: 1.5, repeat: Infinity }
                : { duration: 0 }
            }
            className={cn(
              "h-2 w-2 rounded-full",
              health === "ok" && "bg-accent",
              health === "down" && "bg-danger",
              health === "checking" && "bg-warning"
            )}
          />
          <span className="hidden sm:inline">
            {health === "ok" ? "后端已连接" : health === "down" ? "后端未响应" : "连接中"}
          </span>
        </div>

        {/* 主题切换 */}
        <Button variant="ghost" size="icon" onClick={toggle} title="切换主题">
          <motion.div
            key={theme}
            initial={{ rotate: -30, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </motion.div>
        </Button>
      </div>
    </header>
  );
}
