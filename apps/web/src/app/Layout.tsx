import { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { Anchor } from "lucide-react";

// ─── Primary nav config ─────────────────────────────────────────────────────
// Route (not label) drives active-state highlighting, so it stays correct
// even for sub-routes like /shipments/:id or /claims/audit.

const primaryNav: { label: string; to: string }[] = [
  { label: "Operations", to: "/" },
  { label: "Claims", to: "/claims" },
  { label: "Analytics", to: "/analytics" },
  { label: "Vessels", to: "/vessels" },
];

function pillStyle(isActive: boolean): React.CSSProperties {
  return {
    fontSize: "13px",
    fontWeight: isActive ? 500 : 400,
    backgroundColor: isActive ? "#F3F4F6" : "transparent",
    color: isActive ? "#111827" : "#6B7280",
    border: "none",
  };
}

export default function Layout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      {/* ── Top Navigation (persists across every screen) ── */}
      <nav
        className="flex items-center justify-between px-6"
        style={{ height: "56px", backgroundColor: "#ffffff", borderBottom: "0.5px solid #E5E7EB" }}
      >
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: "30px", height: "30px", backgroundColor: "#1A4ED8" }}
          >
            <Anchor size={15} color="#ffffff" strokeWidth={2} />
          </div>
          <div className="flex flex-col leading-tight">
            <span style={{ fontSize: "15px", fontWeight: 500, color: "#111827" }}>Demurrage Defender</span>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>Operations Command</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {primaryNav.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/"}
              className="rounded-full px-4 py-1.5 transition-colors cursor-pointer"
              style={({ isActive }) => pillStyle(isActive)}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div
            onClick={() => navigate("/settings")}
            className="ml-1 w-8 h-8 rounded-full flex items-center justify-center text-white cursor-pointer"
            style={{ backgroundColor: "#1A4ED8", fontSize: "11px", fontWeight: 600, letterSpacing: "0.02em" }}
          >
            WJ
          </div>
        </div>
      </nav>

      {/* ── Routed screen renders here, inside the persistent shell ── */}
      <Outlet />
    </div>
  );
}

// ─── Page header ─────────────────────────────────────────────────────────────
// A second, contextual bar every screen renders under the global nav:
// breadcrumb on the left, page-specific actions on the right. Replaces the
// per-screen copy of the ENTIRE nav bar (logo, search, bell, avatar) that
// used to be duplicated in every file.

export interface Crumb {
  label: string;
  to?: string;
}

export function PageHeader({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div
      className="flex items-center justify-between px-6 flex-shrink-0"
      style={{ height: "48px", backgroundColor: "#ffffff", borderBottom: "0.5px solid #E5E7EB" }}
    >
      <div className="flex items-center gap-1" style={{ fontSize: "12px" }}>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span style={{ color: "#D1D5DB", margin: "0 3px" }}>/</span>}
            {c.to ? (
              <span
                style={{ color: "#6B7280", cursor: "pointer" }}
                onClick={() => navigate(c.to!)}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#374151")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#6B7280")}
              >
                {c.label}
              </span>
            ) : (
              <span style={{ color: "#111827", fontWeight: 500 }}>{c.label}</span>
            )}
          </span>
        ))}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
