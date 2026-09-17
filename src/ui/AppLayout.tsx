import { NavLink, Outlet } from "react-router-dom";

import { IdentitySwitcher } from "./IdentitySwitcher";

const navItems = [
  { to: "/", label: "Incidents" },
  { to: "/complaints/new", label: "New complaint" },
];

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h1 className="text-xl font-semibold text-slate-950">FacilityOps AI</h1>
            <p className="text-sm text-slate-500">Operations dashboard for local backend validation</p>
          </div>
          <nav className="flex gap-2" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium ${
                    isActive ? "bg-cyan-700 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside>
          <IdentitySwitcher />
        </aside>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
