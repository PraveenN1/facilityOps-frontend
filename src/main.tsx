import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";

import { AppLayout } from "./ui/AppLayout";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { ThemeProvider } from "./state/ThemeContext";
import { ProtectedRoute } from "./ui/ProtectedRoute";
import { ComplaintCreatePage } from "./pages/ComplaintCreatePage";
import { IncidentDashboardPage } from "./pages/IncidentDashboardPage";
import { IncidentDetailPage } from "./pages/IncidentDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { ManagerWorkspacePage } from "./pages/ManagerWorkspacePage";
import { ReporterWorkspacePage } from "./pages/ReporterWorkspacePage";
import { TechnicianWorkspacePage } from "./pages/TechnicianWorkspacePage";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});

function RoleHome() {
  const { role } = useAuth();
  if (role === "FACILITY_MANAGER") return <ManagerWorkspacePage />;
  if (role === "TECHNICIAN") return <TechnicianWorkspacePage />;
  if (role === "REPORTER") return <ReporterWorkspacePage />;
  return <Navigate to="/login" replace />;
}

function ManagerOnly({ children }: { children: React.ReactElement }) {
  const { role } = useAuth();
  return role === "FACILITY_MANAGER" ? children : <Navigate to="/" replace />;
}

function ReporterOnly({ children }: { children: React.ReactElement }) {
  const { role } = useAuth();
  return role === "REPORTER" ? children : <Navigate to="/" replace />;
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: <RoleHome /> },
          { path: "incidents", element: <ManagerOnly><IncidentDashboardPage /></ManagerOnly> },
          { path: "incidents/:incidentId", element: <IncidentDetailPage /> },
          { path: "complaints/new", element: <ReporterOnly><ComplaintCreatePage /></ReporterOnly> },
        ],
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
