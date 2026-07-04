import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import AgentsList from "@/pages/AgentsList";
import AgentForm from "@/pages/AgentForm";
import ChatList from "@/pages/ChatList";
import ChatView from "@/pages/ChatView";
import Models from "@/pages/Models";
import Settings from "@/pages/Settings";
import Users from "@/pages/admin/Users";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center animate-pulse">
            <div className="w-4 h-4 rounded bg-primary/40" />
          </div>
          <p className="text-xs text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const isAdmin = user.role === "admin";

  return (
    <Switch>
      {/* Full-screen chat — no sidebar */}
      <Route path="/chat/:id" component={ChatView} />

      {/* All other pages use sidebar layout */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/chat" component={ChatList} />

            {/* Admin-only routes */}
            {isAdmin && <Route path="/agents" component={AgentsList} />}
            {isAdmin && <Route path="/agents/new" component={AgentForm} />}
            {isAdmin && <Route path="/agents/:id/edit" component={AgentForm} />}
            {isAdmin && <Route path="/models" component={Models} />}
            {isAdmin && <Route path="/settings" component={Settings} />}
            {isAdmin && <Route path="/users" component={Users} />}

            {/* Redirect non-admins trying to access admin paths */}
            {!isAdmin && <Route path="/agents"><Redirect to="/" /></Route>}
            {!isAdmin && <Route path="/models"><Redirect to="/" /></Route>}
            {!isAdmin && <Route path="/settings"><Redirect to="/" /></Route>}
            {!isAdmin && <Route path="/users"><Redirect to="/" /></Route>}

            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
