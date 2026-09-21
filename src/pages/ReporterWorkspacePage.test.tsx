import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ComplaintCreatePage, ReporterWorkspacePage, reporterProgressForStatus, reporterProgressIndex, reporterProgressSteps, reporterSafetyProgressSteps, reporterStatusLabel } from "./ReporterWorkspacePage";
import { renderWithProviders } from "../test/test-utils";

const buildingId = "10000000-0000-0000-0000-000000000001";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function mockReporterFetch(listBody: unknown = { total: 0, limit: 20, offset: 0, items: [] }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/api/v1/auth/me")) return jsonResponse({ id: "reporter-id", email: "reporter.demo@facilityops.local", display_name: "Priya Nair", role: "REPORTER", buildings: [{ id: buildingId, name: "Demo Tower" }] });
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

  it("renders reporter-friendly request cards with public ticket IDs", async () => {
    mockReporterFetch({
      total: 1,
      limit: 20,
      offset: 0,
      items: [{
        id: "20000000-0000-0000-0000-000000000001",
        building_id: buildingId,
        public_ticket_id: "FO-2026-000501",
        description: "Conference room is too warm with weak airflow near the ceiling vents and the temperature is affecting meetings in the space",
        status: "PENDING_TRIAGE",
        created_at: "2026-09-17T10:00:00Z",
        incident_id: "30000000-0000-0000-0000-000000000001",
        incident_status: "AWAITING_ASSIGNMENT",
        incident_category: "HVAC",
        incident_priority: "MEDIUM",
      }],
    });

    renderWithProviders(<ReporterWorkspacePage />);

    await waitFor(() => expect(screen.getByText("Conference room is too warm with weak airflow near the ceiling vents and the temperature is affecting meetings in the space")).toBeInTheDocument());
    expect(screen.getByText("1 request")).toBeInTheDocument();
    expect(screen.getByText("FO-2026-000501")).toHaveClass("request-ticket");
    expect(screen.getByText("FO-2026-000501")).not.toHaveClass("mono-cell");
    expect(screen.getByText("Conference room is too warm with weak airflow near the ceiling vents and the temperature is affecting meetings in the space")).toHaveClass("request-summary");
    expect(screen.getByText(/Demo Tower/i)).toBeInTheDocument();
    expect(screen.getByText("Technician being arranged")).toBeInTheDocument();
    expect(screen.queryByText(/Your request has been reviewed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/A technician is being arranged/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /all requests/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /most recent/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view details for ticket FO-2026-000501/i })).toHaveAttribute("href", "/incidents/30000000-0000-0000-0000-000000000001");
  });

  it("shows an empty state with a create request action", async () => {
    mockReporterFetch();

    renderWithProviders(<ReporterWorkspacePage />);

    await waitFor(() => expect(screen.getByText("No requests yet")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /create request/i })).toHaveAttribute("href", "/complaints/new");
  });

  it("shows server-confirmed request success with public ticket ID", async () => {
    let created = false;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse({ id: "reporter-id", email: "reporter.demo@facilityops.local", display_name: "Priya Nair", role: "REPORTER", buildings: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/complaints") && init?.method === "POST") {
        created = true;
        return jsonResponse({ complaint_id: "complaint-id", public_ticket_id: "FO-2026-000777", incident_id: "incident-id", status: "PENDING_TRIAGE" }, 202);
      }
      if (url.includes("/api/v1/complaints")) return jsonResponse({ total: 0, limit: 20, offset: 0, items: [] });
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    const user = userEvent.setup();
    renderWithProviders(<ComplaintCreatePage />);

    await screen.findByRole("option", { name: "Demo Tower" });
    await user.selectOptions(screen.getByLabelText(/building/i), buildingId);
    await user.type(screen.getByLabelText(/maintenance request/i), "Water is pooling near the loading dock.");
    const submit = screen.getByRole("button", { name: /submit request/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => expect(created).toBe(true));
    expect(await screen.findByText("Request submitted")).toBeInTheDocument();
    expect(screen.getByText("FO-2026-000777")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view request/i })).toHaveAttribute("href", "/incidents/incident-id");
    expect(screen.queryByRole("button", { name: /submit request/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/maintenance request/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/idempotency/i)).not.toBeInTheDocument();
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

  it("maps backend statuses to consistent reporter labels and progress positions", () => {
    expect(reporterStatusLabel("PENDING_TRIAGE")).toBe("Under review");
    expect(reporterStatusLabel("MANUAL_REVIEW")).toBe("Under review");
    expect(reporterStatusLabel("AWAITING_ASSIGNMENT")).toBe("Technician being arranged");
    expect(reporterStatusLabel("RESOLVED")).toBe("Work completed");
    expect(reporterStatusLabel("SAFETY_ESCALATED")).toBe("Escalated for safety review");
    expect(reporterProgressSteps.map((step) => step.label)).toEqual([
      "Submitted",
      "Under review",
      "Awaiting technician",
      "Technician assigned",
      "Work in progress",
      "Work completed",
      "Closed",
    ]);
    expect(reporterProgressIndex("MANUAL_REVIEW")).toBe(1);
    expect(reporterProgressIndex("AWAITING_ASSIGNMENT")).toBe(2);
    expect(reporterProgressIndex("CLOSED")).toBe(6);
    expect(reporterProgressForStatus("SAFETY_ESCALATED")).toEqual({
      currentIndex: 2,
      steps: reporterSafetyProgressSteps,
    });
    expect(reporterSafetyProgressSteps.map((step) => step.label)).toEqual([
      "Report received",
      "Under review",
      "Escalated for safety review",
    ]);
    expect(reporterSafetyProgressSteps.map((step) => step.label)).not.toContain("Awaiting technician");
    expect(reporterSafetyProgressSteps.map((step) => step.label)).not.toContain("Technician assigned");
    expect(reporterSafetyProgressSteps.map((step) => step.label)).not.toContain("Work in progress");
  });

  it("shows safety-escalated requests in the reporter list without internal escalation details", async () => {
    mockReporterFetch({
      total: 1,
      limit: 20,
      offset: 0,
      items: [{
        id: "20000000-0000-0000-0000-000000000001",
        building_id: buildingId,
        public_ticket_id: "FO-2026-000888",
        description: "Water is leaking above electrical equipment",
        status: "PENDING_TRIAGE",
        created_at: "2026-09-17T10:00:00Z",
        incident_id: "30000000-0000-0000-0000-000000000001",
        incident_status: "SAFETY_ESCALATED",
        incident_category: "ELECTRICAL",
        incident_priority: "CRITICAL",
      }],
    });

    renderWithProviders(<ReporterWorkspacePage />);

    await waitFor(() => expect(screen.getByText("Escalated for safety review")).toBeInTheDocument());
    expect(screen.queryByText(/escalation reason/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recorded by/i)).not.toBeInTheDocument();
    expect(screen.getByText("FO-2026-000888")).toHaveClass("request-ticket");
  });
});
