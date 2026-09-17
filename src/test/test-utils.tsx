import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";

import { IdentityProvider } from "../state/IdentityContext";

export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <IdentityProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </IdentityProvider>
    </QueryClientProvider>,
  );
}
