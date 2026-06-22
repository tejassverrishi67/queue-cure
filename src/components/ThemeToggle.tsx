"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    const activeTheme = isDark ? "dark" : "light";
    if (theme !== activeTheme) {
      setTimeout(() => {
        setTheme(activeTheme);
      }, 0);
    }
  }, [theme]);

  const toggleTheme = () => {
    if (theme === "light") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setTheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setTheme("light");
    }
  };

  return (
    <button
      onClick={toggleTheme}
      id="theme-toggle"
      className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 backdrop-blur-md transition-all duration-200 focus:ring-2 focus:ring-teal-500/20 outline-none flex items-center justify-center cursor-pointer shadow-sm hover:shadow-md"
      aria-label="Toggle Theme"
      title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5 transition-transform hover:rotate-12 duration-300 text-slate-600" />
      ) : (
        <Sun className="w-5 h-5 transition-transform hover:rotate-45 duration-300 text-teal-400" />
      )}
    </button>
  );
}
