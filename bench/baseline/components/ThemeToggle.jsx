"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle({ label }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  };
  return (
    <button
      type="button"
      aria-label={label}
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
