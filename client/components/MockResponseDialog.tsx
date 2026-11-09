import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Save } from "lucide-react";
import { configureMockResponse } from "@/lib/api";
import type { UserEndpoint } from "@shared/api";

export function MockResponseDialog({ endpoint }: { endpoint: UserEndpoint }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [statusCode, setStatusCode] = useState(
    endpoint.mockResponse?.statusCode ?? 200,
  );
  const [headers, setHeaders] = useState(
    JSON.stringify(
      endpoint.mockResponse?.headers ?? { "content-type": "application/json" },
      null,
      2,
    ),
  );
  const [body, setBody] = useState(
    endpoint.mockResponse?.body ?? '{"ok":true}',
  );
  const [delay, setDelay] = useState(endpoint.mockResponse?.delay ?? 0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(true);
    setStatusCode(endpoint.mockResponse?.statusCode ?? 200);
    setHeaders(
      JSON.stringify(
        endpoint.mockResponse?.headers ?? { "content-type": "application/json" },
        null,
        2,
      ),
    );
    setBody(endpoint.mockResponse?.body ?? '{"ok":true}');
    setDelay(endpoint.mockResponse?.delay ?? 0);
  }, [endpoint]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const parsed = JSON.parse(headers) as Record<string, string>;
      await configureMockResponse(endpoint.id, {
        enabled,
        statusCode,
        headers: parsed,
        body,
        delay,
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the mock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          {endpoint.mockResponse ? "Edit mock" : "Configure mock"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mock response for {endpoint.name}</DialogTitle>
          <DialogDescription>
            One response for every request to this endpoint. Delay is capped
            at 5 seconds. Cookie and security headers are ignored.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="mock-enabled">Enabled</Label>
            <Switch
              id="mock-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status code</Label>
              <Input
                id="status"
                type="number"
                value={statusCode}
                onChange={(event) => setStatusCode(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delay">Delay (ms)</Label>
              <Input
                id="delay"
                type="number"
                value={delay}
                onChange={(event) => setDelay(Number(event.target.value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="headers">Headers (JSON)</Label>
            <Textarea
              id="headers"
              value={headers}
              onChange={(event) => setHeaders(event.target.value)}
              rows={3}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              className="font-mono text-sm"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={save} disabled={saving} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            Save mock
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
