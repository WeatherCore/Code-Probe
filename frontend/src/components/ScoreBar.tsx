import { cn } from "@/lib/utils";

// ScoreBar：相似度分数条，0-1 → 0-100%
// 颜色随分数变化：高(>0.7)=accent绿 / 中(0.4-0.7)=warning黄 / 低(<0.4)=danger红
export function ScoreBar({
  score,
  className,
  showLabel = true,
}: {
  score: number;
  className?: string;
  showLabel?: boolean;
}) {
  const pct = Math.round(score * 100);
  const colorClass =
    score >= 0.7 ? "bg-accent" : score >= 0.4 ? "bg-warning" : "bg-danger";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-hover">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="font-mono text-xs text-foreground-muted tabular-nums">
          {pct}%
        </span>
      )}
    </div>
  );
}
