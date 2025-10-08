import { useThemeStore } from "@/lib/store";
import { Moon, Sun } from "lucide-react";
import { Button } from "./button";

interface ThemeToggleProps {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "icon" | "sm" | "lg";
  className?: string;
}

export function ThemeToggle({
  variant = "ghost",
  size = "icon",
  className = "",
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={`relative overflow-hidden ${className}`}
      data-testid="theme-toggle"
    >
      <div className="relative z-10 transition-all duration-300 ease-in-out">
        {theme === "dark" ? (
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
        ) : (
          <Moon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
        )}
      </div>
      <div
        className="absolute inset-0 z-0 scale-[2] bg-gradient-to-br opacity-25 transition-opacity duration-500"
        style={{
          backgroundImage:
            theme === "dark"
              ? "radial-gradient(circle at center, var(--primary) 0%, transparent 70%)"
              : "radial-gradient(circle at center, var(--primary) 0%, transparent 70%)",
          opacity: theme === "dark" ? 0.15 : 0.1,
        }}
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
