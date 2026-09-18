import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { csrfStorageKey } from "../api/config";
import { AuthProvider } from "../state/AuthContext";
import { LoginPage } from "../pages/LoginPage";
import type { ReactElement } from "react";
import { AppLayout } from "./AppLayout";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function renderAuth(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}


describe("session authentication UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("logs in with credentials and stores the CSRF token", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse({ detail: "Not authenticated" }, 401);
      if (url.includes("/api/v1/auth/login")) {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ email: "manager.demo@facilityops.local", password: "password123" });
        return jsonResponse({ csrf_token: "login-csrf", user: { id: "manager-id", email: "manager.demo@facilityops.local", role: "FACILITY_MANAGER", buildings: [] } });
      }
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderAuth(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(window.localStorage.getItem(csrfStorageKey)).toBe("login-csrf"));
  });

  it("renders role workspace navigation without development identity controls", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse({ id: "manager-id", email: "manager.demo@facilityops.local", role: "FACILITY_MANAGER", buildings: [{ id: "building-id", name: "Demo Tower" }] });
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: "building-id", name: "Demo Tower" }] });
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderAuth(<AppLayout />);

    await waitFor(() => expect(screen.getByText("Incident queue")).toBeInTheDocument());
    expect(screen.queryByText(/use demo reporter/i)).not.toBeInTheDocument();
  });
});
