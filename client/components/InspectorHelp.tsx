import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const shortcuts = [
  ["?", "Open this shortcut list"],
  ["/", "Focus the request search"],
  ["c", "Copy the selected call as cURL"],
  ["p", "Copy the selected call as Python requests"],
  ["r", "Replay the selected call"],
  ["d", "Mark the selected call for a side-by-side diff"],
  ["t", "Cycle the color theme: System, Light, Dark"],
];

export function InspectorHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts stay quiet while you are typing in a field. Redacted headers are left out of copies and replays.
          </DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <caption className="sr-only">Request inspector shortcuts</caption>
          <tbody>
            {shortcuts.map(([key, action]) => (
              <tr key={key} className="border-b">
                <th scope="row" className="py-2 pr-4 text-left font-mono">
                  {key}
                </th>
                <td className="py-2 text-muted-foreground">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
