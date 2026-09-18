import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentDetailPage } from "./IncidentDetailPage";
import { csrfStorageKey } from "../api/config";
import { renderWithProviders } from "../test/test-utils";

const buildingId = "10000000-0000-0000-0000-000000000001";
const otherBuildingId = "10000000-0000-0000-0000-000000000002";
const technicianUserId = "10000000-0000-0000-0000-000000000012";
const technicianId = "10000000-0000-0000-0000-000000000020";
const incidentId = "20000000-0000-0000-0000-000000000001";
const assignmentId = "30000000-0000-0000-0000-000000000001";

function incident(overrides: Record<string, unknown> = {}) {
  return {
    id: incidentId,
    complaint_id: "20000000-0000-0000-0000-000000000002",
    building_id: buildingId,
    reporter_id: "10000000-0000-0000-0000-000000000011",
    complaint_description: "Power failure in lobby",
    category: "ELECTRICAL",
    priority: "HIGH",
    status: "ASSIGNED",
    sla_deadline: null,
    version: 2,
    created_at: "2026-09-17T10:00:00Z",
    updated_at: "2026-09-17T10:00:00Z",
    ai_triage_status: "SUCCEEDED",
    latest_triage_result: null,
    active_assignment: {
      assignment_id: assignmentId,
      technician_id: technicianId,
      technician_display_name: "technician.demo@facilityops.local",
      status: "ASSIGNED",
    },
    ...overrides,
  };
}

function technicians() {
  return { items: [{ id: technicianId, user_id: technicianUserId, display_name: "technician.demo@facilityops.local", skills: ["ELECTRICAL"], status: "ACTIVE", available: false, active_assignment_id: assignmentId }] };
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function mockSession(role: "FACILITY_MANAGER" | "TECHNICIAN", buildings = [{ id: buildingId, name: "Demo Tower" }]) {
  return { id: role === "TECHNICIAN" ? technicianUserId : "manager-id", email: role === "TECHNICIAN" ? "technician.demo@facilityops.local" : "manager.demo@facilityops.local", role, buildings };
}

describe("IncidentDetailPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(csrfStorageKey, "csrf-token");
  });

  it("displays active assignment and technician user_id for managers", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/technicians")) return jsonResponse(technicians());
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident());
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByText("Current active assignment")).toBeInTheDocument());
    expect(screen.getAllByText("technician.demo@facilityops.local").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(assignmentId)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/user 10000000\.\.\.0012/i)).toBeInTheDocument());
  });

  it("passes selected building scope to the technician listing", async () => {
    window.localStorage.setItem("facilityops.selectedBuilding.manager-id", otherBuildingId);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/me")) {
        return jsonResponse(
          mockSession("FACILITY_MANAGER", [
            { id: buildingId, name: "Demo Tower" },
            { id: otherBuildingId, name: "Warehouse" },
          ]),
        );
      }
      if (url.includes("/api/v1/buildings")) {
        return jsonResponse({
          items: [
            { id: buildingId, name: "Demo Tower" },
            { id: otherBuildingId, name: "Warehouse" },
          ],
        });
      }
      if (url.includes("/api/v1/technicians")) return jsonResponse(technicians());
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident());
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes(`/api/v1/technicians?building_id=${otherBuildingId}`))).toBe(true),
    );
  });

  it("uses authenticated technician session and CSRF for lifecycle actions", async () => {
    let csrfHeader: string | null = null;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("TECHNICIAN"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${incidentId}/start`)) {
        csrfHeader = new Headers(init?.headers).get("X-CSRF-Token");
        return jsonResponse(incident({ status: "IN_PROGRESS", version: 3, active_assignment: { ...incident().active_assignment, status: "IN_PROGRESS" } }));
      }
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident());
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByRole("button", { name: /start work/i })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: /start work/i }));

    await waitFor(() => expect(csrfHeader).toBe("csrf-token"));
  });

  it("renders a null active assignment empty state without erasing history", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/technicians")) return jsonResponse({ items: [] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "RESOLVED", version: 4, active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getAllByText("No active assignment").length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText(/historical assignments may still exist/i)).toBeInTheDocument();
  });
});
