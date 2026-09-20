import { Building2, ClipboardList, LayoutDashboard, LogOut, Moon, Plus, Sun, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../state/AuthContext";
import { BuildingProvider, useBuildingSelection } from "../state/BuildingContext";
import { useTheme } from "../state/ThemeContext";

const navByRole: Record<string, { to: string; label: string; icon: LucideIcon }[]> = {
  FACILITY_MANAGER: [
    { to: "/", label: "Overview", icon: LayoutDashboard },
    { to: "/incidents", label: "Incident queue", icon: ClipboardList },
  ],
  TECHNICIAN: [{ to: "/", label: "My work", icon: Wrench }],
  REPORTER: [
    { to: "/", label: "My requests", icon: ClipboardList },
    { to: "/complaints/new", label: "New request", icon: Plus },
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
  const { theme, toggleTheme } = useTheme();
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
          <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
            {theme === "dark" ? <Sun aria-hidden size={16} /> : <Moon aria-hidden size={16} />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
          <div className="user-chip">
            <span>{auth.user?.display_name ?? auth.user?.email}</span>
            <strong>{auth.role?.replaceAll("_", " ")}</strong>
          </div>
          <button className="secondary-button icon-button" type="button" onClick={handleLogout}>
            <LogOut aria-hidden size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>
      <div className="workspace-grid">
        <aside className="side-rail">
          <nav aria-label="Workspace">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <Icon aria-hidden size={17} />
                {item.label}
              </NavLink>
              );
            })}
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
  if (buildings.length <= 1) return <span className="building-pill"><Building2 aria-hidden size={16} />{buildings[0]?.name ?? "No building"}</span>;
  return (
    <label className="building-select">
      <Building2 aria-hidden size={16} />
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
