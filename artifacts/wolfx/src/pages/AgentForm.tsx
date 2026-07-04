import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  useListModels,
  useGetAgent,
  useCreateAgent,
  useUpdateAgent,
  getListAgentsQueryKey,
  getGetAgentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bot, Save } from "lucide-react";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant powered by NVIDIA AI models. Be concise, accurate, and helpful.";

export default function AgentForm() {
  const params = useParams<{ id?: string }>();
  const agentId = params.id ? parseInt(params.id, 10) : undefined;
  const isEdit = !!agentId;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: models } = useListModels();
  const { data: existing } = useGetAgent(agentId!, {
    query: { enabled: isEdit, queryKey: getGetAgentQueryKey(agentId!) },
  });
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modelId, setModelId] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);

  useEffect(() => {
    if (existing && isEdit) {
      setName(existing.name);
      setDescription(existing.description ?? "");
      setModelId(String(existing.modelId));
      setSystemPrompt(existing.systemPrompt);
      setTemperature(existing.temperature ?? 0.7);
      setMaxTokens(existing.maxTokens ?? 2048);
    }
  }, [existing, isEdit]);

  const isPending = createAgent.isPending || updateAgent.isPending;

  const handleSubmit = () => {
    if (!name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (!modelId) { toast({ title: "Select a model", variant: "destructive" }); return; }
    if (!systemPrompt.trim()) { toast({ title: "System prompt required", variant: "destructive" }); return; }

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      modelId: parseInt(modelId, 10),
      systemPrompt: systemPrompt.trim(),
      temperature,
      maxTokens,
    };

    if (isEdit) {
      updateAgent.mutate(
        { id: agentId!, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId!) });
            toast({ title: "Agent updated" });
            navigate("/agents");
          },
          onError: () => toast({ title: "Error", description: "Failed to update agent.", variant: "destructive" }),
        }
      );
    } else {
      createAgent.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
            toast({ title: "Agent created" });
            navigate("/agents");
          },
          onError: () => toast({ title: "Error", description: "Failed to create agent.", variant: "destructive" }),
        }
      );
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/agents")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{isEdit ? "Edit Agent" : "New Agent"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure your AI agent</p>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Agent Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name *</Label>
            <Input placeholder="e.g. Code Assistant" value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input placeholder="What does this agent do?" value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">NVIDIA Model *</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select a model..." />
              </SelectTrigger>
              <SelectContent>
                {["code", "chat", "reasoning", "vision"].map((cat) => {
                  const catModels = models?.filter((m) => m.category === cat && m.isEnabled) ?? [];
                  if (!catModels.length) return null;
                  return (
                    <div key={cat}>
                      <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{cat}</div>
                      {catModels.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">System Prompt *</Label>
            <Textarea
              placeholder="You are a helpful AI assistant..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
              className="text-sm font-mono resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Temperature</Label>
                <span className="text-xs font-mono text-muted-foreground">{temperature.toFixed(2)}</span>
              </div>
              <Slider
                min={0} max={1} step={0.01}
                value={[temperature]}
                onValueChange={([v]) => setTemperature(v)}
              />
              <p className="text-[10px] text-muted-foreground">Lower = more deterministic</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Max Tokens</Label>
              <Input
                type="number"
                min={256}
                max={32768}
                step={256}
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 2048)}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={isPending} className="gap-2">
          <Save className="w-4 h-4" />
          {isPending ? "Saving..." : isEdit ? "Update Agent" : "Create Agent"}
        </Button>
        <Button variant="outline" onClick={() => navigate("/agents")}>Cancel</Button>
      </div>
    </div>
  );
}
