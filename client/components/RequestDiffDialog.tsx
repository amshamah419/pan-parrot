import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CapturedRequest } from "@shared/api";
import { callSnapshot, lineDiff } from "@shared/inspector";

export function RequestDiffDialog({
  left,
  right,
  open,
  onOpenChange,
}: {
  left: CapturedRequest | null;
  right: CapturedRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rows = left && right ? lineDiff(callSnapshot(left), callSnapshot(right)) : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden bg-card">
        <DialogHeader>
          <DialogTitle>Compare two calls</DialogTitle>
          <DialogDescription>
            The left call is the first one you marked. Removed lines stay on the left. Added lines stay on the right.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 text-xs font-medium">
          <p>{left ? `${left.method} ${left.endpoint}` : "Left"}</p>
          <p>{right ? `${right.method} ${right.endpoint}` : "Right"}</p>
        </div>
        <div className="max-h-[60vh] overflow-auto rounded border bg-background font-mono text-xs" role="table" aria-label="Side-by-side call diff">
          {rows.map((row, index) => (
            <div key={`${index}-${row.kind}`} className="grid grid-cols-2" role="row">
              <pre
                className={`m-0 whitespace-pre-wrap break-all border-r px-2 py-0.5 ${row.kind === "remove" ? "bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-100" : "bg-background"}`}
                role="cell"
              >
                {row.left || " "}
              </pre>
              <pre
                className={`m-0 whitespace-pre-wrap break-all px-2 py-0.5 ${row.kind === "add" ? "bg-green-100 text-green-950 dark:bg-green-950 dark:text-green-100" : "bg-background"}`}
                role="cell"
              >
                {row.right || " "}
              </pre>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
