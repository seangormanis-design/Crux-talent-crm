import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import GlobalSearch from "./GlobalSearch";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/companies", label: "Companies" },
  { to: "/people", label: "People" },
  { to: "/jobs", label: "Jobs" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/placements", label: "Placements" },
  { to: "/call-profile", label: "Call Profile" },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <span className="shrink-0 text-lg font-semibold">Crux Talent CRM</span>
          <nav className="flex shrink-0 gap-4 text-sm">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? "font-semibold text-slate-900" : "text-slate-500 hover:text-slate-900"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex-1">
            <GlobalSearch />
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm text-slate-500">
            <span>{user?.name}</span>
            <button onClick={() => logout()} className="rounded border px-2 py-1 hover:bg-slate-100">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
