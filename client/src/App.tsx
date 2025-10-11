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
import VerifyEmail from "@/pages/verify-email";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import UserProfile from "@/pages/user-profile";
import ArticleCompose from "@/pages/article-compose";
import Notifications from "@/pages/notifications";

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

      <Route path="/verify-email">
        <PublicRoute>
          <VerifyEmail />
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

      <Route path="/users/:id">
        <ProtectedRoute>
          <UserProfile />
        </ProtectedRoute>
      </Route>

      <Route path="/compose/article">
        <ProtectedRoute>
          <ArticleCompose />
        </ProtectedRoute>
      </Route>

      <Route path="/notifications">
        <ProtectedRoute>
          <Notifications />
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
