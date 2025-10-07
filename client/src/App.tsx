import { useEffect } from "react";
import { Switch, Route, Redirect, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { authApi } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import ArticleCompose from "@/pages/article-compose";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";

function AuthCheck({ children }: { children: React.ReactNode }) {
  const { user, setUser, isAuthenticated } = useAuthStore();

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: authApi.getCurrentUser,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    // If there is no token (e.g., user deleted or logged out elsewhere),
    // ensure local auth state is cleared immediately to avoid 401 spam.
    if (!authApi.getToken() && (user || isAuthenticated)) {
      setUser(null);
    }

    if (currentUser) {
      setUser(currentUser);
    } else if (!isAuthenticated) {
      setUser(null);
    }
  }, [currentUser, setUser, isAuthenticated]);

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <PublicRoute>
          <Login />
        </PublicRoute>
      </Route>

      <Route path="/register">
        <PublicRoute>
          <Register />
        </PublicRoute>
      </Route>

      <Route path="/">
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </Route>

      <Route path="/profile">
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      </Route>

      <Route path="/compose/article">
        <ProtectedRoute>
          <ArticleCompose />
        </ProtectedRoute>
      </Route>

      <Route path="/notifications">
        <ProtectedRoute>
          <div className="min-h-screen bg-background">
            <Navbar />
            <div className="pt-20 pb-24 md:pb-8">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold">Notifications</h1>
                  <Link href="/">
                    <a>
                      <Button variant="outline" size="sm">
                        Back
                      </Button>
                    </a>
                  </Link>
                </div>
                <div className="glass-effect rounded-2xl p-6 text-center">
                  <p className="text-muted-foreground">No notifications yet.</p>
                </div>
              </div>
            </div>
            <MobileNav />
          </div>
        </ProtectedRoute>
      </Route>

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthCheck>
            <Toaster />
            <Router />
          </AuthCheck>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
