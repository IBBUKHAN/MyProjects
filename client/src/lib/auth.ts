import { apiRequest } from "./queryClient";
import type { User, LoginData, RegisterData } from "@shared/schema";

interface AuthResponse {
  user: User;
  token: string;
}

export const authApi = {
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await apiRequest("POST", "/api/auth/login", data);
    const result = await response.json();

    // Store token in localStorage
    localStorage.setItem("auth_token", result.token);

    return result;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiRequest("POST", "/api/auth/register", data);
    const result = await response.json();

    // Store token in localStorage
    localStorage.setItem("auth_token", result.token);

    return result;
  },

  logout: async () => {
    const token = authApi.getToken();

    // Call backend logout endpoint if token exists
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });
      } catch (error) {
        console.error("Backend logout failed:", error);
        // Continue with local logout even if backend fails
      }
    }

    // Always clear local storage
    localStorage.removeItem("auth_token");
  },

  getToken: (): string | null => {
    return localStorage.getItem("auth_token");
  },

  getCurrentUser: async (): Promise<User | null> => {
    const token = authApi.getToken();
    if (!token) return null;

    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          authApi.logout();
        }
        return null;
      }

      const result = await response.json();
      if (result?.user?.profilePictureUrl) {
        result.user.profilePictureUrl = `${
          result.user.profilePictureUrl
        }?t=${Date.now()}`;
      }
      return result.user;
    } catch (error) {
      console.error("Failed to get current user:", error);
      return null;
    }
  },
};

// Override the default query client to include auth token
export const authenticatedApiRequest = async (
  method: string,
  url: string,
  data?: unknown
): Promise<Response> => {
  const token = authApi.getToken();

  const isFormData =
    typeof FormData !== "undefined" && data instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData && data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: isFormData
      ? (data as FormData)
      : data
      ? JSON.stringify(data)
      : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    if (res.status === 401) {
      authApi.logout();
      window.location.href = "/login";
    }
    throw new Error(`${res.status}: ${text}`);
  }

  return res;
};
