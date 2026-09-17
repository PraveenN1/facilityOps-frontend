import { beforeEach, describe, expect, it, vi } from "vitest";

import { createComplaint, listIncidents } from "./client";

describe("API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends development identity headers on incident listing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0, limit: 10, offset: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await listIncidents(
      {
        "X-Dev-User-Id": "manager-id",
        "X-Dev-Role": "facility_manager",
        "X-Dev-Building-Id": "building-id",
      },
      { limit: 10, offset: 0, status: "" },
    );

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("X-Dev-User-Id")).toBe("manager-id");
    expect(headers.get("X-Dev-Role")).toBe("facility_manager");
    expect(headers.get("X-Dev-Building-Id")).toBe("building-id");
  });

  it("sends a stable idempotency key when creating a complaint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          complaint_id: "00000000-0000-0000-0000-000000000001",
          incident_id: "00000000-0000-0000-0000-000000000002",
          status: "PENDING_TRIAGE",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      ),
    );

    await createComplaint(
      { "X-Dev-User-Id": "reporter-id" },
      {
        building_id: "00000000-0000-0000-0000-000000000003",
        description: "Power failure in lobby",
      },
      "stable-key",
    );

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("Idempotency-Key")).toBe("stable-key");
  });
});
