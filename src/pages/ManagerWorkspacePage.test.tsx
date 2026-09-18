import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManagerWorkspacePage } from "./ManagerWorkspacePage";
import { renderWithProviders } from "../test/test-utils";

const buildingId = "10000000-0000-0000-0000-000000000001";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function mockManagerOverview() {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/api/v1/auth/me")) return jsonResponse({ id: "manager-id", email: "manager.demo@facilityops.local", role: "FACILITY_MANAGER", buildings: [{ id: buildingId, name: "Demo Tower" }] });
    if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
    if (url.includes("/api/v1/metrics/operations")) {
      return jsonResponse({
        scope: { building_id: buildingId, building_ids: [buildingId] },
        total_incidents: 20,
        open_incidents: 12,
        pending_triage: 2,
        awaiting_assignment: 4,
        assigned: 3,
        in_progress: 3,
        resolved: 1,
        closed: 7,
        active_technician_assignments: 6,
        available_technicians: 5,
      });
    }
    if (url.includes("/api/v1/metrics/ai")) {
      return jsonResponse({
        scope: { building_id: buildingId, building_ids: [buildingId] },
        triage_requests: 14,
        successfully_processed_requests: 9,
        pending_requests: 2,
        failed_requests: 3,
        total_retry_attempts: 1,
        requests_with_retries: 1,
        persisted_successful_triage_results: 9,
        persisted_failed_triage_results: 3,
        incidents_awaiting_human_review: 3,
      });
    }
    if (url.includes("/api/v1/incidents")) return jsonResponse({ total: 0, limit: 10, offset: 0, items: [] });
    return jsonResponse({ detail: "unexpected request" }, 500);
  });
}

describe("ManagerWorkspacePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    mockManagerOverview();
  });

  it("renders metrics with separated labels and values", async () => {
    const { container } = renderWithProviders(<ManagerWorkspacePage />);

    await waitFor(() => {
      const openTile = screen.getByText("Open incidents").closest(".metric-tile");
      expect(openTile).not.toBeNull();
      expect(within(openTile as HTMLElement).getByText("12")).toHaveClass("metric-value");
      expect(screen.getByText("AI failures")).toBeInTheDocument();
      expect(container.querySelectorAll(".metric-tile").length).toBe(8);
    });
  });

  it("uses backend metric values without fabricating SLA indicators", async () => {
    renderWithProviders(<ManagerWorkspacePage />);

    const backlogLabel = await screen.findByText("Human-review backlog");
    const backlogTile = backlogLabel.closest(".metric-tile");
    expect(backlogTile).not.toBeNull();
    expect(within(backlogTile as HTMLElement).getByText("3")).toHaveClass("metric-value");
    expect(screen.queryByText(/sla/i)).not.toBeInTheDocument();
  });
});
