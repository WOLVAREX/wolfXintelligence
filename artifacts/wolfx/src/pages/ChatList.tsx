import { useState } from "react";
import { Link } from "wouter";
import { useListConversations, useDeleteConversation, getListConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, MessageSquare, Bot, Trash2, Search, ChevronRight } from "lucide-react";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ChatList() {
  const { data: conversations, isLoading } = useListConversations();
  const deleteConversation = useDeleteConversation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const filtered = conversations?.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.agentName.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`Delete conversation "${title}"?`)) return;
    deleteConversation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          toast({ title: "Conversation deleted" });
        },
        onError: () => toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Conversations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{conversations?.length ?? 0} total</p>
        </div>
        <Link href="/chat/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : !filtered?.length ? (
        <div className="border border-border rounded-lg p-10 text-center space-y-3">
          <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium">
            {search ? "No matching conversations" : "No conversations yet"}
          </p>
          {!search && (
            <>
              <p className="text-xs text-muted-foreground">Start chatting with an AI agent.</p>
              <Link href="/chat/new">
                <Button size="sm" className="gap-1.5 mt-1">
                  <Plus className="w-3.5 h-3.5" />
                  New Chat
                </Button>
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((conv) => (
            <Link key={conv.id} href={`/chat/${conv.id}`}>
              <div className="flex items-center gap-3 p-3.5 rounded-lg border border-border bg-card hover:border-primary/30 cursor-pointer transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium truncate">{conv.title}</p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(conv.updatedAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    <span className="text-primary/70">{conv.agentName}</span>
                    {conv.lastMessage && <> · {conv.lastMessage}</>}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-muted-foreground mr-1">{conv.messageCount}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.preventDefault(); handleDelete(conv.id, conv.title); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
