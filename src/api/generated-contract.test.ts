import { describe, expect, it } from "vitest";

import type { components, paths } from "./generated";

describe("generated API contract", () => {
  it("includes backend Task 012A dashboard fields", () => {
    const technician: components["schemas"]["TechnicianListItem"] = {
      id: "technician-profile-id",
      user_id: "technician-user-id",
      display_name: "Taylor Reed",
      skills: ["ELECTRICAL"],
      status: "ACTIVE",
      available: true,
      active_assignment_id: null,
    };
    const incident: components["schemas"]["IncidentDetailResponse"] = {
      id: "incident-id",
      complaint_id: "complaint-id",
      public_ticket_id: "FO-2026-000315",
      building_id: "building-id",
      reporter_id: "reporter-id",
      reporter_display_name: "Riley Chen",
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
        assignment_id: "assignment-id",
        technician_id: technician.id,
        technician_display_name: technician.display_name,
        status: "ASSIGNED",
      },
    };

    expect(technician.user_id).toBe("technician-user-id");
    expect(incident.active_assignment?.technician_id).toBe("technician-profile-id");
    expect(incident.public_ticket_id).toBe("FO-2026-000315");
    expect(incident.reporter_display_name).toBe("Riley Chen");
  });

  it("includes Task 012P.5A building filters on manager listings", () => {
    const incidentQuery: NonNullable<paths["/api/v1/incidents"]["get"]["parameters"]["query"]> = {
      limit: 10,
      offset: 0,
      building_id: "building-id",
      status: "ASSIGNED",
    };
    const technicianQuery: NonNullable<paths["/api/v1/technicians"]["get"]["parameters"]["query"]> = {
      building_id: "building-id",
    };

    expect(incidentQuery.building_id).toBe("building-id");
    expect(technicianQuery.building_id).toBe("building-id");
    });

  it("accepts backend Task 014C terminal AI states", () => {
    const skipped: components["schemas"]["IncidentListItem"] = {
      id: "incident-id",
      complaint_id: "complaint-id",
      public_ticket_id: "FO-2026-000316",
      building_id: "building-id",
      complaint_description: "Warm conference room",
      category: "HVAC",
      priority: "MEDIUM",
      status: "AWAITING_ASSIGNMENT",
      created_at: "2026-09-17T10:00:00Z",
      ai_triage_status: "SKIPPED_OBSOLETE",
      latest_triage_result: null,
    };

    const noResult = { ...skipped, ai_triage_status: "PROCESSED_NO_RESULT" };

    expect(skipped.ai_triage_status).toBe("SKIPPED_OBSOLETE");
    expect(noResult.ai_triage_status).toBe("PROCESSED_NO_RESULT");
  });
});