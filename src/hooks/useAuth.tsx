import { useState, useEffect } from "react";
import { authFetch } from "../lib/apiBase";

interface User {
  id: string;
  username: string;
  role: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  });

  const checkAuth = async () => {
    try {
      const response = await authFetch("/api/auth/me");

      if (response.ok) {
        const data = await response.json();
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: data.user,
        });
      } else {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
        });
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });
    }
  };

  const logout = async () => {
    try {
      await authFetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.removeItem("token");
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return {
    ...authState,
    checkAuth,
    logout,
  };
}
