import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../state/AuthContext";
import { LoadingState } from "./AsyncState";

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) return <LoadingState label="Restoring session" />;
  if (!auth.isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
