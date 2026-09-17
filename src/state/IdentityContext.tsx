import { createContext, useContext, useMemo, useState } from "react";

export type DemoRole = "" | "facility_manager" | "technician" | "reporter";

export interface DemoIdentity {
  userId: string;
  role: DemoRole;
  buildingId: string;
}

interface IdentityContextValue {
  identity: DemoIdentity;
  setIdentity: (identity: DemoIdentity) => void;
  headers: Record<string, string>;
}

const storageKey = "facilityops.demoIdentity";

const defaultIdentity: DemoIdentity = {
  userId: "",
  role: "facility_manager",
  buildingId: "",
};

const IdentityContext = createContext<IdentityContextValue | undefined>(undefined);

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentityState] = useState<DemoIdentity>(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return defaultIdentity;
    try {
      return { ...defaultIdentity, ...JSON.parse(stored) } as DemoIdentity;
    } catch {
      return defaultIdentity;
    }
  });

  const setIdentity = (nextIdentity: DemoIdentity) => {
    setIdentityState(nextIdentity);
    window.localStorage.setItem(storageKey, JSON.stringify(nextIdentity));
  };

  const headers = useMemo(() => {
    const nextHeaders: Record<string, string> = {};
    if (identity.userId.trim()) nextHeaders["X-Dev-User-Id"] = identity.userId.trim();
    if (identity.role.trim()) nextHeaders["X-Dev-Role"] = identity.role.trim();
    if (identity.buildingId.trim()) nextHeaders["X-Dev-Building-Id"] = identity.buildingId.trim();
    return nextHeaders;
  }, [identity]);

  return (
    <IdentityContext.Provider value={{ identity, setIdentity, headers }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const context = useContext(IdentityContext);
  if (!context) {
    throw new Error("useIdentity must be used within IdentityProvider");
  }
  return context;
}
