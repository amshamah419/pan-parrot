import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { replayRequest } from "@/lib/api";
import type { CapturedRequest } from "@shared/api";
import { RotateCcw } from "lucide-react";

export function RequestReplayDialog({
  request,
  open,
  onOpenChange,
}: {
  request: CapturedRequest;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const shown = open ?? internalOpen;
  const setShown = onOpenChange ?? setInternalOpen;
  const [url, setUrl] = useState("https://");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    if (!shown) return;
    setError("");
    setResult("");
  }, [shown, request.id]);

  const send = async () => {
    setPending(true);
    setError("");
    setResult("");
    try {
      const response = await replayRequest(request.id, url.trim());
      const preview = response.body.length > 2000 ? `${response.body.slice(0, 2000)}…` : response.body;
      setResult(
        `HTTP ${response.status}${response.truncated ? " (truncated)" : ""}\n${response.contentType}\n${preview || "(empty body)"}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replay failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={shown} onOpenChange={setShown}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-keyshortcuts="r" aria-label="Replay this captured call">
          <RotateCcw className="mr-2 h-4 w-4" />
          Replay
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replay this call</DialogTitle>
          <DialogDescription>
            Sends {request.method} {request.endpoint} to a public https URL. Localhost, private addresses, and ports other than 443 are rejected. Headers stored as [redacted] are not sent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="replay-url">Target URL</Label>
          <Input
            id="replay-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/hook"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {result && (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded border bg-muted p-3 text-xs" role="status">
            {result}
          </pre>
        )}
        <div className="flex gap-2">
          <Button type="button" onClick={() => void send()} disabled={pending || url.trim().length < 8}>
            {pending ? "Sending…" : "Send replay"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setShown(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
