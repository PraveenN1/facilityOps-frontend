import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasRequiredSkill, IncidentDetailPage } from "./IncidentDetailPage";
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

function requestUrl(input: RequestInfo | URL) {
  return input instanceof Request ? input.url : String(input);
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

  it("displays active assignment without exposing routine technician UUIDs to managers", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/technicians")) return jsonResponse(technicians());
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident());
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByText("Current active assignment")).toBeInTheDocument());
    expect(screen.getAllByText("technician.demo@facilityops.local").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("30000000...0001")).not.toBeInTheDocument();
    expect(screen.queryByText(assignmentId)).not.toBeInTheDocument();
    expect(screen.queryByText(/user 10000000/i)).not.toBeInTheDocument();
  });

  it("passes selected building scope to the technician listing", async () => {
    window.localStorage.setItem("facilityops.selectedBuilding.manager-id", otherBuildingId);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
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
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "AWAITING_ASSIGNMENT", active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input]) => requestUrl(input).includes(`/api/v1/technicians?building_id=${otherBuildingId}`))).toBe(true),
    );
  });

  it("uses authenticated technician session and CSRF for lifecycle actions", async () => {
    let csrfHeader: string | null = null;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = requestUrl(input);
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

  it("does not show technician start or resolve controls to managers", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "ASSIGNED" }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByText(/assigned technician controls start and resolve actions/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /start work/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resolve work/i })).not.toBeInTheDocument();
  });

  it("shows dispatch only while awaiting assignment and hides editable triage", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/technicians")) return jsonResponse({ items: [{ ...technicians().items[0], available: true, active_assignment_id: null }] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "AWAITING_ASSIGNMENT", active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByText("Qualified candidates")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /confirm triage/i })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /assign technician/i })).toBeInTheDocument();
  });

  it("shows manager closure only when resolved", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "RESOLVED", version: 4, active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByRole("button", { name: /close incident/i })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /start work/i })).not.toBeInTheDocument();
  });

  it("renders pending AI and manual triage without implying completed review", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "PENDING_TRIAGE", ai_triage_status: "PROCESSING", active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByText(/manual review has not been completed yet/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /confirm triage/i })).toBeInTheDocument();
    const categorySelect = screen.getByLabelText(/confirmed category/i);
    expect(categorySelect.tagName).toBe("SELECT");
    expect(within(categorySelect).getByRole("option", { name: "PLUMBING" })).toBeInTheDocument();
    expect(within(categorySelect).getByRole("option", { name: "UNKNOWN" })).toBeInTheDocument();
  });

  it("submits only approved triage category values from the category dropdown", async () => {
    const user = userEvent.setup();
    let submittedBody: Record<string, unknown> | null = null;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${incidentId}/manual-triage`) && init?.method === "POST") {
        submittedBody = JSON.parse(String(init.body));
        return jsonResponse(incident({ status: "AWAITING_ASSIGNMENT", category: "PLUMBING", priority: "MEDIUM", version: 3, active_assignment: null }));
      }
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "PENDING_TRIAGE", category: null, priority: "MEDIUM", version: 2, active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    fireEvent.change(await screen.findByLabelText(/confirmed category/i), { target: { value: "PLUMBING" } });
    await user.click(screen.getByRole("button", { name: /confirm triage/i }));

    await waitFor(() => expect(submittedBody?.category).toBe("PLUMBING"));
  });

  it("shows reporter-friendly request detail without manager workflow controls", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse({ id: "reporter-id", email: "reporter.demo@facilityops.local", role: "REPORTER", buildings: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "AWAITING_ASSIGNMENT", ai_triage_status: "PROCESSING", active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getAllByText("Technician being arranged").length).toBeGreaterThanOrEqual(1));
    const progress = screen.getByRole("list", { name: /request progress/i });
    expect(within(progress).getByText("Under review")).toBeInTheDocument();
    expect(within(progress).getByText("Technician being arranged")).toBeInTheDocument();
    expect(screen.getByText(/facility team has reviewed your request and is arranging a technician/i)).toBeInTheDocument();
    expect(screen.queryByText("AI assessment")).not.toBeInTheDocument();
    expect(screen.queryByText("Human-confirmed decision")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm triage/i })).not.toBeInTheDocument();
  });

  it("shows AI timeout history alongside completed manual triage", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "AWAITING_ASSIGNMENT", ai_triage_status: "TIMEOUT", active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByText(/AI triage did not produce a usable recommendation/i)).toBeInTheDocument());
    expect(screen.getByText("Confirmed triage")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm triage/i })).not.toBeInTheDocument();
  });

  it("does not say manual review is missing after manager-confirmed triage", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "AWAITING_ASSIGNMENT", ai_triage_status: "PROCESSING", active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByText(/Manual review completed/i)).toBeInTheDocument());
    expect(screen.getByText(/facility manager has confirmed the operational triage/i)).toBeInTheDocument();
    expect(screen.queryByText(/manual review has not been completed yet/i)).not.toBeInTheDocument();
  });

  it("shows a precise empty AI state when processing completed without a persisted recommendation", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "AWAITING_ASSIGNMENT", ai_triage_status: "PROCESSED", latest_triage_result: null, active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByText("No persisted AI recommendation")).toBeInTheDocument());
    expect(screen.getByText(/processed, but the backend did not persist a validated recommendation/i)).toBeInTheDocument();
  });

  it("renders persisted validated AI recommendations when present", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) {
        return jsonResponse(incident({
          status: "PENDING_TRIAGE",
          ai_triage_status: "SUCCEEDED",
          latest_triage_result: {
            id: "40000000-0000-0000-0000-000000000001",
            status: "SUCCEEDED",
            model_version: "groq:openai/gpt-oss-20b",
            validated_result: {
              category: "HVAC",
              location: "East wing conference room",
              issue_summary: "Conference room is too warm with weak airflow.",
              symptoms: ["warm room", "weak airflow"],
              potential_hazards: [],
              suggested_priority: "MEDIUM",
              missing_information: [],
              needs_human_review: false,
              safety_notes: [],
            },
            created_at: "2026-09-17T10:02:00Z",
          },
          active_assignment: null,
        }));
      }
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByText("Recommended category")).toBeInTheDocument());
    const aiPanel = screen.getByText("AI assessment").closest("article");
    expect(aiPanel).not.toBeNull();
    expect(within(aiPanel as HTMLElement).getByText("HVAC")).toBeInTheDocument();
    expect(screen.getByText("Conference room is too warm with weak airflow.")).toBeInTheDocument();
    expect(screen.getByText("groq:openai/gpt-oss-20b")).toBeInTheDocument();
  });

  it("shows no eligible technician empty state and not-qualified technicians", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/technicians")) return jsonResponse({ items: [{ id: technicianId, user_id: technicianUserId, display_name: "technician.demo@facilityops.local", skills: ["HVAC"], status: "ACTIVE", available: true, active_assignment_id: null }] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "AWAITING_ASSIGNMENT", category: "ELECTRICAL", active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByText("No qualified technicians are currently available.")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Not qualified")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /assign technician/i })).not.toBeInTheDocument();
  });

  it("keeps plumbing technicians selectable when category casing differs", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/technicians")) {
        return jsonResponse({
          items: [{
            id: technicianId,
            user_id: technicianUserId,
            display_name: "technician@test.local",
            skills: ["ELECTRICAL", "HVAC", "PLUMBING"],
            status: "ACTIVE",
            available: true,
            active_assignment_id: null,
          }],
        });
      }
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "AWAITING_ASSIGNMENT", category: "Plumbing", active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    const select = await screen.findByLabelText(/available and qualified/i);
    expect(within(select).getByRole("option", { name: "technician@test.local" })).toBeInTheDocument();
    expect(screen.queryByText("Not qualified")).not.toBeInTheDocument();
    expect(hasRequiredSkill({ skills: ["ELECTRICAL", "HVAC", "PLUMBING"] }, "Plumbing")).toBe(true);
  });

  it("refetches and clears technician selection after an assignment conflict", async () => {
    const user = userEvent.setup();
    let technicianRequests = 0;
    window.localStorage.setItem("facilityops.selectedBuilding.manager-id", buildingId);
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/technicians")) {
        technicianRequests += 1;
        return jsonResponse({ items: [{ ...technicians().items[0], available: true, active_assignment_id: null }] });
      }
      if (url.includes(`/api/v1/incidents/${incidentId}/assign`) && init?.method === "POST") return jsonResponse({ detail: "Incident version conflict" }, 409);
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "AWAITING_ASSIGNMENT", active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    const select = await screen.findByLabelText(/available and qualified/i);
    fireEvent.change(select, { target: { value: technicianId } });
    await waitFor(() => expect(screen.getByRole("button", { name: /assign technician/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /assign technician/i }));

    await waitFor(() => expect(screen.getByText(/review the latest state and choose again/i)).toBeInTheDocument());
    await waitFor(() => expect(technicianRequests).toBeGreaterThan(1));
  });

  it("presents hazard review without clearing safety client-side", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) {
        return jsonResponse(incident({
          status: "MANUAL_REVIEW",
          complaint_description: "Water leakage near an electrical panel",
          active_assignment: null,
          latest_triage_result: {
            id: "40000000-0000-0000-0000-000000000001",
            status: "SUCCEEDED",
            model_version: "groq:openai/gpt-oss-20b",
            validated_result: {
              category: "ELECTRICAL",
              location: "Lobby",
              issue_summary: "Water is near electrical equipment.",
              symptoms: ["water leakage"],
              potential_hazards: ["water near electrical equipment"],
              suggested_priority: "CRITICAL",
              missing_information: [],
              needs_human_review: true,
              safety_notes: ["Escalate before assignment"],
            },
            created_at: "2026-09-17T10:02:00Z",
          },
        }));
      }
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByText(/Safety review required by backend-visible AI assessment signals/i)).toBeInTheDocument());
    expect(screen.getByText(/Leaving this unchecked does not establish that an incident is safe/i)).toBeInTheDocument();
  });

  it("renders a null active assignment empty state without fabricating history", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/technicians")) return jsonResponse({ items: [] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) return jsonResponse(incident({ status: "RESOLVED", version: 4, active_assignment: null }));
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getAllByText("No active assignment").length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText(/current API does not expose assignment history/i)).toBeInTheDocument();
  });

  it.each([
    ["PENDING_TRIAGE", /Waiting for AI assessment/i],
    ["MANUAL_REVIEW", /Manual review is required before dispatch/i],
    ["AWAITING_ASSIGNMENT", /Qualified candidates/i],
    ["ASSIGNED", /assigned technician controls start and resolve actions/i],
    ["IN_PROGRESS", /Work is in progress with the assigned technician/i],
    ["RESOLVED", /Close incident/i],
    ["CLOSED", /This incident is closed and read-only/i],
  ])("renders manager workflow state for %s", async (status, expected) => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes("/api/v1/auth/me")) return jsonResponse(mockSession("FACILITY_MANAGER"));
      if (url.includes("/api/v1/buildings")) return jsonResponse({ items: [{ id: buildingId, name: "Demo Tower" }] });
      if (url.includes("/api/v1/technicians")) return jsonResponse({ items: [{ ...technicians().items[0], available: true, active_assignment_id: null }] });
      if (url.includes(`/api/v1/incidents/${incidentId}`)) {
        return jsonResponse(incident({
          status,
          active_assignment: assignmentStatusesForTest.has(status) ? incident().active_assignment : null,
          version: status === "RESOLVED" || status === "CLOSED" ? 4 : 2,
        }));
      }
      return jsonResponse({ detail: "unexpected request" }, 500);
    });

    renderWithProviders(<IncidentDetailPage />, { initialEntries: [`/incidents/${incidentId}`], routePath: "/incidents/:incidentId" });

    await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
  });
});

const assignmentStatusesForTest = new Set(["ASSIGNED", "IN_PROGRESS"]);
