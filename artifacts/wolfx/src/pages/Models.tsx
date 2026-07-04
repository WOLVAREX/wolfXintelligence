import { useListModels } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, Code2, MessageSquare, Brain, Eye } from "lucide-react";

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  code: { label: "Code", icon: Code2, color: "text-blue-400" },
  chat: { label: "Chat", icon: MessageSquare, color: "text-green-400" },
  reasoning: { label: "Reasoning", icon: Brain, color: "text-purple-400" },
  vision: { label: "Vision", icon: Eye, color: "text-orange-400" },
};

function formatContext(n: number | null | undefined) {
  if (!n) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

export default function Models() {
  const { data: models, isLoading } = useListModels();

  const categories = ["code", "chat", "reasoning", "vision"];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold">Models</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Available NVIDIA AI models</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : (
        categories.map((cat) => {
          const catModels = models?.filter((m) => m.category === cat) ?? [];
          if (!catModels.length) return null;
          const cfg = categoryConfig[cat] ?? { label: cat, icon: Cpu, color: "text-muted-foreground" };
          const Icon = cfg.icon;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{cfg.label}</h2>
                <span className="text-xs text-muted-foreground/60">({catModels.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {catModels.map((model) => (
                  <div
                    key={model.id}
                    className="border border-border rounded-lg p-4 bg-card hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{model.name}</p>
                        <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">{model.modelId}</p>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{model.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant={model.isEnabled ? "default" : "secondary"} className="text-[10px] h-5">
                        {model.isEnabled ? "Active" : "Disabled"}
                      </Badge>
                      {model.contextLength && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatContext(model.contextLength)} ctx
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
