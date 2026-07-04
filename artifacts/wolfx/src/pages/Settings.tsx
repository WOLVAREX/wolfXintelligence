import { useState } from "react";
import { useGetSettings, useUpdateSettings, useListModels, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, EyeOff, Key, Cpu } from "lucide-react";
import SyncModels from "@/pages/admin/SyncModels";

export default function Settings() {
  const { data: settings } = useGetSettings();
  const { data: models } = useListModels();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [defaultModelId, setDefaultModelId] = useState<number | "">(settings?.defaultModelId ?? "");

  const handleSave = async () => {
    try {
      const body: { nvidiaApiKey?: string; defaultModelId?: number } = {};
      if (apiKey.trim()) body.nvidiaApiKey = apiKey.trim();
      if (defaultModelId !== "") body.defaultModelId = Number(defaultModelId);

      await updateSettings.mutateAsync(body);
      await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      setApiKey("");
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-lg font-bold">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Configure your NVIDIA API and model preferences.</p>
        </div>

        {/* API Key */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">NVIDIA API Key</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Status:{" "}
            <span className={settings?.hasApiKey ? "text-green-500 font-medium" : "text-amber-500 font-medium"}>
              {settings?.hasApiKey ? "Configured ✓" : "Not set"}
            </span>
          </p>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings?.hasApiKey ? "Enter new key to replace…" : "nvapi-…"}
              className="w-full px-3 py-2 pr-9 text-sm bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors placeholder:text-muted-foreground/50"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </section>

        {/* Default model */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Default Model</h2>
          </div>
          <select
            value={defaultModelId}
            onChange={(e) => setDefaultModelId(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
          >
            <option value="">— Select a default model —</option>
            {(models ?? []).filter(m => m.isEnabled).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </section>

        <Button
          onClick={handleSave}
          disabled={updateSettings.isPending || (!apiKey.trim() && defaultModelId === "")}
          size="sm"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {updateSettings.isPending ? "Saving…" : "Save Settings"}
        </Button>

        {/* Model Sync */}
        <section className="border-t border-border pt-6">
          <SyncModels />
        </section>
      </div>
    </div>
  );
}
