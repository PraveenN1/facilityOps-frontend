import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ComplaintCreatePage, ReporterWorkspacePage, reporterProgressSteps, reporterStatusLabel } from "./ReporterWorkspacePage";
import { renderWithProviders } from "../test/test-utils";

const buildingId = "10000000-0000-0000-0000-000000000001";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function mockReporterFetch(listBody: unknown = { total: 0, limit: 20, offset: 0, items: [] }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/api/v1/auth/me")) return jsonResponse({ id: "reporter-id", email: "reporter.demo@facilityops.local", role: "REPORTER", buildings: [{ id: buildingId, name: "Demo Tower" }] });
    if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
    if (url.includes("/api/v1/complaints")) return jsonResponse(listBody);
    return jsonResponse({ detail: "unexpected request" }, 500);
  });
}

describe("ReporterWorkspacePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("renders reporter-friendly request cards", async () => {
    mockReporterFetch({
      total: 1,
      limit: 20,
      offset: 0,
      items: [{
        id: "20000000-0000-0000-0000-000000000001",
        building_id: buildingId,
        public_ticket_id: "FO-2026-000501",
        description: "Conference room is too warm with weak airflow",
        status: "PENDING_TRIAGE",
        created_at: "2026-09-17T10:00:00Z",
        incident_id: "30000000-0000-0000-0000-000000000001",
        incident_status: "AWAITING_ASSIGNMENT",
        incident_category: "HVAC",
        incident_priority: "MEDIUM",
      }],
    });

    renderWithProviders(<ReporterWorkspacePage />);

    await waitFor(() => expect(screen.getByText("Conference room is too warm with weak airflow")).toBeInTheDocument());
    expect(screen.getByText(/Ticket FO-2026-000501/i)).toBeInTheDocument();
    expect(screen.getByText(/Demo Tower/i)).toBeInTheDocument();
    expect(screen.getByText("Technician being arranged")).toBeInTheDocument();
    expect(screen.getByText(/facility team has reviewed your request/i)).toBeInTheDocument();
  });

  it("keeps retry identifiers hidden on the new request form", async () => {
    mockReporterFetch();

    renderWithProviders(<ComplaintCreatePage />);

    await waitFor(() => expect(screen.getByRole("button", { name: /submit request/i })).toBeInTheDocument());
    expect(screen.getByText(/Tell us what needs attention/i)).toBeInTheDocument();
    expect(screen.getByText(/urgent hazards or emergencies/i)).toBeInTheDocument();
    expect(screen.queryByText(/idempotency/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/outbox/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/primary incident/i)).not.toBeInTheDocument();
  });

  it("maps backend statuses to consistent reporter labels", () => {
    expect(reporterStatusLabel("PENDING_TRIAGE")).toBe("Under review");
    expect(reporterStatusLabel("MANUAL_REVIEW")).toBe("Under review");
    expect(reporterStatusLabel("AWAITING_ASSIGNMENT")).toBe("Technician being arranged");
    expect(reporterStatusLabel("RESOLVED")).toBe("Work completed, awaiting closure");
    expect(reporterProgressSteps.map((step) => step.label)).toEqual([
      "Under review",
      "Technician being arranged",
      "Technician assigned",
      "Work in progress",
      "Work completed",
      "Closed",
    ]);
  });
});
