import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render } from "@testing-library/react";

import { AuthProvider } from "../state/AuthContext";
import { BuildingProvider } from "../state/BuildingContext";
import { ThemeProvider } from "../state/ThemeContext";

interface RenderOptions {
  initialEntries?: string[];
  routePath?: string;
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const routeContent = options.routePath ? <Routes><Route path={options.routePath} element={ui} /></Routes> : ui;

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BuildingProvider>
            <MemoryRouter initialEntries={options.initialEntries}>{routeContent}</MemoryRouter>
          </BuildingProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
