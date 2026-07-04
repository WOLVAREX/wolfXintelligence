import { useLocation, useSearch } from "wouter";
import { useListAgents, useCreateConversation, getListConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bot, ArrowLeft, ChevronRight, MessageSquare } from "lucide-react";

export default function ChatNew() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedAgentId = params.get("agentId");

  const { data: agents, isLoading } = useListAgents();
  const createConversation = useCreateConversation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startChat = (agentId: number, agentName: string) => {
    createConversation.mutate(
      { data: { agentId, title: `Chat with ${agentName}` } },
      {
        onSuccess: (conv) => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          navigate(`/chat/${conv.id}`);
        },
        onError: () => toast({ title: "Error", description: "Failed to start conversation.", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/chat")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold">New Conversation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Choose an agent to chat with</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : !agents?.length ? (
        <div className="border border-border rounded-lg p-10 text-center space-y-3">
          <Bot className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium">No agents configured</p>
          <p className="text-xs text-muted-foreground">Create an agent first to start chatting.</p>
          <Button size="sm" onClick={() => navigate("/agents/new")}>Create Agent</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => startChat(agent.id, agent.name)}
              disabled={createConversation.isPending}
              className="w-full text-left border border-border rounded-lg p-4 bg-card hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{agent.name}</span>
                    {agent.modelName && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
                        {agent.modelName}
                      </span>
                    )}
                  </div>
                  {agent.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{agent.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground/60 mt-1 font-mono truncate">
                    {agent.systemPrompt.slice(0, 70)}…
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="w-3 h-3" />
                  {agent.conversationCount ?? 0}
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:text-primary transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
