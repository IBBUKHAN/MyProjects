import { Link, useLocation } from "wouter";
import { useAuthStore, useThemeStore } from "@/lib/store";
import { authApi } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Home, User, Bell, Sun, Moon, MessageCircle } from "lucide-react";

export function Navbar() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const handleLogout = async () => {
    try {
      // Call backend logout and clear token from localStorage
      await authApi.logout();

      // Clear user from store
      logout();

      // Navigate to login
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Force logout anyway
      localStorage.removeItem("auth_token");
      logout();
      navigate("/login");
    }
  };

  if (!user) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <MessageCircle
                className="w-6 h-6 text-primary-foreground"
                strokeWidth={2}
              />
            </div>
            <span className="text-xl font-bold hidden sm:block">
              EchoMateLite
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/">
              <a
                className={`nav-link flex flex-col items-center gap-1 transition-colors ${
                  location === "/"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="link-home"
              >
                <Home className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-xs">Home</span>
              </a>
            </Link>
            <Link href="/profile">
              <a
                className={`nav-link flex flex-col items-center gap-1 transition-colors ${
                  location === "/profile"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="link-profile"
              >
                <User className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-xs">Profile</span>
              </a>
            </Link>
            <Link href="/notifications">
              <a
                className={`nav-link flex flex-col items-center gap-1 transition-colors relative ${
                  location === "/notifications"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="link-notifications"
              >
                <Bell className="w-6 h-6" strokeWidth={1.5} />
                <span className="absolute top-0 right-0 w-2 h-2 bg-destructive rounded-full"></span>
                <span className="text-xs">Notifications</span>
              </a>
            </Link>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="p-2"
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" strokeWidth={1.5} />
              ) : (
                <Moon className="w-5 h-5" strokeWidth={1.5} />
              )}
            </Button>

            {/* User Menu */}
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8" data-testid="avatar-user">
                <AvatarImage
                  src={user.profilePictureUrl || undefined}
                  alt={user.name}
                />
                <AvatarFallback>
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-sm font-medium">
                {user.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="ml-2"
                data-testid="button-logout"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
