import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppLayout } from "./AppLayout";
import { renderWithProviders } from "../test/test-utils";

const buildingId = "10000000-0000-0000-0000-000000000001";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("AppLayout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/api/v1/auth/me")) {
        return jsonResponse({
          id: "manager-id",
          email: "manager.demo@facilityops.local",
          display_name: "Morgan Manager",
          role: "FACILITY_MANAGER",
          buildings: [{ id: buildingId, name: "Demo Tower" }],
        });
      }
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      return jsonResponse({ detail: "unexpected request" }, 500);
    });
  });

  it("renders only implemented manager navigation sections", async () => {
    renderWithProviders(<AppLayout />);

    const nav = await screen.findByRole("navigation", { name: /workspace/i });
    await waitFor(() => expect(within(nav).getByRole("link", { name: /overview/i })).toBeInTheDocument());
    expect(within(nav).getByRole("link", { name: /incident queue/i })).toBeInTheDocument();
    expect(within(nav).queryByText("Team")).not.toBeInTheDocument();
    expect(within(nav).queryByText("AI review")).not.toBeInTheDocument();
    expect(within(nav).queryByText("Reports")).not.toBeInTheDocument();
  });
});