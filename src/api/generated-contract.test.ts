import { describe, expect, it } from "vitest";

import type { components, paths } from "./generated";

describe("generated API contract", () => {
  it("includes backend Task 012A dashboard fields", () => {
    const technician: components["schemas"]["TechnicianListItem"] = {
      id: "technician-profile-id",
      user_id: "technician-user-id",
      display_name: "technician.demo@facilityops.local",
      skills: ["ELECTRICAL"],
      status: "ACTIVE",
      available: true,
      active_assignment_id: null,
    };
    const incident: components["schemas"]["IncidentDetailResponse"] = {
      id: "incident-id",
      complaint_id: "complaint-id",
      building_id: "building-id",
      reporter_id: "reporter-id",
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
});
