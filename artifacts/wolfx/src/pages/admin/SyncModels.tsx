import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListModelsQueryKey } from "@workspace/api-client-react";
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SyncResult {
  name: string;
  modelId: string;
  status: "available" | "unavailable" | "error";
  error?: string;
}

interface SyncResponse {
  results: SyncResult[];
  available: number;
  total: number;
}

export default function SyncModels() {
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [summary, setSummary] = useState<{ available: number; total: number } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setSyncing(true);
    setResults(null);
    try {
      const token = localStorage.getItem("wolfx_token");
      const res = await fetch("/api/admin/sync-models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Sync failed");
      }

      const data = await res.json() as SyncResponse;
      setResults(data.results);
      setSummary({ available: data.available, total: data.total });

      // Refresh models list
      await queryClient.invalidateQueries({ queryKey: getListModelsQueryKey() });

      toast({
        title: `Sync complete — ${data.available} models available`,
        description: `Tested ${data.total} models.`,
      });
    } catch (err: unknown) {
      toast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">NVIDIA Model Sync</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Test all candidate models against your API key and add working ones to the database.
          </p>
        </div>
        <Button size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Testing…</>
          ) : (
            <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Sync Models</>
          )}
        </Button>
      </div>

      {syncing && (
        <div className="border border-border rounded-lg p-4 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Testing models… this may take a minute.</p>
        </div>
      )}

      {results && summary && !syncing && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            {summary.available} of {summary.total} models available
          </p>
          <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
            {results.map((r) => (
              <div key={r.modelId} className="flex items-center gap-3 px-3 py-2">
                {r.status === "available" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{r.modelId}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  r.status === "available"
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
