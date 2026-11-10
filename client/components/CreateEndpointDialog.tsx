import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createEndpoint } from "@/lib/api";
import { UserEndpoint } from "@shared/api";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Copy, Plus, RefreshCw } from "lucide-react";

interface CreateEndpointDialogProps {
  onEndpointCreated?: (endpoint: UserEndpoint) => void;
}

export function CreateEndpointDialog({
  onEndpointCreated,
}: CreateEndpointDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [useCustomPath, setUseCustomPath] = useState(false);
  const [error, setError] = useState("");
  const [lockToken, setLockToken] = useState("");

  const getEndpointUrl = () => {
    const path = useCustomPath && customPath ? customPath : "<assigned>";
    return `${window.location.origin}/catch/${path}`;
  };

  const handleCreate = async () => {
    try {
      const endpoint = await createEndpoint({
        name: name || "Untitled Endpoint",
        customPath: useCustomPath && customPath ? customPath : undefined,
        description,
      });

      onEndpointCreated?.(endpoint);
      setError("");
      if (endpoint.lockToken) {
        setLockToken(endpoint.lockToken);
        return;
      }
      setOpen(false);

      // Reset form
      setName("");
      setDescription("");
      setCustomPath("");
      setUseCustomPath(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create endpoint");
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(getEndpointUrl());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Endpoint
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Endpoint 🦜</DialogTitle>
          <DialogDescription>
            Set up a new HTTP endpoint to start catching requests
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Endpoint Name</Label>
            <Input
              id="name"
              placeholder="e.g., webhook-handler, api-test"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="What is this endpoint for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="custom-path"
                checked={useCustomPath}
                onCheckedChange={setUseCustomPath}
              />
              <Label htmlFor="custom-path">Use custom path</Label>
            </div>

            {useCustomPath && (
              <div className="space-y-2">
                <Label htmlFor="custom-path-input">Custom Path</Label>
                <Input
                  id="custom-path-input"
                  placeholder="my-custom-endpoint"
                  value={customPath}
                  onChange={(e) =>
                    setCustomPath(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))
                  }
                />
              </div>
            )}

            <div className="rounded-lg border p-3 bg-muted/50">
              <Label className="text-sm font-medium">Your endpoint URL:</Label>
              <div className="mt-1 flex items-center space-x-2">
                <code className="flex-1 text-sm bg-background px-2 py-1 rounded border">
                  {getEndpointUrl()}
                </code>
                <Button variant="outline" size="sm" onClick={copyUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {lockToken && (
        <p className="text-sm">
          Lock token, shown once: <code className="break-all">{lockToken}</code>. Send it as the header x-pan-parrot-lock or the query lock.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center space-x-2 pt-4">
            <Button onClick={handleCreate} className="flex-1">
              Create Endpoint
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
