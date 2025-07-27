import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
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
  User
} from "lucide-react";

// Mock data for demonstration
const mockEndpoints = [
  { id: "1", name: "my-webhook", url: "https://parrot.dev/my-webhook", requests: 42 },
  { id: "2", name: "payment-callback", url: "https://parrot.dev/payment-callback", requests: 15 },
  { id: "3", name: "user-signup", url: "https://parrot.dev/user-signup", requests: 8 }
];

const mockRequests = [
  {
    id: "1",
    method: "POST",
    endpoint: "/my-webhook",
    timestamp: "2024-01-20 10:30:45",
    status: 200,
    ip: "192.168.1.1",
    userAgent: "Mozilla/5.0...",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer token123" },
    body: { user: "john", action: "login" }
  },
  {
    id: "2",
    method: "GET",
    endpoint: "/payment-callback",
    timestamp: "2024-01-20 10:29:12",
    status: 200,
    ip: "10.0.0.1",
    userAgent: "PostmanRuntime/7.29.2",
    headers: { "Accept": "application/json" },
    body: null
  },
  {
    id: "3",
    method: "PUT",
    endpoint: "/user-signup",
    timestamp: "2024-01-20 10:25:33",
    status: 201,
    ip: "172.16.0.1",
    userAgent: "curl/7.68.0",
    headers: { "Content-Type": "application/json" },
    body: { email: "user@example.com", name: "Jane Doe" }
  }
];

export default function Dashboard() {
  const [isStreaming, setIsStreaming] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(mockRequests[0]);
  const [filterMethod, setFilterMethod] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "POST": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "PUT": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "DELETE": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Code2 className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">Parrot</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
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
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {/* Endpoints Section */}
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Your Endpoints</h1>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Endpoint
            </Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-3">
            {mockEndpoints.map((endpoint) => (
              <Card key={endpoint.id} className="transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{endpoint.name}</CardTitle>
                    <Badge variant="secondary">{endpoint.requests} requests</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <code className="text-sm text-muted-foreground">{endpoint.url}</code>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(endpoint.url)}>
                      <Copy className="h-4 w-4" />
                    </Button>
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
                    {mockRequests.map((request) => (
                      <div
                        key={request.id}
                        className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                          selectedRequest.id === request.id ? "bg-muted border-primary" : ""
                        }`}
                        onClick={() => setSelectedRequest(request)}
                      >
                        <div className="flex items-center justify-between">
                          <Badge className={getMethodColor(request.method)}>
                            {request.method}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {request.timestamp.split(" ")[1]}
                          </span>
                        </div>
                        <div className="mt-1">
                          <code className="text-sm">{request.endpoint}</code>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {request.ip}
                        </div>
                      </div>
                    ))}
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
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Replay
                    </Button>
                    <Button variant="outline" size="sm">
                      <Copy className="mr-2 h-4 w-4" />
                      Copy as cURL
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
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
                          <Badge className={getMethodColor(selectedRequest.method)}>
                            {selectedRequest.method}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Status</label>
                        <div className="mt-1">
                          <Badge variant="outline">{selectedRequest.status}</Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Timestamp</label>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {selectedRequest.timestamp}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">IP Address</label>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {selectedRequest.ip}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium">User Agent</label>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {selectedRequest.userAgent}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="headers">
                    <div className="space-y-2">
                      {Object.entries(selectedRequest.headers).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-3 gap-4 py-2 border-b">
                          <code className="text-sm font-medium">{key}</code>
                          <code className="col-span-2 text-sm text-muted-foreground">{value}</code>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="body">
                    <ScrollArea className="h-64 w-full rounded border">
                      <pre className="p-4 text-sm">
                        {selectedRequest.body ? JSON.stringify(selectedRequest.body, null, 2) : "No body"}
                      </pre>
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="response">
                    <div className="text-sm text-muted-foreground">
                      Configure mock responses in the endpoint settings.
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
