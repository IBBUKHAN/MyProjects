import { Link, useLocation } from 'wouter';
import { Home, User, Bell, LogIn } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

export function MobileNav() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 glass-effect border-t border-border md:hidden">
      <div className="flex items-center justify-around h-16">
        <Link href="/">
          <a className={`flex flex-col items-center gap-1 transition-colors p-2 ${
            location === '/' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`} data-testid="mobile-link-home">
            <Home className="w-6 h-6" strokeWidth={1.5} />
          </a>
        </Link>
        <Link href="/profile">
          <a className={`flex flex-col items-center gap-1 transition-colors p-2 ${
            location === '/profile' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`} data-testid="mobile-link-profile">
            <User className="w-6 h-6" strokeWidth={1.5} />
          </a>
        </Link>
        <Link href="/notifications">
          <a className={`flex flex-col items-center gap-1 transition-colors p-2 relative ${
            location === '/notifications' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`} data-testid="mobile-link-notifications">
            <Bell className="w-6 h-6" strokeWidth={1.5} />
            <span className="absolute top-1 right-2 w-2 h-2 bg-destructive rounded-full"></span>
          </a>
        </Link>
      </div>
    </div>
  );
}
