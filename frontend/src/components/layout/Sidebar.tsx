import { FC } from "react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/create", label: "Create" },
  { to: "/load", label: "Load" },
  { to: "/operations", label: "Operations" },
  { to: "/roles", label: "Roles" },
  { to: "/compliance", label: "Compliance" },
] as const;

export const Sidebar: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <>
    {open && (
      <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onClose} />
    )}
    <aside
      className={`fixed inset-y-0 left-0 z-30 w-56 transform border-r border-slate-800 bg-slate-900 pt-16 transition-transform lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <nav className="flex flex-col gap-1 p-3">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 font-medium"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  </>
);
