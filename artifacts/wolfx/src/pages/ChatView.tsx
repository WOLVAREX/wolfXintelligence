import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import {
  useGetConversation,
  useListMessages,
  useListModels,
  getListMessagesQueryKey,
  getGetConversationQueryKey,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import ModelSelector from "@/components/ModelSelector";
import VoiceInput from "@/components/VoiceInput";
import { useTheme } from "@/contexts/ThemeContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  ArrowLeft, Send, Bot, User, Loader2, Zap, Code2, Copy, Check,
  Eye, GitCompare, Plus, Sun, Moon, LayoutPanelLeft, ChevronDown,
  ChevronRight, RefreshCw, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Constants ──────────────────────────────────────────────────────────── */
const THINKING_STEPS = [
  "Analyzing your request...",
  "Planning the response...",
  "Gathering relevant information...",
  "Preparing the final answer...",
];
const TOKEN_KEY = "wolfx_token";

function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface ApiMessage {
  id: number;
  role: string;
  content: string;
  tokensUsed?: number | null;
  createdAt?: string;
}

interface MultiModelResponse {
  modelId: number;
  modelName: string;
  content: string;
  tokensUsed: number;
}

type PreviewType = "html" | "markdown" | "svg" | null;

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function extractCodeBlocks(text: string) {
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  const blocks: { lang: string; code: string }[] = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    blocks.push({ lang: (m[1] || "text").toLowerCase(), code: m[2].trim() });
  }
  return blocks;
}

function detectPreview(content: string): { type: PreviewType; code: string } {
  const blocks = extractCodeBlocks(content);
  const html = blocks.find((b) => b.lang === "html");
  if (html) return { type: "html", code: html.code };
  const svg = blocks.find((b) => b.lang === "svg");
  if (svg) return { type: "svg", code: `<svg xmlns="http://www.w3.org/2000/svg">${svg.code}</svg>` };
  const md = blocks.find((b) => b.lang === "markdown" || b.lang === "md");
  if (md) return { type: "markdown", code: md.code };
  return { type: null, code: "" };
}

/* ─── CopyButton ─────────────────────────────────────────────────────────── */
function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      title="Copy"
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all",
        "text-muted-foreground hover:text-foreground hover:bg-white/10",
        className,
      )}
    >
      {copied ? <><Check className="w-3 h-3 text-green-400" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
    </button>
  );
}

/* ─── ThinkingIndicator ──────────────────────────────────────────────────── */
function ThinkingIndicator({ streamStarted }: { streamStarted: boolean }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (streamStarted) { setVisible(false); return; }
    const t = setInterval(() => setStep((s) => (s + 1) % THINKING_STEPS.length), 1600);
    return () => clearInterval(t);
  }, [streamStarted]);

  if (!visible) return null;

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 ring-1 ring-primary/20">
        <Bot className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="inline-flex items-center gap-2.5 bg-muted/60 border border-border/60 rounded-xl rounded-tl-sm px-3.5 py-2.5">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:0ms]" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:300ms]" />
          </div>
          <span className="text-xs text-muted-foreground animate-pulse">{THINKING_STEPS[step]}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── MarkdownContent ────────────────────────────────────────────────────── */
function MarkdownContent({ content, theme }: { content: string; theme: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="prose prose-sm dark:prose-invert max-w-none leading-relaxed"
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className ?? "");
          const code = String(children).replace(/\n$/, "");
          const isBlock = code.includes("\n") || (match && match[1]);
          if (!isBlock) {
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-[0.8em] font-mono text-foreground" {...props}>
                {children}
              </code>
            );
          }
          const lang = match?.[1] ?? "text";
          return (
            <div className="relative group my-2 rounded-lg overflow-hidden border border-border">
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-white/10">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">{lang}</span>
                <CopyButton text={code} />
              </div>
              <SyntaxHighlighter
                style={theme === "dark" ? oneDark : oneLight}
                language={lang}
                PreTag="div"
                customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.75rem", background: theme === "dark" ? "#18181b" : "#fafafa" }}
              >
                {code}
              </SyntaxHighlighter>
            </div>
          );
        },
        pre({ children }) { return <>{children}</>; },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return <th className="border border-border bg-muted px-3 py-1.5 text-left font-semibold">{children}</th>;
        },
        td({ children }) {
          return <td className="border border-border px-3 py-1.5">{children}</td>;
        },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">{children}</a>;
        },
        blockquote({ children }) {
          return <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground italic">{children}</blockquote>;
        },
        hr() { return <hr className="border-border my-3" />; },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/* ─── MessageBubble ──────────────────────────────────────────────────────── */
function MessageBubble({ role, content, tokensUsed, modelName, theme }: {
  role: string; content: string; tokensUsed?: number | null; modelName?: string | null; theme: string;
}) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex gap-3 flex-row-reverse group">
        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5 ring-1 ring-border">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="max-w-[80%] sm:max-w-[70%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 group">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 ring-1 ring-primary/20">
        <Bot className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <MarkdownContent content={content} theme={theme} />
        </div>
        <div className="flex items-center gap-2 mt-1.5 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {modelName && (
            <span className="text-[10px] text-muted-foreground/60 font-mono">{modelName}</span>
          )}
          {tokensUsed != null && tokensUsed > 0 && (
            <span className="text-[10px] text-muted-foreground/40 flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" />{tokensUsed.toLocaleString()} tokens
            </span>
          )}
          <CopyButton text={content} className="opacity-60 hover:opacity-100" />
        </div>
      </div>
    </div>
  );
}

/* ─── StreamingBubble ────────────────────────────────────────────────────── */
function StreamingBubble({ content, streamStarted, theme }: { content: string; streamStarted: boolean; theme: string }) {
  if (!streamStarted && !content) {
    return <ThinkingIndicator streamStarted={false} />;
  }

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 ring-1 ring-primary/20">
        <Bot className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          {content ? (
            <>
              <MarkdownContent content={content} theme={theme} />
              <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
            </>
          ) : (
            <ThinkingIndicator streamStarted={streamStarted} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── PreviewPanel ───────────────────────────────────────────────────────── */
function PreviewPanel({ content, theme }: { content: string; theme: string }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [iframeError, setIframeError] = useState(false);
  const { type: previewType, code: previewCode } = useMemo(() => detectPreview(content), [content]);
  const codeBlocks = useMemo(() => extractCodeBlocks(content), [content]);
  const [activeBlock, setActiveBlock] = useState(0);

  // Reset to preview tab when new previewable content arrives
  useEffect(() => {
    if (previewType) setTab("preview");
    setIframeError(false);
  }, [content, previewType]);

  const blobUrl = useMemo(() => {
    if (previewType === "html" || previewType === "svg") {
      return URL.createObjectURL(new Blob([previewCode], { type: "text/html" }));
    }
    return null;
  }, [previewCode, previewType]);

  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  if (!codeBlocks.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground/40 p-8">
        <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center">
          <Code2 className="w-7 h-7" />
        </div>
        <p className="text-sm text-center font-medium text-muted-foreground/50">Code and previews appear here</p>
        <p className="text-xs text-center text-muted-foreground/30">Ask the AI to write HTML, components, or other code</p>
      </div>
    );
  }

  const currentBlock = codeBlocks[activeBlock] ?? codeBlocks[0];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card flex-shrink-0">
        {/* Block tabs */}
        {codeBlocks.length > 1 && (
          <div className="flex gap-1 mr-1 overflow-x-auto">
            {codeBlocks.map((b, i) => (
              <button
                key={i}
                onClick={() => setActiveBlock(i)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded font-mono whitespace-nowrap transition-colors",
                  i === activeBlock ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {b.lang}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        {/* View toggle */}
        {previewType && (
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setTab("preview")}
              className={cn("text-[10px] px-2.5 py-1 flex items-center gap-1 transition-colors",
                tab === "preview" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary")}
            >
              <Eye className="w-3 h-3" />Preview
            </button>
            <button
              onClick={() => setTab("code")}
              className={cn("text-[10px] px-2.5 py-1 flex items-center gap-1 transition-colors border-l border-border",
                tab === "code" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary")}
            >
              <Code2 className="w-3 h-3" />Code
            </button>
          </div>
        )}
        <CopyButton text={currentBlock.code} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === "preview" && previewType === "html" && blobUrl && !iframeError && (
          <iframe
            key={blobUrl}
            src={blobUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="Preview"
            onError={() => setIframeError(true)}
          />
        )}
        {tab === "preview" && previewType === "markdown" && (
          <div className="h-full overflow-y-auto p-5">
            <MarkdownContent content={previewCode} theme={theme} />
          </div>
        )}
        {(tab === "code" || !previewType || iframeError) && (
          <div className="h-full overflow-auto">
            {iframeError && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-destructive/10 border-b border-destructive/20 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5" />Preview failed — showing source code
              </div>
            )}
            <SyntaxHighlighter
              style={theme === "dark" ? oneDark : oneLight}
              language={currentBlock.lang}
              customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.72rem", minHeight: "100%", background: theme === "dark" ? "#18181b" : "#fafafa" }}
              showLineNumbers
            >
              {currentBlock.code}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ComparePanel ───────────────────────────────────────────────────────── */
function ComparePanel({ responses, isLoading, errors, theme }: {
  responses: MultiModelResponse[]; isLoading: boolean; errors?: string[]; theme: string;
}) {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Querying all selected models...</p>
      </div>
    );
  }
  if (!responses.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground/40 p-8">
        <GitCompare className="w-10 h-10" />
        <p className="text-sm text-center font-medium text-muted-foreground/50">Select multiple models to compare responses side by side</p>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {errors?.map((e, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{e}
        </div>
      ))}
      {responses.map((r) => (
        <div key={r.modelId} className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="flex items-center justify-between px-3 py-2 bg-secondary/40 border-b border-border">
            <div className="flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold">{r.modelName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" />{r.tokensUsed.toLocaleString()}
              </span>
              <CopyButton text={r.content} />
            </div>
          </div>
          <div className="p-3 max-h-64 overflow-y-auto">
            <MarkdownContent content={r.content} theme={theme} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── PromptBar ──────────────────────────────────────────────────────────── */
function PromptBar({ input, setInput, onSend, isBusy, agentModelId, effectiveModelIds, setSelectedModelIds }: {
  input: string; setInput: (v: string) => void; onSend: (content: string) => void;
  isBusy: boolean; agentModelId?: number; effectiveModelIds: number[]; setSelectedModelIds: (ids: number[]) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(input); }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  return (
    <div className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur-sm px-3 pb-3 pt-2.5">
      <div className="max-w-3xl mx-auto">
        <div className="border border-border rounded-xl bg-card focus-within:border-primary/50 focus-within:shadow-sm focus-within:shadow-primary/5 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isBusy}
            placeholder={effectiveModelIds.length > 1
              ? `Compare ${effectiveModelIds.length} models — type a message`
              : "Message (Enter to send, Shift+Enter for newline)"}
            rows={1}
            className="w-full bg-transparent text-sm resize-none min-h-[40px] max-h-[160px] focus:outline-none rounded-t-xl px-3.5 pt-3 pb-1 text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60"
          />
          <div className="flex items-center gap-1.5 px-2.5 pb-2">
            <ModelSelector
              primaryModelId={agentModelId}
              selectedModelIds={effectiveModelIds}
              onSelectionChange={setSelectedModelIds}
              maxExtra={3}
            />
            <div className="flex-1" />
            <VoiceInput
              onTranscript={(text) => setInput(input ? `${input} ${text}` : text)}
              disabled={isBusy}
            />
            <Button
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => onSend(input)}
              disabled={!input.trim() || isBusy}
            >
              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/30 text-center mt-1.5">AI can make mistakes. Verify important information.</p>
      </div>
    </div>
  );
}

/* ─── Main ChatView ──────────────────────────────────────────────────────── */
export default function ChatView() {
  const { id } = useParams<{ id: string }>();
  const convId = parseInt(id ?? "", 10);
  const search = useSearch();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { theme, toggle: toggleTheme } = useTheme();

  const searchParams = new URLSearchParams(search);
  const initPrompt = (() => {
    try { return decodeURIComponent(searchParams.get("init") ?? ""); } catch { return ""; }
  })();
  const [isWorkspace, setIsWorkspace] = useState(searchParams.get("workspace") === "1");

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [streamStarted, setStreamStarted] = useState(false);
  const [rightTab, setRightTab] = useState<"preview" | "compare">("preview");
  const [multiResponses, setMultiResponses] = useState<MultiModelResponse[]>([]);
  const [multiErrors, setMultiErrors] = useState<string[]>([]);
  const [isMultiLoading, setIsMultiLoading] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState<number[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const initSent = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isValidId = !isNaN(convId) && convId > 0;

  const { data: conversation } = useGetConversation(convId, {
    query: { enabled: isValidId, queryKey: getGetConversationQueryKey(convId) },
  });
  const { data: messages, isLoading: messagesLoading } = useListMessages(convId, {
    query: { enabled: isValidId, queryKey: getListMessagesQueryKey(convId) },
  });
  const { data: models } = useListModels();

  const agentModelId = conversation?.modelId ?? undefined;
  const effectiveModelIds = selectedModelIds.length ? selectedModelIds : agentModelId ? [agentModelId] : [];

  useEffect(() => {
    if (agentModelId && !selectedModelIds.length) setSelectedModelIds([agentModelId]);
  }, [agentModelId]);

  // Auto-scroll when messages change or while streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent, isStreaming]);

  // Auto-open workspace when previewable content arrives
  useEffect(() => {
    const lastMsg = [...(messages ?? [])].reverse().find((m) => m.role === "assistant");
    if (lastMsg) {
      const { type } = detectPreview(lastMsg.content);
      if (type) setIsWorkspace(true);
    }
  }, [messages]);

  const lastAssistantContent = useMemo(
    () => [...(messages ?? [])].reverse().find((m) => m.role === "assistant")?.content ?? "",
    [messages],
  );

  const invalidateMessages = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(convId) });
    queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(convId) });
    queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
  }, [queryClient, convId]);

  const doSend = useCallback((content: string) => {
    if (!content.trim() || isStreaming || isMultiLoading || !isValidId) return;
    setInput("");

    if (effectiveModelIds.length > 1) {
      // Multi-model compare
      setIsMultiLoading(true);
      setMultiErrors([]);
      setRightTab("compare");
      if (!isWorkspace) setIsWorkspace(true);

      void fetch(`/api/conversations/${convId}/multi-chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content: content.trim(), modelIds: effectiveModelIds }),
      })
        .then(async (r) => {
          if (!r.ok) {
            const e = await r.json().catch(() => ({})) as { error?: string };
            throw new Error(e.error ?? "Multi-chat failed");
          }
          return r.json() as Promise<{ responses: MultiModelResponse[]; errors?: string[] }>;
        })
        .then((data) => {
          setMultiResponses(data.responses);
          setMultiErrors(data.errors ?? []);
          invalidateMessages();
        })
        .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }))
        .finally(() => setIsMultiLoading(false));
      return;
    }

    // Single model — streaming
    setIsStreaming(true);
    setStreamContent("");
    setStreamStarted(false);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    void (async () => {
      try {
        const res = await fetch(`/api/conversations/${convId}/stream`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ content: content.trim() }),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const e = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(e.error ?? `Error ${res.status}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6)) as {
                type: string; content?: string; message?: ApiMessage; error?: string;
              };
              if (evt.type === "delta" && evt.content) {
                setStreamStarted(true);
                setStreamContent((prev) => prev + evt.content);
              } else if (evt.type === "done") {
                invalidateMessages();
              } else if (evt.type === "error") {
                throw new Error(evt.error);
              }
            } catch { /* skip malformed event */ }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Something went wrong";
        toast({ title: "Error sending message", description: msg, variant: "destructive" });
      } finally {
        setIsStreaming(false);
        setStreamContent("");
        setStreamStarted(false);
        abortRef.current = null;
      }
    })();
  }, [convId, effectiveModelIds, isStreaming, isMultiLoading, isValidId, isWorkspace, invalidateMessages, toast]);

  useEffect(() => {
    if (initPrompt && !initSent.current && !messagesLoading && messages !== undefined) {
      initSent.current = true;
      doSend(initPrompt);
    }
  }, [initPrompt, messagesLoading, messages, doSend]);

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const isBusy = isStreaming || isMultiLoading;

  const messagesArea = (
    <div className="flex-1 overflow-y-auto scroll-smooth">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {messagesLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className={cn("flex gap-3", i % 2 === 1 && "flex-row-reverse")}>
              <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
              <Skeleton className={cn("h-16 rounded-2xl", i % 2 === 0 ? "w-3/4" : "w-1/2")} />
            </div>
          ))
        ) : !messages?.length && !isStreaming ? (
          <div className="flex flex-col items-center justify-center min-h-[55vh] gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Ready to chat</p>
              <p className="text-xs text-muted-foreground mt-1">
                {conversation?.modelName ?? "Select a model to get started"}
              </p>
            </div>
          </div>
        ) : (
          (messages ?? []).map((msg: ApiMessage) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              tokensUsed={msg.tokensUsed}
              modelName={msg.role === "assistant" ? conversation?.modelName : null}
              theme={theme}
            />
          ))
        )}

        {isStreaming && (
          <StreamingBubble content={streamContent} streamStarted={streamStarted} theme={theme} />
        )}

        <div ref={messagesEndRef} className="h-2" />
      </div>
    </div>
  );

  const promptBar = (
    <PromptBar
      input={input}
      setInput={setInput}
      onSend={doSend}
      isBusy={isBusy}
      agentModelId={agentModelId}
      effectiveModelIds={effectiveModelIds}
      setSelectedModelIds={setSelectedModelIds}
    />
  );

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background/95 backdrop-blur-sm flex-shrink-0 min-h-[48px]">
        <button
          onClick={() => { abortRef.current?.abort(); navigate("/"); }}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-border flex-shrink-0" />

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium truncate">{conversation?.title ?? "Chat"}</span>
          {conversation?.modelName && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono flex-shrink-0 border-primary/25 text-primary hidden sm:inline-flex">
              {conversation.modelName}
            </Badge>
          )}
          {isStreaming && (
            <span className="text-[10px] text-primary/70 flex items-center gap-1 flex-shrink-0">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />streaming
            </span>
          )}
        </div>

        {/* Workspace toggle */}
        <button
          onClick={() => setIsWorkspace((w) => !w)}
          title={isWorkspace ? "Chat view" : "Workspace view"}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded transition-colors flex-shrink-0",
            isWorkspace ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary",
          )}
        >
          <LayoutPanelLeft className="w-4 h-4" />
        </button>

        {isWorkspace && (
          <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as "preview" | "compare")}>
            <TabsList className="h-7 bg-secondary/40">
              <TabsTrigger value="preview" className="text-xs h-6 gap-1 px-2.5">
                <Eye className="w-3 h-3" />Preview
              </TabsTrigger>
              <TabsTrigger value="compare" className="text-xs h-6 gap-1 px-2.5">
                <GitCompare className="w-3 h-3" />Compare
                {effectiveModelIds.length > 1 && (
                  <Badge className="h-3.5 w-3.5 p-0 text-[8px] flex items-center justify-center ml-0.5">
                    {effectiveModelIds.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <button
          onClick={toggleTheme}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Body */}
      {isWorkspace ? (
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={45} minSize={28}>
              <div className="h-full flex flex-col">
                {messagesArea}
                {promptBar}
              </div>
            </Panel>
            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors cursor-col-resize" />
            <Panel defaultSize={55} minSize={25} className="border-l border-border bg-muted/10">
              <div className="h-full overflow-hidden">
                {rightTab === "preview"
                  ? <PreviewPanel content={lastAssistantContent} theme={theme} />
                  : <ComparePanel responses={multiResponses} isLoading={isMultiLoading} errors={multiErrors} theme={theme} />}
              </div>
            </Panel>
          </PanelGroup>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {messagesArea}
          {promptBar}
        </div>
      )}
    </div>
  );
}
