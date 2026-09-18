import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentDashboardPage } from "./IncidentDashboardPage";
import { renderWithProviders } from "../test/test-utils";

const buildingId = "10000000-0000-0000-0000-000000000001";
const otherBuildingId = "10000000-0000-0000-0000-000000000002";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function mockManagerFetch(incidentBody: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/api/v1/auth/me")) return jsonResponse({ id: "manager-id", email: "manager.demo@facilityops.local", role: "FACILITY_MANAGER", buildings: [{ id: buildingId, name: "Demo Tower" }] });
    if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
    if (url.includes("/api/v1/incidents")) return jsonResponse(incidentBody);
    return jsonResponse({ detail: "unexpected request" }, 500);
  });
}

describe("IncidentDashboardPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("renders incident rows returned by the API", async () => {
    mockManagerFetch({
      total: 1,
      limit: 10,
      offset: 0,
      items: [{
        id: "00000000-0000-0000-0000-000000000010",
        complaint_id: "00000000-0000-0000-0000-000000000011",
        building_id: buildingId,
        complaint_description: "Power failure in lobby",
        category: "ELECTRICAL",
        priority: "HIGH",
        status: "ASSIGNED",
        created_at: "2026-09-17T10:00:00Z",
        ai_triage_status: "SUCCEEDED",
      }],
    });

    renderWithProviders(<IncidentDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Power failure in lobby")).toBeInTheDocument();
      expect(screen.getAllByText("ASSIGNED").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("SUCCEEDED")).toBeInTheDocument();
    });
  });

  it("passes selected building scope to the server-side incident listing", async () => {
    window.localStorage.setItem("facilityops.selectedBuilding.manager-id", otherBuildingId);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/me")) {
        return jsonResponse({
          id: "manager-id",
          email: "manager.demo@facilityops.local",
          role: "FACILITY_MANAGER",
          buildings: [
            { id: buildingId, name: "Demo Tower" },
            { id: otherBuildingId, name: "Warehouse" },
          ],
        });
      }
      if (url.includes("/api/v1/buildings")) {
        return jsonResponse({
          items: [
            { id: buildingId, name: "Demo Tower" },
            { id: otherBuildingId, name: "Warehouse" },
          ],
        });
      }
      if (url.includes("/api/v1/incidents")) return jsonResponse({ total: 0, limit: 10, offset: 0, items: [] });
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDashboardPage />);

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes(`building_id=${otherBuildingId}`))).toBe(true),
    );
  });

  it("renders an empty state", async () => {
    mockManagerFetch({ total: 0, limit: 10, offset: 0, items: [] });

    renderWithProviders(<IncidentDashboardPage />);

    await waitFor(() => expect(screen.getByText("No incidents found")).toBeInTheDocument());
  });
});
