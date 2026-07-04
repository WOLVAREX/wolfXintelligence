import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Plus, Trash2, Shield, User as UserIcon, Eye, EyeOff,
  RefreshCw, ShieldCheck, Loader2, KeyRound,
} from "lucide-react";

interface UserRecord {
  id: number;
  username: string;
  role: "admin" | "user";
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getToken() {
  return localStorage.getItem("wolfx_token") ?? "";
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // New user form
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [creating, setCreating] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
      const data = await res.json() as UserRecord[];
      if (!Array.isArray(data)) throw new Error("Unexpected response");
      setUsers(data);
      setLoaded(true);
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Load on mount — use a ref to avoid calling twice in StrictMode
  const didFetch = typeof window !== "undefined" && (window as Window & { _usersFetched?: boolean })._usersFetched;
  if (!loaded && !loading && !didFetch) {
    (window as Window & { _usersFetched?: boolean })._usersFetched = true;
    void fetchUsers();
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });
      const data = await res.json() as UserRecord & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create user");
      setUsers((prev) => [...prev, data]);
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      setShowForm(false);
      toast({ title: `User @${data.username} created` });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (user: UserRecord) => {
    if (!confirm(`Delete @${user.username}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Failed to delete");
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast({ title: `@${user.username} deleted` });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleRoleToggle = async (user: UserRecord) => {
    const newR = user.role === "admin" ? "user" : "admin";
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ role: newR }),
      });
      const data = await res.json() as UserRecord & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setUsers((prev) => prev.map((u) => u.id === user.id ? data : u));
      toast({ title: `@${user.username} is now ${newR}` });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || !resetPw.trim()) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/users/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ password: resetPw }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResetTarget(null);
      setResetPw("");
      toast({ title: `Password updated for @${resetTarget.username}` });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">User Accounts</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {users.length} {users.length === 1 ? "user" : "users"} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New User
            </Button>
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleCreate} className="border border-primary/20 rounded-xl bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground">Create new user</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. john"
                  required
                  minLength={3}
                  className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wider">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "user" | "admin")}
                  className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="w-full px-2.5 py-1.5 pr-8 text-xs bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" size="sm" disabled={creating || !newUsername.trim() || !newPassword.trim()}>
                {creating ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Creating…</> : "Create User"}
              </Button>
              <button type="button" onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Users list */}
        {loading && !loaded ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl border border-border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No users found</div>
        ) : (
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
            {users.map((u) => {
              const isMe = u.id === currentUser?.id;
              const isAdmin = u.role === "admin";
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isAdmin ? "bg-primary/10" : "bg-secondary"}`}>
                    {isAdmin
                      ? <ShieldCheck className="w-4 h-4 text-primary" />
                      : <UserIcon className="w-4 h-4 text-muted-foreground" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">@{u.username}</span>
                      {isMe && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">you</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isAdmin ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
                      }`}>
                        {u.role}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">joined {timeAgo(u.createdAt)}</p>
                  </div>

                  {/* Actions */}
                  {!isMe && (
                    <div className="flex items-center gap-1">
                      {/* Reset password */}
                      <button
                        onClick={() => { setResetTarget(u); setResetPw(""); setShowResetPw(false); }}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title="Reset password"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      {/* Toggle role */}
                      <button
                        onClick={() => void handleRoleToggle(u)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title={isAdmin ? "Demote to user" : "Promote to admin"}
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => void handleDelete(u)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm border border-border rounded-xl bg-card shadow-lg p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Reset password</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Set a new password for @{resetTarget.username}</p>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="relative">
                <input
                  type={showResetPw ? "text" : "password"}
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  required
                  minLength={6}
                  autoFocus
                  className="w-full px-3 py-2 pr-9 text-sm bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                />
                <button type="button" onClick={() => setShowResetPw((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showResetPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={resetting || resetPw.length < 6}>
                  {resetting ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Saving…</> : "Save Password"}
                </Button>
                <button type="button" onClick={() => setResetTarget(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
