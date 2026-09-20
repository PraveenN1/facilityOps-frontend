import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type ThemePreference = "light" | "dark";

interface ThemeContextValue {
  theme: ThemePreference;
  toggleTheme: () => void;
}

const storageKey = "facilityops.theme";
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function preferredTheme(): ThemePreference {
  const stored = window.localStorage.getItem(storageKey);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>(() => preferredTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
