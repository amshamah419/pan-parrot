import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Trash2, Save } from "lucide-react";

interface MockResponseDialogProps {
  endpointName: string;
}

interface MockRule {
  id: string;
  condition: string;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  delay: number;
  enabled: boolean;
}

export function MockResponseDialog({ endpointName }: MockResponseDialogProps) {
  const [open, setOpen] = useState(false);
  const [mockRules, setMockRules] = useState<MockRule[]>([
    {
      id: "1",
      condition: "all",
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: '{"status": "success", "message": "Hello from PAN Parrot! 🦜"}',
      delay: 0,
      enabled: true,
    },
  ]);

  const addMockRule = () => {
    const newRule: MockRule = {
      id: Math.random().toString(36).substr(2, 9),
      condition: "all",
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: "{}",
      delay: 0,
      enabled: true,
    };
    setMockRules([...mockRules, newRule]);
  };

  const updateMockRule = (id: string, updates: Partial<MockRule>) => {
    setMockRules((rules) =>
      rules.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule)),
    );
  };

  const deleteMockRule = (id: string) => {
    setMockRules((rules) => rules.filter((rule) => rule.id !== id));
  };

  const getStatusCodeColor = (status: number) => {
    if (status >= 200 && status < 300)
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (status >= 300 && status < 400)
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (status >= 400 && status < 500)
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          Configure Mocks
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Mock Responses for "{endpointName}"
          </DialogTitle>
          <DialogDescription>
            Configure automatic responses for incoming requests
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Rules are evaluated in order. First matching rule wins.
            </p>
            <Button onClick={addMockRule} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </div>

          <div className="space-y-4">
            {mockRules.map((rule, index) => (
              <Card key={rule.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-base">
                        Rule {index + 1}
                      </CardTitle>
                      <Badge className={getStatusCodeColor(rule.statusCode)}>
                        {rule.statusCode}
                      </Badge>
                      {rule.delay > 0 && (
                        <Badge variant="outline">{rule.delay}ms delay</Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(enabled) =>
                          updateMockRule(rule.id, { enabled })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMockRule(rule.id)}
                        disabled={mockRules.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Condition</Label>
                      <Select
                        value={rule.condition}
                        onValueChange={(condition) =>
                          updateMockRule(rule.id, { condition })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All requests</SelectItem>
                          <SelectItem value="get">GET requests only</SelectItem>
                          <SelectItem value="post">
                            POST requests only
                          </SelectItem>
                          <SelectItem value="put">PUT requests only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status Code</Label>
                      <Input
                        type="number"
                        value={rule.statusCode}
                        onChange={(e) =>
                          updateMockRule(rule.id, {
                            statusCode: parseInt(e.target.value) || 200,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Response Headers (JSON)</Label>
                    <Textarea
                      value={JSON.stringify(rule.headers, null, 2)}
                      onChange={(e) => {
                        try {
                          const headers = JSON.parse(e.target.value);
                          updateMockRule(rule.id, { headers });
                        } catch (error) {
                          // Ignore invalid JSON
                        }
                      }}
                      rows={2}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Response Body</Label>
                    <Textarea
                      value={rule.body}
                      onChange={(e) =>
                        updateMockRule(rule.id, { body: e.target.value })
                      }
                      rows={4}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Delay (ms)</Label>
                    <Input
                      type="number"
                      value={rule.delay}
                      onChange={(e) =>
                        updateMockRule(rule.id, {
                          delay: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
