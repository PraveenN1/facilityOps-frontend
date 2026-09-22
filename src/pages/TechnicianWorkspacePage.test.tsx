import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TechnicianWorkspacePage } from "./TechnicianWorkspacePage";
import { csrfStorageKey } from "../api/config";
import { renderWithProviders } from "../test/test-utils";

const buildingId = "10000000-0000-0000-0000-000000000001";
const assignedIncidentId = "20000000-0000-0000-0000-000000000001";
const inProgressIncidentId = "20000000-0000-0000-0000-000000000002";
const assignmentId = "30000000-0000-0000-0000-000000000001";

function requestUrl(input: RequestInfo | URL) {
  return input instanceof Request ? input.url : String(input);
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function authResponse() {
  return {
    id: "10000000-0000-0000-0000-000000000012",
    email: "technician.demo@facilityops.local",
    role: "TECHNICIAN",
    buildings: [{ id: buildingId, name: "Demo Tower" }],
  };
}

function workItem(overrides: Record<string, unknown> = {}) {
  return {
    id: assignedIncidentId,
    complaint_id: "20000000-0000-0000-0000-000000000101",
    public_ticket_id: "FO-2026-000401",
    building_id: buildingId,
    complaint_description: "Training room air handler is blowing warm air",
    category: "HVAC",
    priority: "HIGH",
    status: "ASSIGNED",
    version: 2,
    created_at: "2026-09-18T10:00:00Z",
    assignment_id: assignmentId,
    assignment_status: "ASSIGNED",
    ...overrides,
  };
}

function resolvedIncident() {
  return {
    id: inProgressIncidentId,
    complaint_id: "20000000-0000-0000-0000-000000000102",
    public_ticket_id: "FO-2026-000402",
    building_id: buildingId,
    reporter_id: "10000000-0000-0000-0000-000000000011",
    complaint_description: "Conference room fan coil is noisy",
    category: "HVAC",
    priority: "MEDIUM",
    status: "RESOLVED",
    sla_deadline: null,
    version: 5,
    created_at: "2026-09-18T09:00:00Z",
    updated_at: "2026-09-18T11:00:00Z",
    ai_triage_status: null,
    latest_triage_result: null,
    active_assignment: null,
  };
}

describe("TechnicianWorkspacePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(csrfStorageKey, "csrf-token");
  });

  it("shows start only for assigned work and avoids routine UUID primary labels", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(authResponse());
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/incidents/my-work")) return jsonResponse({ items: [workItem()] });
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<TechnicianWorkspacePage />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Training room air handler is blowing warm air" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /start work/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resolve work/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/resolution notes/i)).not.toBeInTheDocument();
    expect(screen.getByText("Demo Tower")).toBeInTheDocument();
    expect(screen.getByText("FO-2026-000401")).toBeInTheDocument();
    expect(screen.queryByText(assignedIncidentId)).not.toBeInTheDocument();
  });

  it("shows AI recommendation details for assigned technician work", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(authResponse());
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/incidents/my-work")) {
        return jsonResponse({
          items: [workItem({
            latest_triage_result: {
              id: "40000000-0000-0000-0000-000000000001",
              status: "SUCCEEDED",
              model_version: "groq:openai/gpt-oss-20b",
              validated_result: {
                category: "HVAC",
                location: "Training room ceiling vents",
                issue_summary: "Air conditioning is not cooling properly and airflow is weak.",
                symptoms: ["warm air", "weak airflow"],
                potential_hazards: [],
                suggested_priority: "HIGH",
                missing_information: [],
                needs_human_review: false,
                safety_notes: ["Avoid blocking the ceiling vents until inspection is complete."],
              },
              created_at: "2026-09-18T10:05:00Z",
            },
          })],
        });
      }
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<TechnicianWorkspacePage />);

    await waitFor(() => expect(screen.getByLabelText(/AI recommendation/i)).toBeInTheDocument());
    const panel = screen.getByLabelText(/AI recommendation/i);
    expect(panel).toHaveTextContent("Advisory recommendation");
    expect(panel).toHaveTextContent("AI-suggested category");
    expect(panel).toHaveTextContent("HVAC");
    expect(panel).toHaveTextContent("AI-suggested priority");
    expect(panel).toHaveTextContent("HIGH");
    expect(panel).toHaveTextContent("Air conditioning is not cooling properly and airflow is weak.");
    expect(panel).toHaveTextContent("Training room ceiling vents");
    expect(panel).toHaveTextContent("Avoid blocking the ceiling vents until inspection is complete.");
    expect(panel).toHaveTextContent(/may require human verification/i);
    expect(screen.queryByText("groq:openai/gpt-oss-20b")).not.toBeInTheDocument();
    expect(screen.queryByText("potential_hazards")).not.toBeInTheDocument();
  });

  it("shows resolve only for in-progress work and validates notes", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(authResponse());
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/incidents/my-work")) {
        return jsonResponse({
          items: [workItem({ id: inProgressIncidentId, status: "IN_PROGRESS", assignment_status: "IN_PROGRESS", priority: "MEDIUM", complaint_description: "Conference room fan coil is noisy" })],
        });
      }
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<TechnicianWorkspacePage />);

    const notes = await screen.findByLabelText(/resolution notes/i);
    const resolveButton = screen.getByRole("button", { name: /resolve work/i });
    expect(screen.queryByRole("button", { name: /start work/i })).not.toBeInTheDocument();
    expect(resolveButton).toBeDisabled();
    await userEvent.type(notes, "Cleaned filter and restored airflow.");
    expect(resolveButton).toBeEnabled();
  });

  it("shows confirmation and refetches active work after successful resolution", async () => {
    const user = userEvent.setup();
    let workRequests = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(authResponse());
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${inProgressIncidentId}/resolve`) && init?.method === "POST") return jsonResponse(resolvedIncident());
      if (url.includes("/api/v1/incidents/my-work")) {
        workRequests += 1;
        if (workRequests === 1) {
          return jsonResponse({
            items: [workItem({ id: inProgressIncidentId, status: "IN_PROGRESS", assignment_status: "IN_PROGRESS", priority: "MEDIUM", complaint_description: "Conference room fan coil is noisy" })],
          });
        }
        return jsonResponse({ items: [] });
      }
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<TechnicianWorkspacePage />);

    await user.type(await screen.findByLabelText(/resolution notes/i), "Cleaned filter and restored airflow.");
    await user.click(screen.getByRole("button", { name: /resolve work/i }));

    await waitFor(() => expect(screen.getByText(/Resolved FO-2026-000402/i)).toBeInTheDocument());
    expect(screen.getByText(/This job left your active queue/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolution notes: Cleaned filter and restored airflow/i)).toBeInTheDocument();
    await waitFor(() => expect(workRequests).toBeGreaterThan(1));
    expect(screen.getByText("No active work orders")).toBeInTheDocument();
  });

  it("does not show success when resolution fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(authResponse());
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${inProgressIncidentId}/resolve`) && init?.method === "POST") return jsonResponse({ detail: "Resolution notes are required" }, 422);
      if (url.includes("/api/v1/incidents/my-work")) {
        return jsonResponse({
          items: [workItem({ id: inProgressIncidentId, status: "IN_PROGRESS", assignment_status: "IN_PROGRESS", priority: "MEDIUM", complaint_description: "Conference room fan coil is noisy" })],
        });
      }
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<TechnicianWorkspacePage />);

    await user.type(await screen.findByLabelText(/resolution notes/i), "Done.");
    await user.click(screen.getByRole("button", { name: /resolve work/i }));

    await waitFor(() => expect(screen.getByText("Action failed")).toBeInTheDocument());
    expect(screen.queryByText(/This job left your active queue/i)).not.toBeInTheDocument();
  });

  it("handles 409 conflicts by refetching and requiring review", async () => {
    const user = userEvent.setup();
    let workRequests = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(authResponse());
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${inProgressIncidentId}/resolve`) && init?.method === "POST") return jsonResponse({ detail: "Incident version conflict" }, 409);
      if (url.includes("/api/v1/incidents/my-work")) {
        workRequests += 1;
        return jsonResponse({
          items: [workItem({ id: inProgressIncidentId, status: "IN_PROGRESS", assignment_status: "IN_PROGRESS", priority: "MEDIUM", complaint_description: "Conference room fan coil is noisy" })],
        });
      }
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<TechnicianWorkspacePage />);

    await user.type(await screen.findByLabelText(/resolution notes/i), "Done.");
    await user.click(screen.getByRole("button", { name: /resolve work/i }));

    await waitFor(() => expect(screen.getByText("Conflict requires review")).toBeInTheDocument());
    expect(screen.getByText(/This work order changed/i)).toBeInTheDocument();
    await waitFor(() => expect(workRequests).toBeGreaterThan(1));
  });

  it("uses mobile-first work-order classes", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(authResponse());
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/incidents/my-work")) return jsonResponse({ items: [workItem()] });
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<TechnicianWorkspacePage />);

    const action = await screen.findByRole("button", { name: /start work/i });
    expect(action).toHaveClass("work-primary-action");
    expect(action.closest("article")).toHaveClass("work-order-card");
  });

  it("shows access errors for unauthorized work-list responses", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(authResponse());
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/incidents/my-work")) return jsonResponse({ detail: "Technician access is required" }, 403);
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<TechnicianWorkspacePage />);

    await waitFor(() => expect(screen.getByText("Access denied")).toBeInTheDocument());
  });

  it("sends start requests only after deliberate action and prevents duplicate pending submissions", async () => {
    let startRequests = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(authResponse());
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${assignedIncidentId}/start`) && init?.method === "POST") {
        startRequests += 1;
        return new Promise((resolve) => setTimeout(() => resolve(jsonResponse({ ...resolvedIncident(), id: assignedIncidentId, status: "IN_PROGRESS" })), 50));
      }
      if (url.includes("/api/v1/incidents/my-work")) return jsonResponse({ items: [workItem()] });
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<TechnicianWorkspacePage />);

    const button = await screen.findByRole("button", { name: /start work/i });
    expect(startRequests).toBe(0);
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(startRequests).toBe(1));
    expect(button).toBeDisabled();
  });
});
