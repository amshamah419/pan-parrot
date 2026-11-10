import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { themeLabel, useTheme } from "@/hooks/use-theme";
import { Moon } from "lucide-react";

function typingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function ThemeToggle() {
  const { choice, cycle } = useTheme();
  const label = themeLabel(choice);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "t" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (typingTarget(event.target)) return;
      if (document.querySelector("[role='dialog']")) return;
      event.preventDefault();
      cycle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 border-amber-400 bg-amber-100 text-amber-950 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-50 dark:hover:bg-amber-800"
      aria-label={`Color theme: ${label}. Activate to change.`}
      aria-keyshortcuts="t"
      onClick={cycle}
    >
      <Moon className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
