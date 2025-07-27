import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotateCcw, Play, Copy } from "lucide-react";

interface RequestReplayDialogProps {
  request: any;
}

export function RequestReplayDialog({ request }: RequestReplayDialogProps) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState(request.method);
  const [url, setUrl] = useState(`https://parrot.pan.dev${request.endpoint}`);
  const [headers, setHeaders] = useState(JSON.stringify(request.headers, null, 2));
  const [body, setBody] = useState(request.body ? JSON.stringify(request.body, null, 2) : "");
  const [isReplaying, setIsReplaying] = useState(false);

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "POST": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "PUT": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "DELETE": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const handleReplay = async () => {
    setIsReplaying(true);
    
    // Simulate replay request
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      // In real implementation, this would make an actual HTTP request
      console.log("Replaying request:", { method, url, headers, body });
    } catch (error) {
      console.error("Replay failed:", error);
    } finally {
      setIsReplaying(false);
      setOpen(false);
    }
  };

  const generateCurl = () => {
    let curl = `curl -X ${method} "${url}"`;
    
    try {
      const headersObj = JSON.parse(headers);
      Object.entries(headersObj).forEach(([key, value]) => {
        curl += ` \\\n  -H "${key}: ${value}"`;
      });
    } catch (e) {
      // Ignore malformed headers
    }

    if (body && ["POST", "PUT", "PATCH"].includes(method)) {
      curl += ` \\\n  -d '${body}'`;
    }

    return curl;
  };

  const copyCurl = () => {
    navigator.clipboard.writeText(generateCurl());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw className="mr-2 h-4 w-4" />
          Replay
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Replay Request
          </DialogTitle>
          <DialogDescription>
            Modify and replay this HTTP request
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="request" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="curl">cURL</TabsTrigger>
          </TabsList>
          
          <TabsContent value="request" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Badge className={getMethodColor(method)}>
                  {method}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Headers (JSON)</Label>
              <Textarea
                value={headers}
                onChange={(e) => setHeaders(e.target.value)}
                rows={4}
                className="font-mono text-sm"
              />
            </div>

            {["POST", "PUT", "PATCH"].includes(method) && (
              <div className="space-y-2">
                <Label>Body (JSON)</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              <Button onClick={handleReplay} disabled={isReplaying}>
                {isReplaying ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-white" />
                    Replaying...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Send Request
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="curl" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Generated cURL Command</Label>
                <Button variant="outline" size="sm" onClick={copyCurl}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                {generateCurl()}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
