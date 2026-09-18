import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";

import { clearCsrfToken, getMe, login, logout as apiLogout } from "../api/client";
import type { AuthenticatedUserResponse, LoginRequest, UserRole } from "../api/types";

interface AuthContextValue {
  user: AuthenticatedUserResponse | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      await queryClient.invalidateQueries({ queryKey: ["buildings"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: apiLogout,
    onSettled: () => {
      clearCsrfToken();
      queryClient.clear();
    },
  });

  const user = meQuery.data ?? null;
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: (user?.role as UserRole | undefined) ?? null,
      isLoading: meQuery.isLoading,
      isAuthenticated: Boolean(user),
      login: async (payload) => {
        await loginMutation.mutateAsync(payload);
      },
      logout: async () => {
        try {
          await logoutMutation.mutateAsync();
        } catch {
          clearCsrfToken();
          queryClient.clear();
        }
      },
    }),
    [loginMutation, logoutMutation, meQuery.isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

