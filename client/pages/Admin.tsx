import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
import type { AdminUser } from "@shared/api";
import {
  MoreHorizontal,
  Shield,
  UserCheck,
  UserX,
  LogOut,
  Users,
  Trash2,
} from "lucide-react";

export default function Admin() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "admin") void loadUsers();
  }, [user?.role]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/users", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load users");
      setUsers(await response.json());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (userId: string, updates: Partial<AdminUser>) => {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Failed to update user");
    }
    await loadUsers();
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user and their captured requests?")) return;
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Failed to delete user");
      return;
    }
    await loadUsers();
  };

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5 text-destructive" />
              Access denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You need the admin role to open this page.
            </p>
            <Button onClick={() => window.history.back()}>Go back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
              Back to dashboard
            </Button>
            <Button variant="ghost" onClick={() => void logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <Users className="mr-2 h-6 w-6" />
            People
          </h1>
          <p className="text-muted-foreground">
            Anyone with a verified @paloaltonetworks.com address can sign in.
            You can deactivate them or change their role. There is no password
            to reset.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AdminUsage />
        <Card>
          <CardHeader>
            <CardTitle>Accounts ({users.length})</CardTitle>
            <CardDescription>
              Deactivating someone signs them out immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="p-8 text-center text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-4">
                {users.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">{person.name}</p>
                        <Badge variant={person.role === "admin" ? "default" : "secondary"}>
                          {person.role}
                        </Badge>
                        {!person.active && <Badge variant="destructive">Inactive</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{person.email}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label={`Actions for ${person.email}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            if (!confirm(`Delete captured requests and saved runtime for ${person.email}? Their mocks stay.`)) return;
                            void fetch(`/api/admin/users/${person.id}/purge`, { method: "POST", credentials: "include" })
                              .then((response) => {
                                if (!response.ok) throw new Error("Could not purge");
                              })
                              .catch((err) => setError(err.message));
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Purge captured data
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            updateUser(person.id, { active: !person.active }).catch((err) =>
                              setError(err.message),
                            )
                          }
                        >
                          {person.active ? (
                            <>
                              <UserX className="mr-2 h-4 w-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            updateUser(person.id, {
                              role: person.role === "admin" ? "user" : "admin",
                            }).catch((err) => setError(err.message))
                          }
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          {person.role === "admin" ? "Make user" : "Make admin"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={person.id === user.id}
                          onClick={() => void deleteUser(person.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminUsage() {
  const [rows, setRows] = useState<Array<{ email: string; endpoints: number; requests: number; active: boolean }>>([]);
  const [audit, setAudit] = useState<Array<{ id: string; actorEmail: string; action: string; detail: string }>>([]);
  useEffect(() => {
    void fetch("/api/admin/usage", { credentials: "include" }).then((response) => response.json()).then(setRows).catch(() => setRows([]));
    void fetch("/api/admin/audit", { credentials: "include" }).then((response) => response.json()).then(setAudit).catch(() => setAudit([]));
  }, []);
  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>Mocks and captured calls per account. No external analytics.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rows.map((row) => (
            <p key={row.email}>{row.email}: {row.endpoints} mocks, {row.requests} captured calls{row.active ? "" : " (inactive)"}</p>
          ))}
          {rows.length === 0 && <p className="text-muted-foreground">No accounts yet.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Audit</CardTitle>
          <CardDescription>Shares, saves, clones, reverts, and purges. The newest 50.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {audit.map((event) => (
            <p key={event.id}>{event.action} · {event.actorEmail} · {event.detail}</p>
          ))}
          {audit.length === 0 && <p className="text-muted-foreground">No changes recorded yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
