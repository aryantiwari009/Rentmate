import React, { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyTheme,
  getThemePreference,
  saveThemePreference,
} from "../utils/theme.js";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

function ThemeToggle() {
  const [preference, setPreference] = useState(getThemePreference);

  // Apply the choice, and follow the OS while "System" is selected.
  useEffect(() => {
    applyTheme(preference);

    if (preference !== "system") return undefined;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  function choose(value) {
    saveThemePreference(value);
    setPreference(value);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Colour theme">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          type="button"
          key={value}
          onClick={() => choose(value)}
          aria-pressed={preference === value}
          aria-label={`${label} theme`}
          title={`${label} theme`}
        >
          <Icon size={17} aria-hidden="true" />
          <span className="theme-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

export default ThemeToggle;
