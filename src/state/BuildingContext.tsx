import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { listBuildings } from "../api/client";
import type { BuildingListItem } from "../api/types";
import { useAuth } from "./AuthContext";

interface BuildingContextValue {
  buildings: BuildingListItem[];
  selectedBuildingId: string | null;
  selectedBuilding: BuildingListItem | null;
  setSelectedBuildingId: (buildingId: string | null) => void;
  isLoading: boolean;
}

const BuildingContext = createContext<BuildingContextValue | undefined>(undefined);

export function BuildingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBuildingId, setSelectedBuildingIdState] = useState<string | null>(null);
  const buildingsQuery = useQuery({
    queryKey: ["buildings", user?.id],
    queryFn: listBuildings,
    enabled: Boolean(user),
    retry: false,
  });

  const buildings = buildingsQuery.data?.items ?? user?.buildings ?? [];

  useEffect(() => {
    if (!user) {
      setSelectedBuildingIdState(null);
      return;
    }
    const storageKey = `facilityops.selectedBuilding.${user.id}`;
    const stored = window.localStorage.getItem(storageKey);
    if (buildings.length === 1) {
      setSelectedBuildingIdState(buildings[0].id);
      return;
    }
    if (stored && buildings.some((building) => building.id === stored)) {
      setSelectedBuildingIdState(stored);
      return;
    }
    setSelectedBuildingIdState(null);
  }, [buildings, user]);

  const setSelectedBuildingId = (buildingId: string | null) => {
    if (buildingId && !buildings.some((building) => building.id === buildingId)) return;
    setSelectedBuildingIdState(buildingId);
    if (user) {
      const storageKey = `facilityops.selectedBuilding.${user.id}`;
      if (buildingId) window.localStorage.setItem(storageKey, buildingId);
      else window.localStorage.removeItem(storageKey);
    }
    void queryClient.cancelQueries({ queryKey: ["incidents"] });
    void queryClient.cancelQueries({ queryKey: ["metrics"] });
    void queryClient.cancelQueries({ queryKey: ["technicians"] });
    void queryClient.invalidateQueries({ queryKey: ["incidents"] });
    void queryClient.invalidateQueries({ queryKey: ["metrics"] });
    void queryClient.invalidateQueries({ queryKey: ["technicians"] });
    void queryClient.invalidateQueries({ queryKey: ["complaints"] });
  };

  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? null;
  const value = useMemo(
    () => ({ buildings, selectedBuildingId, selectedBuilding, setSelectedBuildingId, isLoading: buildingsQuery.isLoading }),
    [buildings, selectedBuilding, selectedBuildingId, buildingsQuery.isLoading],
  );

  return <BuildingContext.Provider value={value}>{children}</BuildingContext.Provider>;
}

export function useBuildingSelection() {
  const context = useContext(BuildingContext);
  if (!context) throw new Error("useBuildingSelection must be used within BuildingProvider");
  return context;
}
