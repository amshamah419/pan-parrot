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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
import { loadPresetCatalog } from "@/lib/preset-catalog";
import { commandCoverageLabel, sumCommandCoverage } from "@shared/mock-spec";
import type { AdminSignals, AdminUser } from "@shared/api";
import {
  MoreHorizontal,
  Shield,
  UserCheck,
  UserX,
  LogOut,
  Users,
  Trash2,
  KeyRound,
} from "lucide-react";

interface HealthWindow {
  requests: number;
  clientErrors: number;
  serverErrors: number;
  errorRate: number;
  latencyMs: number;
}

interface HealthReport {
  ok: boolean;
  functions: { api: string; database: string; email: string; catch: string };
  version: string;
  commit: string;
  devCodeExposed: boolean;
  sessionSecret: string;
  windows: { h24: HealthWindow; d7: HealthWindow };
  signIn: {
    h24: { attempts: number; failures: number; lockouts: number };
    d7: { attempts: number; failures: number; lockouts: number };
  };
  rateLimitHits: { h24: number; d7: number };
  storage: {
    capturedRequests: number;
    capturedBytes: number;
    requestQuota: number;
    perUserRequestQuota: number;
    endpointCount: number;
    endpointQuota: number;
  };
  topMocks: Array<{ id: string; name: string; path: string; owner: string; requests: number }>;
  topUsers: Array<{ email: string; requests: number }>;
  recentErrors: Array<{ id: string; message: string; created: string }>;
  lastCatch: string | null;
}

interface AdminMock {
  id: string;
  name: string;
  path: string;
  owner: string;
  disabled: boolean;
}

interface AdminInvite {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  invitedBy: string;
  expires: string;
}

export default function Admin() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = async (next = query) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/users?q=${encodeURIComponent(next)}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load users");
      setUsers(await response.json());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") void loadUsers("");
  }, [user?.role]);

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

  const postUser = async (userId: string, action: string) => {
    const response = await fetch(`/api/admin/users/${userId}/${action}`, { method: "POST", credentials: "include" });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Request failed");
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user, their mocks, and their captured requests?")) return;
    const response = await fetch(`/api/admin/users/${userId}`, { method: "DELETE", credentials: "include" });
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
            <p className="text-muted-foreground mb-4">You need the admin role to open this page.</p>
            <Button onClick={() => window.history.back()}>Go back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
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
            Admin
          </h1>
          <p className="text-muted-foreground">
            Health, people, mocks, and invites. Counts come from this database. There is no separate monitoring service.
          </p>
        </div>
        <NewMocksCard />
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription role="alert">{error}</AlertDescription>
          </Alert>
        )}
        <Tabs defaultValue="health">
          <TabsList className="mb-4 flex h-auto flex-wrap">
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="mocks">Mocks</TabsTrigger>
            <TabsTrigger value="invites">Invites</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
            <TabsTrigger value="tokens">Tokens</TabsTrigger>
          </TabsList>
          <TabsContent value="health">
            <HealthPanel />
          </TabsContent>
          <TabsContent value="people">
            <Card>
              <CardHeader>
                <CardTitle>Accounts ({users.length})</CardTitle>
                <CardDescription>
                  Suspending someone signs them out and blocks their catch URLs. The founding admin cannot be demoted.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadUsers();
                  }}
                >
                  <Label htmlFor="user-search" className="sr-only">Search people</Label>
                  <Input
                    id="user-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name or email"
                  />
                  <Button type="submit">Search</Button>
                </form>
                {isLoading ? (
                  <p className="p-8 text-center text-muted-foreground">Loading…</p>
                ) : (
                  users.map((person) => (
                    <div key={person.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{person.name}</p>
                          <Badge variant={person.role === "admin" ? "default" : "secondary"}>{person.role}</Badge>
                          {person.permanentAdmin && <Badge variant="outline">Always admin</Badge>}
                          {!person.active && <Badge variant="destructive">Suspended</Badge>}
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
                              void postUser(person.id, "purge").catch((err) => setError(err.message));
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Purge captured data
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void postUser(person.id, "sessions/revoke").catch((err) => setError(err.message))}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Revoke sessions
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void postUser(person.id, "tokens/revoke").catch((err) => setError(err.message))}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            Revoke tokens
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={person.permanentAdmin}
                            onClick={() =>
                              updateUser(person.id, { active: !person.active }).catch((err) => setError(err.message))
                            }
                          >
                            {person.active ? (
                              <>
                                <UserX className="mr-2 h-4 w-4" />
                                Suspend
                              </>
                            ) : (
                              <>
                                <UserCheck className="mr-2 h-4 w-4" />
                                Unsuspend
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={person.permanentAdmin && person.role === "admin"}
                            onClick={() =>
                              updateUser(person.id, { role: person.role === "admin" ? "user" : "admin" }).catch((err) =>
                                setError(err.message),
                              )
                            }
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            {person.role === "admin" ? "Make user" : "Make admin"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            disabled={person.id === user.id || person.permanentAdmin}
                            onClick={() => void deleteUser(person.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="mocks">
            <MocksPanel onError={setError} />
          </TabsContent>
          <TabsContent value="invites">
            <InvitesPanel onError={setError} />
          </TabsContent>
          <TabsContent value="audit">
            <AuditPanel />
          </TabsContent>
          <TabsContent value="tokens">
            <AdminTokens onError={setError} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function NewMocksCard() {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    void fetch("/api/admin/settings", { credentials: "include" })
      .then(async (response) => {
        if (response.ok) setLocked(Boolean((await response.json()).newMocksLocked));
      })
      .catch(() => undefined);
  }, []);
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>New mocks</CardTitle>
        <CardDescription>
          When this is on, a new catch URL is created with a lock token. Callers without the token or the allowlist get a generic 404.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <label htmlFor="new-mocks-locked">New mocks are locked</label>
        <input
          id="new-mocks-locked"
          type="checkbox"
          checked={locked}
          onChange={(event) => {
            const next = event.target.checked;
            void fetch("/api/admin/settings", {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ newMocksLocked: next }),
            }).then(() => setLocked(next));
          }}
        />
      </CardContent>
    </Card>
  );
}

function HealthPanel() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [signals, setSignals] = useState<AdminSignals | null>(null);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    void fetch("/api/admin/health", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load health");
        setHealth(await response.json());
      })
      .catch((err) => setProblem(err instanceof Error ? err.message : "Could not load health"));
    void fetch("/api/admin/signals", { credentials: "include" })
      .then(async (response) => {
        if (response.ok) setSignals(await response.json());
      })
      .catch(() => undefined);
  }, []);
  return (
    <div className="space-y-4">
      <CatalogCoverageCard />
      {problem && <p className="text-destructive">{problem}</p>}
      {health && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatusCard title="API" value={health.functions.api} />
            <StatusCard title="Database" value={health.functions.database} />
            <StatusCard title="Email" value={health.functions.email} />
            <StatusCard title="Catch" value={health.functions.catch} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <WindowCard title="Last 24 hours" window={health.windows.h24} signIn={health.signIn.h24} rate={health.rateLimitHits.h24} />
            <WindowCard title="Last 7 days" window={health.windows.d7} signIn={health.signIn.d7} rate={health.rateLimitHits.d7} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Storage</CardTitle>
              <CardDescription>
                Captured calls against the per-mock cap, and mocks against the per-person cap. Bytes are the stored body plus the response preview.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Captured calls: {health.storage.capturedRequests} / {health.storage.requestQuota}
              </p>
              <p>Stored bytes: {health.storage.capturedBytes}</p>
              <p>
                Mocks: {health.storage.endpointCount} / {health.storage.endpointQuota}
              </p>
              <p>Per-person capture cap: {health.storage.perUserRequestQuota}</p>
              <p>Version {health.version} · commit {health.commit}</p>
              <p>{health.lastCatch ? `Last catch: ${health.lastCatch}` : "No catch traffic stored yet."}</p>
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top mocks</CardTitle>
                <CardDescription>By captured calls in the last 7 days.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {health.topMocks.map((mock) => (
                  <p key={mock.id}>{mock.name} ({mock.owner}): {mock.requests}</p>
                ))}
                {health.topMocks.length === 0 && <p className="text-muted-foreground">No catch traffic in this window.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top people</CardTitle>
                <CardDescription>By captured calls in the last 7 days.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {health.topUsers.map((person) => (
                  <p key={person.email}>{person.email}: {person.requests}</p>
                ))}
                {health.topUsers.length === 0 && <p className="text-muted-foreground">No catch traffic in this window.</p>}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Recent errors</CardTitle>
              <CardDescription>Server exceptions and catch responses of 500 or higher. The newest 20.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {health.recentErrors.map((item) => (
                <p key={item.id}>{item.created} · {item.message}</p>
              ))}
              {health.recentErrors.length === 0 && <p className="text-muted-foreground">No recent errors.</p>}
            </CardContent>
          </Card>
        </>
      )}
      {signals && (
        <Card>
          <CardHeader>
            <CardTitle>Signals</CardTitle>
            <CardDescription>Database, email, and the session secret. The public health URL does not query the database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Database: {signals.database}</p>
            <p>Sign-in email: {signals.email === "configured" ? "configured" : "missing RESEND_API_KEY or EMAIL_FROM"}</p>
            <p>Session secret: {signals.sessionSecret === "ok" ? "set" : "missing or shorter than 32 characters"}</p>
            <p>Sign-in codes in API responses: {signals.devCodeExposed ? "on" : "off"}</p>
            <p>
              {signals.users} accounts ({signals.inactiveUsers} inactive), {signals.endpoints} mocks, {signals.capturedRequests} captured calls.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CatalogCoverageCard() {
  const [line, setLine] = useState("");
  const [scored, setScored] = useState(0);
  useEffect(() => {
    void loadPresetCatalog()
      .then((presets) => {
        const summary = sumCommandCoverage(presets);
        setScored(summary.scored);
        setLine(summary.total > 0 ? commandCoverageLabel(summary) : "");
      })
      .catch(() => setLine(""));
  }, []);
  if (!line) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Catalog coverage</CardTitle>
        <CardDescription>
          {scored} integrations have command coverage. Presets without command coverage are not in this total.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Total coverage: {line}.</p>
      </CardContent>
    </Card>
  );
}

function StatusCard({ title, value }: { title: string; value: string }) {
  const bad = value === "down" || value === "missing";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={bad ? "text-destructive" : undefined}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function WindowCard({
  title,
  window,
  signIn,
  rate,
}: {
  title: string;
  window: HealthWindow;
  signIn: { attempts: number; failures: number; lockouts: number };
  rate: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p>Catch requests: {window.requests}</p>
        <p>4xx: {window.clientErrors} · 5xx: {window.serverErrors}</p>
        <p>Error rate: {Math.round(window.errorRate * 1000) / 10}%</p>
        <p>Average latency: {window.latencyMs} ms</p>
        <p>Rate-limit hits: {rate}</p>
        <p>Sign-in attempts: {signIn.attempts}</p>
        <p>Sign-in failures: {signIn.failures}</p>
        <p>Lockouts: {signIn.lockouts}</p>
      </CardContent>
    </Card>
  );
}

function MocksPanel({ onError }: { onError: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [mocks, setMocks] = useState<AdminMock[]>([]);
  const load = async (next = query) => {
    const response = await fetch(`/api/admin/mocks?q=${encodeURIComponent(next)}`, { credentials: "include" });
    if (!response.ok) throw new Error("Could not load mocks");
    setMocks(await response.json());
  };
  useEffect(() => {
    void load("").catch((err) => onError(err.message));
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mocks</CardTitle>
        <CardDescription>Disabling a mock blocks its catch URL. Purging deletes captured calls and leaves the mock.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void load().catch((err) => onError(err.message)); }}>
          <Label htmlFor="mock-search" className="sr-only">Search mocks</Label>
          <Input id="mock-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, path, or owner" />
          <Button type="submit">Search</Button>
        </form>
        {mocks.map((mock) => (
          <div key={mock.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{mock.name} {mock.disabled && <Badge variant="destructive">Disabled</Badge>}</p>
              <p className="text-sm text-muted-foreground">/catch/{mock.path} · {mock.owner}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void fetch(`/api/admin/mocks/${mock.id}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ disabled: !mock.disabled }),
                  }).then(() => load()).catch((err) => onError(err.message))
                }
              >
                {mock.disabled ? "Enable" : "Disable"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!confirm(`Purge captured calls for ${mock.name}?`)) return;
                  void fetch(`/api/admin/mocks/${mock.id}/purge`, { method: "POST", credentials: "include" })
                    .then(() => load())
                    .catch((err) => onError(err.message));
                }}
              >
                Purge requests
              </Button>
            </div>
          </div>
        ))}
        {mocks.length === 0 && <p className="text-sm text-muted-foreground">No mocks match.</p>}
      </CardContent>
    </Card>
  );
}

function InvitesPanel({ onError }: { onError: (message: string) => void }) {
  const [inviteOnly, setInviteOnly] = useState(false);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const load = async () => {
    const response = await fetch("/api/admin/invites", { credentials: "include" });
    if (!response.ok) throw new Error("Could not load invites");
    const body = (await response.json()) as { inviteOnly: boolean; invites: AdminInvite[] };
    setInviteOnly(body.inviteOnly);
    setInvites(body.invites);
  };
  useEffect(() => {
    void load().catch((err) => onError(err.message));
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invites</CardTitle>
        <CardDescription>
          Only @paloaltonetworks.com addresses. An invite lasts 7 days. Invite-only sign-up is off unless you turn it on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <Label htmlFor="invite-only">Require an invite for new sign-ups</Label>
          <Switch
            id="invite-only"
            checked={inviteOnly}
            onCheckedChange={(checked) => {
              void fetch("/api/admin/invites/settings", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteOnly: checked }),
              })
                .then(async (response) => {
                  if (!response.ok) throw new Error("Could not save the setting");
                  setInviteOnly(checked);
                })
                .catch((err) => onError(err.message));
            }}
          />
        </div>
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const raw = String(new FormData(form).get("emails") || "");
            const list = raw.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
            void fetch("/api/admin/invites", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ emails: list }),
            })
              .then(async (response) => {
                const data = (await response.json()) as { error?: string };
                if (!response.ok) throw new Error(data.error || "Could not send invites");
                form.reset();
                await load();
              })
              .catch((err) => onError(err.message));
          }}
        >
          <Label htmlFor="invite-emails">Email addresses</Label>
          <Input
            id="invite-emails"
            name="emails"
            placeholder="one or more @paloaltonetworks.com addresses"
          />
          <Button type="submit">Send invites</Button>
        </form>
        {invites.map((invite) => (
          <div key={invite.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-all font-medium">{invite.email}</p>
              <p className="break-all text-sm text-muted-foreground">{invite.status} · expires {invite.expires}</p>
            </div>
            {invite.status !== "accepted" && invite.status !== "revoked" && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void fetch(`/api/admin/invites/${invite.id}/resend`, { method: "POST", credentials: "include" }).then(() => load()).catch((err) => onError(err.message))}>
                  Resend
                </Button>
                <Button size="sm" variant="outline" onClick={() => void fetch(`/api/admin/invites/${invite.id}/revoke`, { method: "POST", credentials: "include" }).then(() => load()).catch((err) => onError(err.message))}>
                  Revoke
                </Button>
              </div>
            )}
          </div>
        ))}
        {invites.length === 0 && <p className="text-sm text-muted-foreground">No invites yet.</p>}
      </CardContent>
    </Card>
  );
}

function AuditPanel() {
  const [audit, setAudit] = useState<Array<{ id: string; actorEmail: string; action: string; detail: string }>>([]);
  useEffect(() => {
    void fetch("/api/admin/audit", { credentials: "include" })
      .then((response) => response.json())
      .then(setAudit)
      .catch(() => setAudit([]));
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit</CardTitle>
        <CardDescription>Admin actions, shares, saves, and purges. The newest 50.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {audit.map((event) => (
          <p key={event.id}>{event.action} · {event.actorEmail} · {event.detail}</p>
        ))}
        {audit.length === 0 && <p className="text-muted-foreground">No changes recorded yet.</p>}
      </CardContent>
    </Card>
  );
}

function AdminTokens({ onError }: { onError: (message: string) => void }) {
  const [rows, setRows] = useState<Array<{ id: string; name: string; prefix: string; email?: string; scopes: string[]; expires: string; revoked: string | null }>>([]);
  const load = () => {
    void fetch("/api/admin/tokens", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load tokens");
        setRows(await response.json());
      })
      .catch((error) => onError(error instanceof Error ? error.message : "Could not load tokens"));
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal API tokens</CardTitle>
        <CardDescription>Every token on this site. Revoking one signs that credential out. The secret is not stored.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {row.email} · {row.name} <code className="text-xs">{row.prefix}…</code>
              <span className="ml-2 text-xs text-muted-foreground">{row.scopes.join(" ")}{row.revoked ? " · revoked" : ""}</span>
            </span>
            {!row.revoked && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void fetch(`/api/admin/tokens/${row.id}`, { method: "DELETE", credentials: "include" })
                    .then((response) => {
                      if (!response.ok) throw new Error("Could not revoke the token");
                      load();
                    })
                    .catch((error) => onError(error instanceof Error ? error.message : "Could not revoke the token"));
                }}
              >
                Revoke
              </Button>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground">No tokens yet.</p>}
      </CardContent>
    </Card>
  );
}
