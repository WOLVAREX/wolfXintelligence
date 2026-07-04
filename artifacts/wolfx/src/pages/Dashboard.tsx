import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListConversations,
  useListModels,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import VoiceInput from "@/components/VoiceInput";
import ModelSelector from "@/components/ModelSelector";
import { useAuth } from "@/contexts/AuthContext";
import {
  Code2,
  Brain,
  MessageSquare,
  Sparkles,
  ArrowUp,
  ChevronRight,
  Zap,
  Clock,
} from "lucide-react";

const GREETINGS = [
  "Hi, what do you want to make?",
  "What are we building today?",
  "What's on your mind?",
  "Ready to build. What's first?",
  "What will you create today?",
  "Let's make something great.",
  "What should we work on?",
  "Got an idea? Let's build it.",
];

const QUICK_CHIPS = [
  { label: "Write code", icon: Code2, prompt: "Write a " },
  { label: "Chat & brainstorm", icon: MessageSquare, prompt: "Help me brainstorm " },
  { label: "Deep reasoning", icon: Brain, prompt: "Analyze and reason about " },
  { label: "Creative writing", icon: Sparkles, prompt: "Write a creative story about " },
];

const EXAMPLE_PROMPTS = [
  { text: "Build a REST API in Python with FastAPI" },
  { text: "Explain how neural networks learn" },
  { text: "Write unit tests for my React component" },
  { text: "Create a responsive landing page in HTML" },
  { text: "Help me brainstorm a startup idea" },
  { text: "Solve this algorithm problem" },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isCodeIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(build|create|write|code|implement|develop|make|generate|function|class|component|api|html|css|js|python|react|script)\b/.test(lower);
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [input, setInput] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  const { data: conversations } = useListConversations();
  const { data: models } = useListModels();

  const enabledModels = models?.filter((m) => m.isEnabled) ?? [];
  const defaultModelId = enabledModels[0]?.id;
  const effectiveModelId = selectedModelIds[0] ?? defaultModelId;

  // Resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [input]);

  const handleSend = async (content = input.trim()) => {
    if (!content || sending) return;

    if (!effectiveModelId) {
      toast({
        title: "No models available",
        description: "Ask your admin to sync NVIDIA models in Settings.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem("wolfx_token");
      const res = await fetch("/api/conversations/direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ modelId: effectiveModelId, title: content.slice(0, 60) }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed to start conversation");
      }

      const conv = await res.json() as { id: number };

      await queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });

      const shouldWorkspace = isCodeIntent(content);
      const params = new URLSearchParams({ init: content });
      if (shouldWorkspace) params.set("workspace", "1");

      navigate(`/chat/${conv.id}?${params.toString()}`);
    } catch (err: unknown) {
      toast({
        title: "Failed to start chat",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const recentConversations = (conversations ?? []).slice(0, 5);
  const noModels = enabledModels.length === 0;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0 overflow-y-auto">
        <div className="w-full max-w-2xl py-8">
          {/* Greeting */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight mb-1">{greeting}</h1>
            <p className="text-xs text-muted-foreground">
              Powered by NVIDIA AI models
              {user?.role === "admin" && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">Admin</span>
              )}
            </p>
          </div>

          {/* No models warning */}
          {noModels && (
            <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-center">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No AI models available yet.{" "}
                {user?.role === "admin" ? (
                  <button
                    onClick={() => navigate("/settings")}
                    className="underline hover:no-underline"
                  >
                    Go to Settings → Sync Models
                  </button>
                ) : (
                  "Contact your admin to set up models."
                )}
              </p>
            </div>
          )}

          {/* Quick chips */}
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {QUICK_CHIPS.map(({ label, icon: Icon, prompt }) => (
              <button
                key={label}
                onClick={() => setInput(prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-xs text-muted-foreground hover:text-foreground"
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Prompt box */}
          <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Ask anything, create something, build an idea…"
              rows={3}
              className="w-full px-4 pt-3.5 pb-2 text-sm bg-transparent outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed"
              style={{ minHeight: "80px" }}
            />
            <div className="flex items-center gap-2 px-3 pb-3">
              <VoiceInput onTranscript={(t) => setInput((prev) => prev + t)} />
              {/* Model selector */}
              <ModelSelector
                models={enabledModels}
                selectedModelIds={selectedModelIds.length ? selectedModelIds : effectiveModelId ? [effectiveModelId] : []}
                onSelectionChange={(ids) => setSelectedModelIds(ids)}
                maxExtra={0}
              />
              <div className="flex-1" />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || sending || noModels}
                className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex-shrink-0"
              >
                {sending ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>

          {/* Example prompts */}
          <div className="mt-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-2">Try an example</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {EXAMPLE_PROMPTS.map(({ text }) => (
                <button
                  key={text}
                  onClick={() => setInput(text)}
                  className="px-2.5 py-1 rounded-full border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent conversations */}
      {recentConversations.length > 0 && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 flex-shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-semibold">
                <Clock className="w-3 h-3" />
                Recent
              </div>
              <button onClick={() => navigate("/chat")} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5">
                All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recentConversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/chat/${c.id}`)}
                  className="flex-shrink-0 text-left border border-border rounded-lg px-3 py-2 bg-card hover:border-primary/40 transition-all min-w-[160px] max-w-[200px]"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Zap className="w-2.5 h-2.5 text-primary flex-shrink-0" />
                    <span className="text-xs font-medium truncate">{c.title}</span>
                  </div>
                  {c.modelName && (
                    <p className="text-[10px] text-muted-foreground/60 font-mono truncate">{c.modelName}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">{timeAgo(c.updatedAt)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
