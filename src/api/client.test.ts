import { beforeEach, describe, expect, it, vi } from "vitest";

import { createComplaint, listIncidents, login, storeCsrfToken } from "./client";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("uses cookie credentials without development identity headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0, limit: 10, offset: 0 }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await listIncidents({ limit: 10, offset: 0, status: "" });

    const init = fetchMock.mock.calls[0][1];
    const headers = init?.headers as Headers;
    expect(init?.credentials).toBe("include");
    expect(headers.get("X-Dev-User-Id")).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/incidents?limit=10&offset=0");
  });

  it("stores CSRF from login and sends it with idempotent complaint creation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/login")) return jsonResponse({ csrf_token: "csrf-login", user: { id: "user-id", email: "reporter@example.com", role: "REPORTER", buildings: [] } });
      return jsonResponse({ complaint_id: "00000000-0000-0000-0000-000000000001", incident_id: "00000000-0000-0000-0000-000000000002", status: "PENDING_TRIAGE" }, 202);
    });

    await login({ email: "reporter@example.com", password: "password123" });
    await createComplaint({ building_id: "00000000-0000-0000-0000-000000000003", description: "Power failure in lobby" }, "stable-key");

    const createInit = fetchMock.mock.calls[1][1];
    const headers = createInit?.headers as Headers;
    expect(createInit?.credentials).toBe("include");
    expect(headers.get("Idempotency-Key")).toBe("stable-key");
    expect(headers.get("X-CSRF-Token")).toBe("csrf-login");
  });

  it("can send a stored CSRF token for state-changing requests", async () => {
    storeCsrfToken("stored-csrf");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ complaint_id: "c", incident_id: "i", status: "PENDING_TRIAGE" }), { status: 202, headers: { "Content-Type": "application/json" } }));

    await createComplaint({ building_id: "building-id", description: "Leak" }, "retry-safe-key");

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("X-CSRF-Token")).toBe("stored-csrf");
  });
});
