import { useState, useEffect } from "react";
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
import { MockResponseDialog } from "@/components/MockResponseDialog";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserEndpoints,
  getCapturedRequests,
  deleteEndpoint,
} from "@/lib/api";
import { UserEndpoint, CapturedRequest } from "@shared/api";
import {
  Plus,
  Globe,
  Play,
  Pause,
  Filter,
  Search,
  Copy,
  RotateCcw,
  Settings,
  Trash2,
  Clock,
  Monitor,
  LogOut,
  User,
} from "lucide-react";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [isStreaming, setIsStreaming] = useState(true);
  const [selectedRequest, setSelectedRequest] =
    useState<CapturedRequest | null>(null);
  const [filterMethod, setFilterMethod] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [userEndpoints, setUserEndpoints] = useState<UserEndpoint[]>([]);
  const [capturedRequests, setCapturedRequests] = useState<CapturedRequest[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load data from API
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [endpoints, requests] = await Promise.all([
        getUserEndpoints(),
        getCapturedRequests(),
      ]);

      setUserEndpoints(endpoints);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

  // Filter requests based on search and method
  const filteredRequests = capturedRequests.filter((request) => {
    const matchesMethod =
      filterMethod === "all" || request.method === filterMethod;
    const matchesSearch =
      searchQuery === "" ||
      request.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(request.body)
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      Object.values(request.headers).some((value) =>
        String(value).toLowerCase().includes(searchQuery.toLowerCase()),
      );
    return matchesMethod && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center space-x-4">
            <Button
              variant={isStreaming ? "default" : "outline"}
              size="sm"
              onClick={() => setIsStreaming(!isStreaming)}
            >
              {isStreaming ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause Stream
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Resume Stream
                </>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
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
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {/* Endpoints Section */}
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Hey {user?.name}! 👋</h1>
              <p className="text-muted-foreground">
                Your HTTP debugging endpoints
              </p>
            </div>
            <CreateEndpointDialog onEndpointCreated={handleEndpointCreated} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
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
                    <div className="flex items-center justify-between">
                      <code className="text-sm text-muted-foreground">
                        {endpoint.url}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(endpoint.url)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex space-x-2">
                      <MockResponseDialog endpointName={endpoint.name} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEndpoint(endpoint.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Request Console */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Request List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Monitor className="mr-2 h-5 w-5" />
                    Request Console
                  </CardTitle>
                  <Badge variant={isStreaming ? "default" : "secondary"}>
                    {isStreaming ? "Live" : "Paused"}
                  </Badge>
                </div>
                <CardDescription>
                  Real-time HTTP request monitoring
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {/* Filters */}
                <div className="space-y-4 p-4 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search requests..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterMethod} onValueChange={setFilterMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
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
                          ? "No requests captured yet. Try sending a request to one of your endpoints!"
                          : "No requests match your filters."}
                      </div>
                    ) : (
                      filteredRequests.map((request) => (
                        <div
                          key={request.id}
                          className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                            selectedRequest?.id === request.id
                              ? "bg-muted border-primary"
                              : ""
                          }`}
                          onClick={() => setSelectedRequest(request)}
                        >
                          <div className="flex items-center justify-between">
                            <Badge className={getMethodColor(request.method)}>
                              {request.method}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(request.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="mt-1">
                            <code className="text-sm">{request.endpoint}</code>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {request.ip}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Request Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Request Details</CardTitle>
                  {selectedRequest && (
                    <div className="flex space-x-2">
                      <RequestReplayDialog request={selectedRequest} />
                      <Button variant="outline" size="sm">
                        <Copy className="mr-2 h-4 w-4" />
                        Copy as cURL
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedRequest ? (
                  <Tabs defaultValue="overview">
                  <TabsList className="grid w-full grid-cols-4">
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
                            className={getMethodColor(selectedRequest?.method || 'GET')}
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
                        <label className="text-sm font-medium">Timestamp</label>
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
                      {Object.entries(selectedRequest.headers).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="grid grid-cols-3 gap-4 py-2 border-b"
                          >
                            <code className="text-sm font-medium">{key}</code>
                            <code className="col-span-2 text-sm text-muted-foreground">
                              {value}
                            </code>
                          </div>
                        ),
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="body">
                    <ScrollArea className="h-64 w-full rounded border">
                      <pre className="p-4 text-sm">
                        {selectedRequest.body
                          ? JSON.stringify(selectedRequest.body, null, 2)
                          : "No body"}
                      </pre>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="response">
                    <div className="text-sm text-muted-foreground">
                      Configure mock responses in the endpoint settings.
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
    </div>
  );
}
