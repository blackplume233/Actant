import { useTranslation } from "react-i18next";
import { Bot, Maximize2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CanvasEntry } from "@/hooks/use-realtime";
import { useState, useRef, useEffect, useCallback } from "react";

const RESIZE_SCRIPT = `<script>(function(){var s=function(){parent.postMessage({t:'canvas-h',h:document.documentElement.scrollHeight},'*')};new ResizeObserver(s).observe(document.body);s()})()</script>`;

function useAutoResizeIframe(srcDoc: string | undefined, enabled: boolean) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  const onMessage = useCallback((e: MessageEvent) => {
    if (e.data?.t === "canvas-h" && typeof e.data.h === "number" && ref.current) {
      if (e.source === ref.current.contentWindow) {
        setHeight(e.data.h);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onMessage, enabled]);

  useEffect(() => { setHeight(null); }, [srcDoc]);

  const injected = enabled && srcDoc
    ? srcDoc.replace(/<\/body>/i, RESIZE_SCRIPT + "</body>")
    : srcDoc;

  return { ref, height: enabled ? height : null, injectedSrc: injected };
}

interface AgentCanvasProps {
  agentName: string;
  entry?: CanvasEntry;
  showHeader?: boolean;
  /** When true the iframe grows to match content; when false it uses a fixed height with scroll. */
  autoResize?: boolean;
}

const FIXED_HEIGHT = 320;

export function AgentCanvas({ agentName, entry, showHeader = true, autoResize = false }: AgentCanvasProps) {
  const { t } = useTranslation();
  const [fullscreen, setFullscreen] = useState(false);
  const { ref, height, injectedSrc } = useAutoResizeIframe(entry?.html, autoResize);

  if (fullscreen && entry) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{agentName}</span>
            {entry.title && (
              <Badge variant="secondary" className="text-[10px]">{entry.title}</Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setFullscreen(false)}>
            {t("common.back")}
          </Button>
        </div>
        <iframe
          srcDoc={injectedSrc}
          sandbox="allow-scripts"
          className="flex-1 bg-white"
          title={`Canvas: ${agentName}`}
        />
      </div>
    );
  }

  if (!entry) {
    return (
      <Card>
        <CardContent className="p-5">
          {showHeader && (
            <div className="mb-4 flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{agentName}</span>
            </div>
          )}
          <div className="space-y-2">
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
          <p className="mt-4 text-center text-[11px] text-muted-foreground/60">
            {t("canvas.awaitingStream")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-blue-500" />
      <CardContent className="p-5 pt-4">
        {showHeader && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                <Bot className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold">{agentName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {entry.title ?? "canvas"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setFullscreen(true)}
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        <div className={showHeader ? "mt-3" : ""}>
          <iframe
            ref={ref}
            srcDoc={injectedSrc}
            sandbox="allow-scripts"
            className="w-full rounded border bg-white transition-[height] duration-200"
            style={
              autoResize
                ? { height: height ? `${height}px` : "auto", minHeight: 120 }
                : { height: FIXED_HEIGHT }
            }
            title={`Canvas: ${agentName}`}
          />
          <p className="mt-1 text-right text-[10px] text-muted-foreground/50">
            {t("canvas.updatedAt", { time: new Date(entry.updatedAt).toLocaleTimeString() })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
