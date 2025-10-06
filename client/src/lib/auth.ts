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

  logout: () => {
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
  
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
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
