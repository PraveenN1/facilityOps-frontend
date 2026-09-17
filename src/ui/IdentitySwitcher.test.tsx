import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { IdentitySwitcher } from "./IdentitySwitcher";
import { renderWithProviders } from "../test/test-utils";

describe("IdentitySwitcher", () => {
  it("applies documented local-demo identities", async () => {
    renderWithProviders(<IdentitySwitcher />);

    await userEvent.click(screen.getByRole("button", { name: /use demo reporter/i }));

    const stored = JSON.parse(window.localStorage.getItem("facilityops.demoIdentity") ?? "{}");
    expect(stored).toMatchObject({
      userId: "10000000-0000-0000-0000-000000000011",
      role: "reporter",
      buildingId: "10000000-0000-0000-0000-000000000001",
    });
  });
});
