import type { DemoIdentity } from "../state/IdentityContext";

export const demoBuildingId = "10000000-0000-0000-0000-000000000001";

export const demoIdentities = {
  reporter: {
    label: "Reporter",
    identity: {
      userId: "10000000-0000-0000-0000-000000000011",
      role: "reporter",
      buildingId: demoBuildingId,
    },
  },
  manager: {
    label: "Facility manager",
    identity: {
      userId: "10000000-0000-0000-0000-000000000010",
      role: "facility_manager",
      buildingId: demoBuildingId,
    },
  },
  technician: {
    label: "Technician",
    identity: {
      userId: "10000000-0000-0000-0000-000000000012",
      role: "technician",
      buildingId: demoBuildingId,
    },
  },
} as const satisfies Record<string, { label: string; identity: DemoIdentity }>;

export const demoIdentityOptions = Object.values(demoIdentities);
