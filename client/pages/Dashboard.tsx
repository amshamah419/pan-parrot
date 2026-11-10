import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { CreateEndpointDialog } from "@/components/CreateEndpointDialog";
import { RequestReplayDialog } from "@/components/RequestReplayDialog";
import { RequestDiffDialog } from "@/components/RequestDiffDialog";
import { InspectorHelp } from "@/components/InspectorHelp";
import { MockResponseDialog } from "@/components/MockResponseDialog";
import { IntegrationPicker } from "@/components/IntegrationPicker";
import { ApiTokens } from "@/components/ApiTokens";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserEndpoints,
  getCapturedRequests,
  deleteEndpoint,
  getCatalog,
  cloneEndpoint,
} from "@/lib/api";
import { UserEndpoint, CapturedRequest } from "@shared/api";
import {
  emptyInspectorFilters,
  matchesInspector,
  toCurl,
  toPythonRequests,
  type InspectorFilters,
} from "@shared/inspector";
import {
  Play,
  Pause,
  Search,
  Copy,
  Trash2,
  Monitor,
  LogOut,
  User,
} from "lucide-react";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [isStreaming, setIsStreaming] = useState(true);
  const [selectedRequest, setSelectedRequest] =
    useState<CapturedRequest | null>(null);
  const [filters, setFilters] = useState<InspectorFilters>(emptyInspectorFilters);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [diffOpen, setDiffOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [userEndpoints, setUserEndpoints] = useState<UserEndpoint[]>([]);
  const [capturedRequests, setCapturedRequests] = useState<CapturedRequest[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [catalog, setCatalog] = useState<Array<{ id: string; name: string; description?: string | null; ownerEmail: string }>>([]);
  const [copyNote, setCopyNote] = useState("");

  // Load data from API
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [endpoints, requests] = await Promise.all([
        getUserEndpoints(),
        getCapturedRequests(),
      ]);

      setUserEndpoints(endpoints);
      getCatalog().then(setCatalog).catch(() => setCatalog([]));
      setCapturedRequests(requests);

      // Set first request as selected if none selected
      if (!selectedRequest && requests.length > 0) {
        setSelectedRequest(requests[0]);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on mount and set up refresh interval
  useEffect(() => {
    loadData();

    // Auto-refresh requests if streaming is enabled
    const interval = isStreaming
      ? setInterval(async () => {
          try {
            const requests = await getCapturedRequests();
            setCapturedRequests(requests);
          } catch (error) {
            console.error("Failed to refresh requests:", error);
          }
        }, 2000)
      : null;

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) return;
      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        document.getElementById("request-search")?.focus();
        return;
      }
      if (typing || document.querySelector("[role='dialog']")) return;
      if (!selectedRequest) return;
      if (event.key === "c") {
        event.preventDefault();
        copyCurl(selectedRequest);
      } else if (event.key === "p") {
        event.preventDefault();
        copyPython(selectedRequest);
      } else if (event.key === "r") {
        event.preventDefault();
        setReplayOpen(true);
      } else if (event.key === "d") {
        event.preventDefault();
        toggleCompare(selectedRequest.id, true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "POST":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "PUT":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "DELETE":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const formatCapturedBody = (body: unknown) => {
    if (body == null) return "No body";
    if (typeof body === "string") return body;
    return JSON.stringify(body, null, 2);
  };

  const copyToClipboard = (text: string, note: string) => {
    navigator.clipboard.writeText(text).then(
      () => setCopyNote(note),
      () => setCopyNote("Select the URL and copy it."),
    );
  };

  const copyCurl = (request: CapturedRequest) => {
    copyToClipboard(toCurl(request, window.location.origin), "Copied as cURL.");
  };

  const copyPython = (request: CapturedRequest) => {
    copyToClipboard(toPythonRequests(request, window.location.origin), "Copied as Python requests.");
  };

  const toggleCompare = (id: string, openDiff: boolean) => {
    setCompareIds((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id].slice(-2);
      if (openDiff && next.length === 2) setDiffOpen(true);
      return next;
    });
  };

  const handleEndpointCreated = (endpoint: UserEndpoint) => {
    setUserEndpoints((prev) => [...prev, endpoint]);
  };

  const handleDeleteEndpoint = async (endpointId: string) => {
    try {
      await deleteEndpoint(endpointId);
      setUserEndpoints((prev) => prev.filter((e) => e.id !== endpointId));
      // Refresh data to update request counts
      loadData();
    } catch (error) {
      console.error("Failed to delete endpoint:", error);
    }
  };

  const filteredRequests = capturedRequests.filter((request) => matchesInspector(request, filters));
  const compared = compareIds
    .map((id) => capturedRequests.find((request) => request.id === id))
    .filter((request): request is CapturedRequest => Boolean(request));
  const setFilter = (key: keyof InspectorFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
          <Logo />
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Docs
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                  aria-label={user?.email ? `Account menu for ${user.email}` : "Account menu"}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{user?.name}</p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                {user?.role === "admin" && (
                  <DropdownMenuItem
                    onClick={() => (window.location.href = "/admin")}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => void logout()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6">
        {copyNote && <p className="mb-3 text-sm text-emerald-700 dark:text-emerald-300" role="status">{copyNote}</p>}
        {/* Endpoints Section */}
        <div className="mb-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <h1 className="text-2xl font-bold">Mocks</h1>
              <p className="text-muted-foreground">
                Point an XSOAR integration at a catch URL. Verified mocks follow the vendor's public API. The log below shows what the integration actually sent.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <IntegrationPicker onCreated={handleEndpointCreated} />
              <CreateEndpointDialog onEndpointCreated={handleEndpointCreated} />
            </div>
          </div>
          <ApiTokens />

          {userEndpoints.length === 0 && !isLoading && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Make a catch URL in under a minute</CardTitle>
                <CardDescription>
                  Mock an integration, copy the catch URL, and paste it into the XSOAR server field. The first call shows up in the log below.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Choose Mock an integration and start with Akamai WAF SIEM, or paste one JSON sample.</li>
                  <li>Copy the catch URL from the next screen.</li>
                  <li>Paste it into the integration. Do not send real secrets or customer data.</li>
                </ol>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {userEndpoints.map((endpoint) => (
              <Card
                key={endpoint.id}
                className="transition-all hover:shadow-md"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{endpoint.name}</CardTitle>
                    <Badge variant="secondary">
                      {endpoint.requests} requests
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <code className="break-all text-xs text-muted-foreground">
                        {endpoint.url}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Copy catch URL for ${endpoint.name}`}
                        onClick={() => copyToClipboard(endpoint.url, `Copied the catch URL for ${endpoint.name}.`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" asChild>
                        <Link to={`/mock/${endpoint.id}`}>Open</Link>
                      </Button>
                      {endpoint.access !== "view" && endpoint.access !== "edit" && (
                        <MockResponseDialog endpoint={endpoint} />
                      )}
                      {endpoint.access && endpoint.access !== "owner" && (
                        <Badge variant="outline">{endpoint.access === "edit" ? "Can edit" : "View"}</Badge>
                      )}
                      {endpoint.access === "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${endpoint.name}`}
                          onClick={() => {
                            if (window.confirm(`Delete ${endpoint.name}? The catch URL stops working.`)) {
                              void handleDeleteEndpoint(endpoint.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {catalog.some((item) => item.ownerEmail !== user?.email) && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold">Shared catalog</h2>
              <p className="mb-3 text-sm text-muted-foreground">Mocks other people published. Clone makes your own copy.</p>
              <ul className="space-y-2">
                {catalog.filter((item) => item.ownerEmail !== user?.email).map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2">
                    <span>
                      <span className="font-medium">{item.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{item.ownerEmail}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void cloneEndpoint(item.id).then((created) => {
                          window.location.href = `/mock/${created.id}`;
                        });
                      }}
                    >
                      Clone
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Request Console */}
        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          {/* Request List */}
          <div className="min-w-0 lg:col-span-1">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center">
                    <Monitor className="mr-2 h-5 w-5" />
                    Requests
                  </CardTitle>
                  <Button
                    variant={isStreaming ? "default" : "outline"}
                    size="sm"
                    aria-pressed={isStreaming}
                    aria-label={isStreaming ? "Pause the live log" : "Resume the live log"}
                    onClick={() => setIsStreaming(!isStreaming)}
                  >
                    {isStreaming ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        Live
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Paused
                      </>
                    )}
                  </Button>
                </div>
                <CardDescription>
                  Calls that hit your catch URLs, including chaos status codes.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {/* Filters */}
                <div className="space-y-3 border-b p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="request-search"
                      placeholder="Search method, status, path, headers, or body"
                      aria-label="Search captured requests"
                      value={filters.search}
                      onChange={(e) => setFilter("search", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select value={filters.method} onValueChange={(value) => setFilter("method", value)}>
                      <SelectTrigger aria-label="Filter by method">
                        <SelectValue placeholder="Filter by method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All methods</SelectItem>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                        <SelectItem value="HEAD">HEAD</SelectItem>
                        <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      aria-label="Filter by status"
                      placeholder="Status"
                      value={filters.status}
                      onChange={(e) => setFilter("status", e.target.value)}
                    />
                    <Input
                      aria-label="Filter by path"
                      placeholder="Path"
                      value={filters.path}
                      onChange={(e) => setFilter("path", e.target.value)}
                    />
                    <Input
                      aria-label="Filter by header"
                      placeholder="Header"
                      value={filters.header}
                      onChange={(e) => setFilter("header", e.target.value)}
                    />
                  </div>
                  <Input
                    aria-label="Filter by body text"
                    placeholder="Body text"
                    value={filters.body}
                    onChange={(e) => setFilter("body", e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={compared.length !== 2}
                      onClick={() => setDiffOpen(true)}
                    >
                      Compare two calls
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setHelpOpen(true)}>
                      Shortcuts
                    </Button>
                  </div>
                </div>

                {/* Request List */}
                <ScrollArea className="h-96">
                  <div className="space-y-1 p-2">
                    {isLoading ? (
                      <div className="p-4 text-center text-muted-foreground">
                        Loading requests...
                      </div>
                    ) : filteredRequests.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        {capturedRequests.length === 0
                          ? "No calls yet. Copy a catch URL and paste it into the integration. Do not send real secrets."
                          : "No requests match your filters."}
                      </div>
                    ) : (
                      filteredRequests.map((request) => (
                        <div
                          key={request.id}
                          className={`flex gap-2 rounded-lg border p-3 ${
                            selectedRequest?.id === request.id ? "border-primary bg-muted" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4"
                            checked={compareIds.includes(request.id)}
                            aria-label={`Compare ${request.method} ${request.endpoint}`}
                            onChange={() => toggleCompare(request.id, false)}
                          />
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            aria-pressed={selectedRequest?.id === request.id}
                            onClick={() => setSelectedRequest(request)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Badge className={getMethodColor(request.method)}>
                                {request.method}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(request.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="mt-1 min-w-0">
                              <code className="break-all text-sm">{request.endpoint}</code>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {request.status}
                              {request.recordCount != null ? ` · ${request.recordCount} records` : ""}
                              {request.chaosEffects?.length
                                ? ` · ${request.chaosEffects.join(", ")}`
                                : ""}
                            </div>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Request Details */}
          <div className="min-w-0 lg:col-span-2">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Request Details</CardTitle>
                  {selectedRequest && (
                    <div className="flex flex-wrap gap-2">
                      <RequestReplayDialog
                        request={selectedRequest}
                        open={replayOpen}
                        onOpenChange={setReplayOpen}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        aria-keyshortcuts="c"
                        aria-label="Copy this call as cURL"
                        onClick={() => copyCurl(selectedRequest)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy as cURL
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-keyshortcuts="p"
                        aria-label="Copy this call as Python requests"
                        onClick={() => copyPython(selectedRequest)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy as Python
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedRequest ? (
                  <Tabs defaultValue="overview">
                    <TabsList className="flex h-auto flex-wrap">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="headers">Headers</TabsTrigger>
                      <TabsTrigger value="body">Body</TabsTrigger>
                      <TabsTrigger value="response">Response</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium">Method</label>
                          <div className="mt-1">
                            <Badge
                              className={getMethodColor(
                                selectedRequest?.method || "GET",
                              )}
                            >
                              {selectedRequest?.method}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Status</label>
                          <div className="mt-1">
                            <Badge variant="outline">
                              {selectedRequest?.status}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">
                            Timestamp
                          </label>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {selectedRequest?.timestamp}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">
                            IP Address
                          </label>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {selectedRequest?.ip}
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium">
                            User Agent
                          </label>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {selectedRequest?.userAgent}
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="headers">
                      <div className="space-y-2">
                        {Object.entries(selectedRequest?.headers || {}).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className="grid grid-cols-3 gap-4 py-2 border-b"
                            >
                              <code className="text-sm font-medium">{key}</code>
                              <code className="col-span-2 text-sm text-muted-foreground break-all">
                                {typeof value === "string"
                                  ? value
                                  : JSON.stringify(value)}
                              </code>
                            </div>
                          ),
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="body">
                      <ScrollArea className="h-64 w-full rounded border">
                        <pre className="p-4 text-sm whitespace-pre-wrap break-all">
                          {formatCapturedBody(selectedRequest?.body)}
                        </pre>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="response">
                      <div className="space-y-2 text-sm">
                        <p>
                          Status {selectedRequest?.status}
                          {selectedRequest?.recordCount != null
                            ? ` · ${selectedRequest.recordCount} records`
                            : ""}
                        </p>
                        {(selectedRequest?.chaosEffects || []).length > 0 && (
                          <p>
                            Chaos: {(selectedRequest?.chaosEffects || []).join(", ")}
                          </p>
                        )}
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded border p-3 text-xs">
                          {selectedRequest?.responsePreview || "No response preview"}
                        </pre>
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <Monitor className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Select a request to view details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <InspectorHelp open={helpOpen} onOpenChange={setHelpOpen} />
      <RequestDiffDialog
        left={compared[0] ?? null}
        right={compared[1] ?? null}
        open={diffOpen && compared.length === 2}
        onOpenChange={setDiffOpen}
      />
    </div>
  );
}
