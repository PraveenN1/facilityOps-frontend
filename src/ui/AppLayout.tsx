import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../state/AuthContext";
import { BuildingProvider, useBuildingSelection } from "../state/BuildingContext";

const navByRole = {
  FACILITY_MANAGER: [
    { to: "/", label: "Overview" },
    { to: "/incidents", label: "Incident queue" },
  ],
  TECHNICIAN: [{ to: "/", label: "My work" }],
  REPORTER: [
    { to: "/", label: "My complaints" },
    { to: "/complaints/new", label: "New complaint" },
  ],
};

export function AppLayout() {
  return (
    <BuildingProvider>
      <AppChrome />
    </BuildingProvider>
  );
}

function AppChrome() {
  const auth = useAuth();
  const navigate = useNavigate();
  const building = useBuildingSelection();
  const role = auth.role ?? "REPORTER";
  const navItems = navByRole[role] ?? [];

  const handleLogout = async () => {
    await auth.logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">FacilityOps AI</p>
          <h1>Operations console</h1>
        </div>
        <div className="topbar-actions">
          <BuildingSelector />
          <div className="user-chip">
            <span>{auth.user?.email}</span>
            <strong>{auth.role?.replaceAll("_", " ")}</strong>
          </div>
          <button className="secondary-button" type="button" onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <div className="workspace-grid">
        <aside className="side-rail">
          <nav aria-label="Workspace">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="scope-box">
            <span>Building scope</span>
            <strong>{building.selectedBuilding?.name ?? "All authorized buildings"}</strong>
          </div>
        </aside>
        <main className="workspace-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function BuildingSelector() {
  const { buildings, selectedBuildingId, setSelectedBuildingId, isLoading } = useBuildingSelection();
  if (isLoading) return <span className="muted-copy">Loading buildings</span>;
  if (buildings.length <= 1) return <span className="building-pill">{buildings[0]?.name ?? "No building"}</span>;
  return (
    <label className="building-select">
      Building
      <select value={selectedBuildingId ?? ""} onChange={(event) => setSelectedBuildingId(event.target.value || null)}>
        <option value="">All authorized buildings</option>
        {buildings.map((building) => (
          <option key={building.id} value={building.id}>{building.name}</option>
        ))}
      </select>
    </label>
  );
}
