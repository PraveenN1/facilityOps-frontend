import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { AppLayout } from "./ui/AppLayout";
import { IdentityProvider } from "./state/IdentityContext";
import { ComplaintCreatePage } from "./pages/ComplaintCreatePage";
import { IncidentDashboardPage } from "./pages/IncidentDashboardPage";
import { IncidentDetailPage } from "./pages/IncidentDetailPage";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
    },
  },
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <IncidentDashboardPage /> },
      { path: "complaints/new", element: <ComplaintCreatePage /> },
      { path: "incidents/:incidentId", element: <IncidentDetailPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <IdentityProvider>
        <RouterProvider router={router} />
      </IdentityProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
