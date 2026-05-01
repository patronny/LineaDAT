"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Theme = "luxury" | "linea" | "cyberpunk";

const THEMES: { id: Theme; label: string; emoji: string }[] = [
  { id: "luxury", label: "Luxury", emoji: "" },
  { id: "linea", label: "Linea", emoji: "" },
  { id: "cyberpunk", label: "Cyberpunk", emoji: "" },
];

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("luxury");

  useEffect(() => {
    const stored = localStorage.getItem("lineastr-theme") as Theme | null;
    if (stored) setTheme(stored);
  }, []);

  function applyTheme(t: Theme) {
    setTheme(t);
    localStorage.setItem("lineastr-theme", t);
    document.documentElement.setAttribute("data-theme", t);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => applyTheme(t.id)}
          className={cn(
            "px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors",
            theme === t.id
              ? "bg-primary text-primary-foreground"
              : "hover:bg-secondary text-muted-foreground"
          )}
          aria-label={`Switch to ${t.label} theme`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
