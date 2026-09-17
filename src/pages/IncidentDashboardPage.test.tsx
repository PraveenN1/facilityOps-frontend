import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentDashboardPage } from "./IncidentDashboardPage";
import { renderWithProviders } from "../test/test-utils";

describe("IncidentDashboardPage", () => {
  beforeEach(() => {
    window.localStorage.setItem(
      "facilityops.demoIdentity",
      JSON.stringify({
        userId: "00000000-0000-0000-0000-000000000001",
        role: "facility_manager",
        buildingId: "00000000-0000-0000-0000-000000000002",
      }),
    );
  });

  it("renders incident rows returned by the API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          limit: 10,
          offset: 0,
          items: [
            {
              id: "00000000-0000-0000-0000-000000000010",
              complaint_id: "00000000-0000-0000-0000-000000000011",
              building_id: "00000000-0000-0000-0000-000000000002",
              complaint_description: "Power failure in lobby",
              category: "ELECTRICAL",
              priority: "HIGH",
              status: "ASSIGNED",
              created_at: "2026-09-17T10:00:00Z",
              ai_triage_status: "SUCCEEDED",
              latest_triage_result: null,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderWithProviders(<IncidentDashboardPage />);

    await waitFor(() => expect(screen.getByText("Power failure in lobby")).toBeInTheDocument());
    expect(screen.getAllByText("ASSIGNED").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("SUCCEEDED")).toBeInTheDocument();
  });

  it("renders an empty state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ total: 0, limit: 10, offset: 0, items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderWithProviders(<IncidentDashboardPage />);

    await waitFor(() => expect(screen.getByText("No incidents found")).toBeInTheDocument());
  });
});
