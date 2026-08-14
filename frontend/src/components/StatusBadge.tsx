import { motion } from "motion/react";
import { CircleNotchIcon, CheckCircleIcon, WarningCircleIcon, CircleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import type { RepoStatus } from "@/types";

// 仓库索引状态徽章：4 态对应不同图标和颜色
const config: Record<
  RepoStatus,
  { variant: "default" | "accent" | "warning" | "danger"; icon: React.ReactNode; label: string }
> = {
  pending: {
    variant: "default",
    icon: <CircleIcon size={11} weight="fill" />,
    label: "待索引",
  },
  indexing: {
    variant: "warning",
    icon: <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><CircleNotchIcon size={11} weight="bold" /></motion.span>,
    label: "索引中",
  },
  indexed: {
    variant: "accent",
    icon: <CheckCircleIcon size={11} weight="fill" />,
    label: "已索引",
  },
  error: {
    variant: "danger",
    icon: <WarningCircleIcon size={11} weight="fill" />,
    label: "失败",
  },
};

export function StatusBadge({ status }: { status: RepoStatus }) {
  const c = config[status];
  return (
    <Badge variant={c.variant}>
      {c.icon}
      {c.label}
    </Badge>
  );
}
