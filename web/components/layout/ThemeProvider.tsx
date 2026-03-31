"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useChatStore } from "@/lib/store";
import type { TerminalTheme } from "@/lib/types";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
  terminalTheme: TerminalTheme;
  setTerminalTheme: (t: TerminalTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  resolvedTheme: "dark",
  terminalTheme: "tokyo-night",
  setTerminalTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings } = useChatStore();
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  // Apply light/dark class
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const resolve = () => {
      if (settings.theme === "system") {
        return mediaQuery.matches ? "dark" : "light";
      }
      return settings.theme;
    };

    const apply = () => {
      const resolved = resolve();
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle("light", resolved === "light");
    };

    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, [settings.theme]);

  // Apply terminal theme data attribute
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-terminal-theme",
      settings.terminalTheme ?? "tokyo-night"
    );
  }, [settings.terminalTheme]);

  // Apply terminal effects data attributes
  useEffect(() => {
    const root = document.documentElement;
    const effects = settings.terminalEffects ?? {};
    const toggle = (attr: string, on: boolean) => {
      if (on) root.setAttribute(attr, "");
      else root.removeAttribute(attr);
    };
    toggle("data-effect-scanlines", !!effects.scanlines);
    toggle("data-effect-glow", !!effects.glow);
    toggle("data-effect-curvature", !!effects.curvature);
    toggle("data-effect-flicker", !!effects.flicker);
  }, [settings.terminalEffects]);

  const setTheme = (theme: Theme) => updateSettings({ theme });
  const setTerminalTheme = (terminalTheme: TerminalTheme) =>
    updateSettings({ terminalTheme });

  return (
    <ThemeContext.Provider
      value={{
        theme: settings.theme,
        setTheme,
        resolvedTheme,
        terminalTheme: settings.terminalTheme ?? "tokyo-night",
        setTerminalTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
