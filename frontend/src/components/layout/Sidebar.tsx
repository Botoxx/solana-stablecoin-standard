import { FC } from "react";
import { NavLink } from "react-router-dom";

const NAV_SECTIONS = [
  {
    label: "Overview",
    links: [
      { to: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1" },
      { to: "/create", label: "Create", icon: "M12 4v16m8-8H4" },
      { to: "/load", label: "Load", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
    ],
  },
  {
    label: "Manage",
    links: [
      { to: "/operations", label: "Operations", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
      { to: "/roles", label: "Roles", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
    ],
  },
  {
    label: "Compliance",
    links: [
      { to: "/compliance", label: "Compliance", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
    ],
  },
];

const NavIcon: FC<{ d: string }> = ({ d }) => (
  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

export const Sidebar: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <>
    {open && (
      <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
    )}
    <aside
      className={`fixed inset-y-0 left-0 z-30 w-56 transform border-r border-[var(--color-border)] bg-[var(--color-bg-base)] pt-14 transition-transform duration-200 lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <nav className="flex flex-col gap-5 px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="section-title mb-2 px-3">{section.label}</p>
            <div className="flex flex-col gap-0.5">
              {section.links.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                      isActive
                        ? "bg-[var(--color-accent)]/8 text-[var(--color-accent)] font-medium"
                        : "text-slate-400 hover:bg-[var(--color-bg-surface)] hover:text-slate-200"
                    }`
                  }
                >
                  <NavIcon d={icon} />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  </>
);
