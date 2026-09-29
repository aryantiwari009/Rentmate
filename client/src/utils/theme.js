export const THEME_KEY = "rentmateTheme";
export const THEMES = ["light", "system", "dark"];

const THEME_COLORS = { light: "#f6f7f4", dark: "#101615" };

export function getThemePreference() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEMES.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(preference) {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference) {
  const resolved = resolveTheme(preference);
  document.documentElement.setAttribute("data-theme", resolved);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[resolved]);
}

export function saveThemePreference(preference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this visit.
  }
}
