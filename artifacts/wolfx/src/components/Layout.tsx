import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Home,
  Bot,
  MessageSquare,
  Cpu,
  Settings,
  Zap,
  Plus,
  LogOut,
  ChevronDown,
  Sun,
  Moon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

const userNavItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/chat", icon: MessageSquare, label: "Conversations" },
];

const adminNavItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/chat", icon: MessageSquare, label: "Conversations" },
  { href: "/agents", icon: Bot, label: "Agents" },
  { href: "/models", icon: Cpu, label: "Models" },
  { href: "/users", icon: Users, label: "Users" },
];

const adminBottomItems = [
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "admin";
  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 border-r border-border bg-muted/30 dark:bg-[hsl(240,10%,5%)] flex flex-col">
        {/* Workspace selector */}
        <div className="px-3 py-3 border-b border-border">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary transition-colors">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-xs font-bold leading-tight truncate">wolfX</div>
              <div className="text-[9px] text-muted-foreground leading-tight uppercase tracking-widest">Intelligence</div>
            </div>
            <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          </button>
        </div>

        {/* New chat button */}
        <div className="px-3 py-2 border-b border-border">
          <Link href="/">
            <Button size="sm" className="w-full justify-start gap-2 h-8 text-xs">
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </Button>
          </Link>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded text-sm cursor-pointer transition-colors",
                  active
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-xs">{label}</span>
                  {active && <div className="w-1 h-1 rounded-full bg-primary" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-2 border-t border-border space-y-0.5">
          {/* Admin-only bottom items */}
          {isAdmin && adminBottomItems.map(({ href, icon: Icon, label }) => {
            const active = location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded text-xs cursor-pointer transition-colors",
                  active
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                </div>
              </Link>
            );
          })}

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>

          {/* User / logout */}
          <div className="pt-1 border-t border-border mt-1">
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {isAdmin ? (
                  <ShieldCheck className="w-3 h-3 text-primary" />
                ) : (
                  <span className="text-[9px] font-bold text-primary uppercase">{user?.username?.[0] ?? "U"}</span>
                )}
              </div>
              <span className="flex-1 text-xs text-muted-foreground truncate">{user?.username}</span>
              <button
                onClick={logout}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
