import { useCallback, useEffect, useState } from "react";
import { nextTheme, themeIsDark, type ThemeChoice } from "@shared/inspector";

export const THEME_KEY = "pan-parrot-theme";

export function readThemeChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // Storage can be blocked. Fall through to the system setting.
  }
  return "system";
}

export function applyThemeChoice(choice: ThemeChoice): void {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = themeIsDark(choice, systemDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = choice;
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function themeLabel(choice: ThemeChoice): string {
  if (choice === "light") return "Light";
  if (choice === "dark") return "Dark";
  return "System";
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    const initial = readThemeChoice();
    setChoice(initial);
    applyThemeChoice(initial);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readThemeChoice() === "system") applyThemeChoice("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // The class still updates for this page view.
    }
    setChoice(next);
    applyThemeChoice(next);
  }, []);

  const cycle = useCallback(() => {
    setChoice((current) => {
      const next = nextTheme(current);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // The class still updates for this page view.
      }
      applyThemeChoice(next);
      return next;
    });
  }, []);

  return { choice, setTheme, cycle };
}
