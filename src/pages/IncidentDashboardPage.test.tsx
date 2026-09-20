import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aiQueueLabel, IncidentDashboardPage, workflowLabel } from "./IncidentDashboardPage";
import { renderWithProviders } from "../test/test-utils";
import type { IncidentListItem } from "../api/types";

const buildingId = "10000000-0000-0000-0000-000000000001";
const otherBuildingId = "10000000-0000-0000-0000-000000000002";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function requestUrl(input: RequestInfo | URL) {
  return input instanceof Request ? input.url : String(input);
}

function mockManagerFetch(incidentBody: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = requestUrl(input);
    if (url.includes("/api/v1/auth/me")) return jsonResponse({ id: "manager-id", email: "manager.demo@facilityops.local", role: "FACILITY_MANAGER", buildings: [{ id: buildingId, name: "Demo Tower" }] });
    if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
    if (url.includes("/api/v1/incidents")) return jsonResponse(incidentBody);
    return jsonResponse({ detail: "unexpected request" }, 500);
  });
}

function incident(overrides: Partial<IncidentListItem> = {}): IncidentListItem {
  return {
    id: "00000000-0000-0000-0000-000000000010",
    complaint_id: "00000000-0000-0000-0000-000000000011",
    building_id: buildingId,
    complaint_description: "Power failure in lobby",
    category: "ELECTRICAL",
    priority: "HIGH",
    status: "ASSIGNED",
    created_at: "2026-09-17T10:00:00Z",
    ai_triage_status: "SUCCEEDED",
    latest_triage_result: null,
    ...overrides,
  };
}

describe("IncidentDashboardPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("renders incident rows returned by the API", async () => {
    const longDescription = "Power failure in lobby with multiple tenants reporting flickering lights near the reception desk and elevator bank";
    mockManagerFetch({
      total: 1,
      limit: 10,
      offset: 0,
      items: [{
        ...incident({ complaint_description: longDescription }),
      }],
    });

    renderWithProviders(<IncidentDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(longDescription)).toBeInTheDocument();
      expect(screen.getAllByText("Assigned").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("AI completed")).toBeInTheDocument();
    });
    expect(screen.queryByText(buildingId)).not.toBeInTheDocument();
    const row = await screen.findByRole("link", { name: /open incident 00000000\.\.\.0010/i });
    expect(row).toHaveTextContent("00000000...0010");
    expect(screen.queryByText("00000000-0000-0000-0000-000000000010")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: /incident queue/i })).toBeInTheDocument();
    expect(row).toHaveAttribute("href", "/incidents/00000000-0000-0000-0000-000000000010");
  });

  it("passes selected building scope to the server-side incident listing", async () => {
    window.localStorage.setItem("facilityops.selectedBuilding.manager-id", otherBuildingId);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
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
      expect(fetchMock.mock.calls.some(([input]) => requestUrl(input).includes(`building_id=${otherBuildingId}`))).toBe(true),
    );
  });

  it("passes status filters to the server and resets pagination", async () => {
    const fetchMock = mockManagerFetch({ total: 0, limit: 10, offset: 0, items: [] });

    renderWithProviders(<IncidentDashboardPage />);

    fireEvent.change(await screen.findByLabelText(/status filter/i), { target: { value: "IN_PROGRESS" } });

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input]) => requestUrl(input).includes("status=IN_PROGRESS"))).toBe(true),
    );
  });

  it("uses server totals for pagination", async () => {
    const fetchMock = mockManagerFetch({
      total: 12,
      limit: 10,
      offset: 0,
      items: [incident()],
    });

    renderWithProviders(<IncidentDashboardPage />);

    await waitFor(() => expect(screen.getByText("12 incidents")).toBeInTheDocument());
    await screen.findByRole("link", { name: /open incident/i });
    fireEvent.click(await screen.findByRole("button", { name: /next/i }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input]) => requestUrl(input).includes("offset=10"))).toBe(true),
    );
  });

  it("renders an empty state", async () => {
    mockManagerFetch({ total: 0, limit: 10, offset: 0, items: [] });

    renderWithProviders(<IncidentDashboardPage />);

    await waitFor(() => expect(screen.getByText("No incidents found")).toBeInTheDocument());
  });

  it("maps all workflow states to readable queue labels", () => {
    expect(workflowLabel("PENDING_TRIAGE")).toBe("Pending triage");
    expect(workflowLabel("MANUAL_REVIEW")).toBe("Manual review");
    expect(workflowLabel("AWAITING_ASSIGNMENT")).toBe("Awaiting assignment");
    expect(workflowLabel("ASSIGNED")).toBe("Assigned");
    expect(workflowLabel("IN_PROGRESS")).toBe("In progress");
    expect(workflowLabel("RESOLVED")).toBe("Resolved");
    expect(workflowLabel("CLOSED")).toBe("Closed");
  });

  it("keeps AI status independent from workflow state", async () => {
    mockManagerFetch({
      total: 1,
      limit: 10,
      offset: 0,
      items: [incident({ status: "AWAITING_ASSIGNMENT", ai_triage_status: "PENDING" })],
    });

    renderWithProviders(<IncidentDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Awaiting assignment")).toBeInTheDocument();
      expect(screen.getByText("AI pending")).toBeInTheDocument();
    });
    const row = await screen.findByRole("link", { name: /open incident/i });
    expect(within(row).queryByText(/approval/i)).not.toBeInTheDocument();
  });

  it("does not treat processed AI without validated result as a recommendation", () => {
    expect(aiQueueLabel({ ai_triage_status: "PROCESSED", latest_triage_result: null })).toBe("Processed, no recommendation");
    expect(aiQueueLabel({
      ai_triage_status: "PROCESSED",
      latest_triage_result: {
        id: "result-id",
        status: "SUCCEEDED",
        model_version: "groq",
        created_at: "2026-09-17T10:00:00Z",
        validated_result: {
          category: "HVAC",
          location: null,
          issue_summary: "Warm room",
          symptoms: [],
          potential_hazards: [],
          suggested_priority: "MEDIUM",
          missing_information: [],
          needs_human_review: false,
          safety_notes: [],
        },
      },
    })).toBe("AI recommendation ready");
    expect(aiQueueLabel({ ai_triage_status: "TIMEOUT", latest_triage_result: null })).toBe("AI timed out");
    expect(aiQueueLabel({ ai_triage_status: "FAILED", latest_triage_result: null })).toBe("AI failed");
  });

  it("uses theme-aware queue and badge classes", async () => {
    window.localStorage.setItem("facilityops.theme", "dark");
    mockManagerFetch({
      total: 1,
      limit: 10,
      offset: 0,
      items: [incident({ status: "RESOLVED", ai_triage_status: "FAILED" })],
    });

    renderWithProviders(<IncidentDashboardPage />);

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    await screen.findByRole("link", { name: /open incident/i });
    const list = await screen.findByRole("list", { name: /incident queue/i });
    expect(list).toHaveClass("queue-items");
    expect(list.parentElement).toHaveClass("queue-list");
    const row = screen.getByRole("link", { name: /open incident/i });
    expect(row).toHaveClass("queue-row");
    expect(within(row).getByText("Resolved")).toHaveClass("status-badge");
    expect(within(row).getByText("AI failed")).toHaveClass("status-badge");
  });
});
