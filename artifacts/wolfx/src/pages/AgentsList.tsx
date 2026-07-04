import { Link } from "wouter";
import { useListAgents, useDeleteAgent, getListAgentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Bot, Edit2, Trash2, MessageSquare, ChevronRight } from "lucide-react";

export default function AgentsList() {
  const { data: agents, isLoading } = useListAgents();
  const deleteAgent = useDeleteAgent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete agent "${name}"? All its conversations will be removed.`)) return;
    deleteAgent.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
          toast({ title: "Agent deleted" });
        },
        onError: () => toast({ title: "Error", description: "Failed to delete agent.", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Agents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure your AI agents</p>
        </div>
        <Link href="/agents/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Agent
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : !agents?.length ? (
        <div className="border border-border rounded-lg p-10 text-center space-y-3">
          <Bot className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium">No agents yet</p>
          <p className="text-xs text-muted-foreground">Create your first agent to start having AI conversations.</p>
          <Link href="/agents/new">
            <Button size="sm" className="gap-1.5 mt-1">
              <Plus className="w-3.5 h-3.5" />
              Create Agent
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="border border-border rounded-lg p-4 bg-card hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{agent.name}</span>
                    {agent.modelName && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {agent.modelName}
                      </Badge>
                    )}
                  </div>
                  {agent.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{agent.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground/70 mt-1 font-mono truncate">
                    {agent.systemPrompt.slice(0, 80)}…
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mr-2">
                    <MessageSquare className="w-3 h-3" />
                    {agent.conversationCount ?? 0}
                  </span>
                  <Link href={`/chat/new?agentId=${agent.id}`}>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
                      Chat
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </Link>
                  <Link href={`/agents/${agent.id}/edit`}>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(agent.id, agent.name)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
