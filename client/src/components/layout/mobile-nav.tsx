import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Home, User, Bell, LogIn } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { authenticatedApiRequest } from "@/lib/auth";

export function MobileNav() {
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  // Fetch unread notification count
  const { data: unreadData } = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: async () => {
      const res = await authenticatedApiRequest(
        "GET",
        "/api/notifications/unread-count"
      );
      return res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!user,
  });

  const unreadCount = unreadData?.count || 0;

  if (!isAuthenticated) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 glass-effect border-t border-border md:hidden">
      <div className="flex items-center justify-around h-16">
        <Link href="/">
          <a
            className={`flex flex-col items-center gap-1 transition-colors p-2 ${
              location === "/"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="mobile-link-home"
          >
            <Home className="w-6 h-6" strokeWidth={1.5} />
          </a>
        </Link>
        <Link href="/profile">
          <a
            className={`flex flex-col items-center gap-1 transition-colors p-2 ${
              location === "/profile"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="mobile-link-profile"
          >
            <User className="w-6 h-6" strokeWidth={1.5} />
          </a>
        </Link>
        <Link href="/notifications">
          <a
            className={`flex flex-col items-center gap-1 transition-colors p-2 relative ${
              location === "/notifications"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="mobile-link-notifications"
          >
            <div className="relative">
              <Bell className="w-6 h-6" strokeWidth={1.5} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          </a>
        </Link>
      </div>
    </div>
  );
}
