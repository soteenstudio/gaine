export const THEME_STORAGE_KEY = "theme";

export const themeInitScript = `(function(){try{var d=document.documentElement;d.classList.add("js");var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){d.classList.add("dark");}}catch(e){}})();`;

export function applyTheme() {
  const root = document.documentElement;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {}
  const dark =
    stored === "dark" ||
    (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.add("js");
  root.classList.toggle("dark", dark);
}

export function toggleTheme() {
  const root = document.documentElement;
  const next = root.classList.contains("dark") ? "light" : "dark";
  root.classList.toggle("dark", next === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {}
}
