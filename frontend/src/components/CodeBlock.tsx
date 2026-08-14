import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CopyIcon, CheckIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";

interface CodeBlockProps {
  code: string;
  language?: string;
  // 高亮行区间（1-based，闭区间）
  highlightStart?: number;
  highlightEnd?: number;
  showLineNumbers?: boolean;
  // 最大高度，超出滚动
  maxHeight?: number | string;
  className?: string;
}

// CodeBlock：代码 RAG 项目的核心展示组件
// - Prism 语法高亮（vsc-dark-plus 主题，背景覆盖为 code-bg）
// - 行号 + 指定行区间高亮（accent 半透明背景）
// - 复制按钮（复制成功 toast）
export function CodeBlock({
  code,
  language = "python",
  highlightStart,
  highlightEnd,
  showLineNumbers = true,
  maxHeight = 480,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败", "浏览器可能拒绝了剪贴板权限");
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-code-bg bg-code-bg overflow-hidden",
        className
      )}
    >
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-surface/80 text-foreground-muted opacity-0 backdrop-blur transition-all hover:bg-surface-hover hover:text-foreground group-hover:opacity-100"
        title="复制代码"
      >
        {copied ? <CheckIcon size={14} className="text-accent" /> : <CopyIcon size={14} />}
      </button>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        showLineNumbers={showLineNumbers}
        wrapLines
        customStyle={{
          margin: 0,
          padding: "14px 16px",
          background: "var(--code-bg)",
          fontSize: "13px",
          lineHeight: "1.6",
          fontFamily: "var(--font-mono)",
        }}
        codeTagProps={{
          style: { fontFamily: "var(--font-mono)" },
        }}
        lineNumberStyle={{
          color: "var(--foreground-subtle)",
          paddingRight: "16px",
          minWidth: "2.5em",
          userSelect: "none",
        }}
        lineProps={(lineNumber) => {
          const inHighlight =
            highlightStart != null &&
            highlightEnd != null &&
            lineNumber >= highlightStart &&
            lineNumber <= highlightEnd;
          return {
            style: {
              display: "block",
              backgroundColor: inHighlight
                ? "rgba(16, 185, 129, 0.12)"
                : "transparent",
              borderLeft: inHighlight
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              paddingLeft: "8px",
              marginLeft: "-8px",
            },
          };
        }}
      >
        {code}
      </SyntaxHighlighter>
      {maxHeight !== "none" && (
        <style>{`
          .group > div:first-child { max-height: ${typeof maxHeight === "number" ? maxHeight + "px" : maxHeight}; overflow: auto; }
        `}</style>
      )}
    </div>
  );
}
