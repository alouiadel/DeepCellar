import { marked } from "marked";
import DOMPurify from "dompurify";
import { useMemo } from "react";
import { cn } from "@/shared/lib/utils";

marked.setOptions({ breaks: true, gfm: true });

export default function MessageBubble({
  role,
  content,
  thinking,
  error,
  streaming,
}) {
  const html = useMemo(() => {
    if (!content || error || role !== "assistant") return null;
    return DOMPurify.sanitize(marked.parse(content));
  }, [content, error, role]);

  return (
    <div
      className={cn(
        "max-w-[min(720px,92%)] rounded-2xl px-4 py-3",
        role === "user"
          ? "ml-auto bg-primary text-primary-foreground"
          : "mr-auto border border-border bg-card",
        error && "border-destructive/50 text-destructive",
      )}
    >
      {thinking ? (
        <details className="mb-2 rounded-md border border-border/60 bg-black/20 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">
            {streaming ? "Thinking…" : "Thinking"}
          </summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans">{thinking}</pre>
        </details>
      ) : null}
      {error ? (
        <p className="text-sm">⚠ {error}</p>
      ) : html ? (
        <div className="bubble-md" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="whitespace-pre-wrap text-sm">{content}</div>
      )}
    </div>
  );
}
