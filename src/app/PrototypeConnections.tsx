import { Anchor, Bell, ArrowRight, Zap } from "lucide-react";
import { Avatar, Badge } from "./ComponentLibrary";

type NavTab = "Operations" | "Claims" | "Analytics" | "Vessels";

interface Connection {
  from: string;
  trigger: string;
  to: string;
  toView: string;
  transition: "instant";
  category: "nav" | "action" | "modal" | "form";
}

const connections: Connection[] = [
  // ── Nav pills ──
  { from: "Top nav (all screens)", trigger: "'Operations' pill", to: "Ops dashboard", toView: "Operations", transition: "instant", category: "nav" },
  { from: "Top nav (all screens)", trigger: "'Claims' pill", to: "Claims list", toView: "Claims", transition: "instant", category: "nav" },
  { from: "Top nav (all screens)", trigger: "'Analytics' pill", to: "Commercial intelligence", toView: "Analytics", transition: "instant", category: "nav" },
  { from: "Top nav (all screens)", trigger: "'Library' pill (where present)", to: "Deal template library", toView: "DealTemplates", transition: "instant", category: "nav" },
  { from: "Top nav (all screens)", trigger: "WJ avatar circle", to: "Settings — profile", toView: "Settings", transition: "instant", category: "nav" },
  // ── Ops dashboard ──
  { from: "Ops dashboard", trigger: "Vessel table row click", to: "Shipment detail", toView: "ShipmentDetail", transition: "instant", category: "action" },
  { from: "Ops dashboard", trigger: "'+ New shipment' button", to: "Create shipment — step 1", toView: "CreateShipment", transition: "instant", category: "action" },
  { from: "Ops dashboard", trigger: "Alert card 'Maran Gas Apollonia'", to: "Shipment detail (Maran Gas)", toView: "ShipmentDetail", transition: "instant", category: "action" },
  // ── Create shipment ──
  { from: "Create shipment", trigger: "'Initialise shipment ↗' button", to: "Shipment detail", toView: "ShipmentDetail", transition: "instant", category: "form" },
  { from: "Create shipment", trigger: "'Save draft' / 'Cancel'", to: "Ops dashboard", toView: "Operations", transition: "instant", category: "form" },
  // ── Shipment detail ──
  { from: "Shipment detail", trigger: "'Open claim ↗' button (nav + sidebar)", to: "Generate claim", toView: "GenerateClaim", transition: "instant", category: "action" },
  { from: "Shipment detail", trigger: "'Full laytime calc ↗' button", to: "SOF laytime timeline", toView: "Claims", transition: "instant", category: "action" },
  { from: "Shipment detail", trigger: "'Upload SOF' button", to: "Upload SOF modal", toView: "Modals", transition: "instant", category: "modal" },
  { from: "Shipment detail", trigger: "'SOF timeline' tab click", to: "SOF laytime timeline", toView: "Claims", transition: "instant", category: "action" },
  // ── Cargo risk monitor ──
  { from: "Cargo risk monitor", trigger: "Vessel risk card click", to: "Shipment detail", toView: "ShipmentDetail", transition: "instant", category: "action" },
  { from: "Cargo risk monitor", trigger: "'Mitigate ↗' feed link", to: "Pre-ops risk engine", toView: "Vessels", transition: "instant", category: "action" },
  // ── Pre-ops risk engine ──
  { from: "Pre-ops risk engine", trigger: "'Proceed to ops ↗' button", to: "SOF laytime timeline", toView: "Claims", transition: "instant", category: "action" },
  { from: "Pre-ops risk engine", trigger: "'Back to shipment' button", to: "Shipment detail", toView: "ShipmentDetail", transition: "instant", category: "action" },
  // ── SOF timeline ──
  { from: "SOF timeline", trigger: "'Run claim calc ↗' button", to: "Claims audit console", toView: "ClaimsAudit", transition: "instant", category: "action" },
  { from: "SOF timeline", trigger: "'+ Add event' button", to: "Add SOF event modal", toView: "Modals", transition: "instant", category: "modal" },
  // ── Claims audit console ──
  { from: "Claims audit console", trigger: "'Generate dispute report ↗'", to: "Generate claim", toView: "GenerateClaim", transition: "instant", category: "action" },
  { from: "Claims audit console", trigger: "'Accept claim' button", to: "Accept claim modal", toView: "Modals", transition: "instant", category: "modal" },
  { from: "Claims audit console", trigger: "'Save for review' button", to: "Claims list", toView: "Claims", transition: "instant", category: "action" },
  // ── Generate claim ──
  { from: "Generate claim", trigger: "'Generate claim PDF ↗'", to: "Claims list", toView: "Claims", transition: "instant", category: "action" },
  { from: "Generate claim", trigger: "'Save for review' button", to: "Claims list", toView: "Claims", transition: "instant", category: "action" },
  // ── Claims list ──
  { from: "Claims list", trigger: "Table row click", to: "Claims audit console", toView: "ClaimsAudit", transition: "instant", category: "action" },
  { from: "Claims list", trigger: "Kanban card click", to: "Claims audit console", toView: "ClaimsAudit", transition: "instant", category: "action" },
  { from: "Claims list", trigger: "'+ New claim ↗' button", to: "Generate claim", toView: "GenerateClaim", transition: "instant", category: "action" },
  // ── Recommendations ──
  { from: "Recommendations engine", trigger: "'Add to claim workflow ↗'", to: "Generate claim", toView: "GenerateClaim", transition: "instant", category: "action" },
  // ── Commercial intelligence ──
  { from: "Commercial intelligence", trigger: "'Terminal analytics ↗'", to: "Terminal analytics", toView: "TerminalAnalytics", transition: "instant", category: "action" },
  // ── Terminal analytics ──
  { from: "Terminal analytics", trigger: "'Deal templates ↗'", to: "Deal template library", toView: "DealTemplates", transition: "instant", category: "action" },
  // ── Deal template library ──
  { from: "Deal template library", trigger: "'Use template ↗' (card + detail panel)", to: "Create shipment (step 2, pre-filled)", toView: "CreateShipment", transition: "instant", category: "action" },
  // ── Entity directory ──
  { from: "Entity directory", trigger: "'View profile ↗' button", to: "Entity directory (detail expanded)", toView: "EntityDirectory", transition: "instant", category: "action" },
  // ── Settings ──
  { from: "Settings", trigger: "Sidebar nav item click", to: "Settings (same frame, section swap)", toView: "Settings", transition: "instant", category: "action" },
];

const CATEGORY_STYLE: Record<Connection["category"], { bg: string; text: string; label: string }> = {
  nav:    { bg: "#EFF6FF", text: "#1E40AF", label: "Nav" },
  action: { bg: "#F0FFF4", text: "#22543D", label: "Action" },
  modal:  { bg: "#FEF3C7", text: "#92400E", label: "Modal" },
  form:   { bg: "#EDE9FE", text: "#5B21B6", label: "Form" },
};

const grouped = connections.reduce((acc, c) => {
  if (!acc[c.from]) acc[c.from] = [];
  acc[c.from].push(c);
  return acc;
}, {} as Record<string, Connection[]>);

export default function PrototypeConnections({
  onNav,
  onRoute,
}: {
  onNav: (tab: NavTab) => void;
  onRoute: (view: string) => void;
}) {
  const navTabs: NavTab[] = ["Operations", "Claims", "Analytics", "Vessels"];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-secondary)", fontFamily: "'Inter', sans-serif" }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 flex-shrink-0"
        style={{ height: "56px", backgroundColor: "var(--bg-primary)", borderBottom: "0.5px solid var(--border-default)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg"
            style={{ width: "30px", height: "30px", backgroundColor: "var(--accent-blue)" }}>
            <Anchor size={15} color="#ffffff" strokeWidth={2} />
          </div>
          <div className="flex flex-col leading-tight">
            <span style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)" }}>Demurrage Defender</span>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Prototype connections</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {navTabs.map((tab) => (
            <button key={tab} onClick={() => onNav(tab)}
              className="rounded-full px-4 py-1.5 transition-colors cursor-pointer"
              style={{ fontSize: "13px", backgroundColor: "transparent", color: "var(--text-secondary)", border: "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-secondary)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}>
              {tab}
            </button>
          ))}
          <button className="rounded-full px-4 py-1.5 cursor-pointer"
            style={{ fontSize: "13px", fontWeight: 500, backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)", border: "none" }}>
            Prototype
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 flex items-center justify-center rounded-md"
            style={{ color: "var(--text-secondary)", border: "none", backgroundColor: "transparent" }}>
            <Bell size={15} />
          </button>
          <Avatar initials="WJ" size="medium" colour="blue" />
        </div>
      </nav>

      {/* Page content */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px", width: "100%" }}>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <h1 style={{ fontSize: "22px", fontWeight: 500, color: "var(--text-primary)" }}>Prototype connections</h1>
            <Badge label={`${connections.length} connections`} colour="blue" dot />
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
            All transitions are <strong style={{ color: "var(--text-primary)" }}>instant</strong> — no animation.
            All triggers are <strong style={{ color: "var(--text-primary)" }}>on click</strong>. Click any "Open →" button to navigate to that screen directly.
          </p>

          {/* Category legend */}
          <div className="flex items-center gap-3 flex-wrap">
            {Object.entries(CATEGORY_STYLE).map(([key, c]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="rounded-full px-2 py-0.5"
                  style={{ fontSize: "10px", backgroundColor: c.bg, color: c.text, fontWeight: 500 }}>{c.label}</span>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                  {connections.filter((cn) => cn.category === key).length} connections
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Connection groups */}
        <div className="flex flex-col" style={{ gap: "24px" }}>
          {Object.entries(grouped).map(([fromScreen, conns]) => (
            <div key={fromScreen}>
              {/* Source screen header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-md px-2 py-0.5"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "0.5px solid var(--border-default)" }}>
                  <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-primary)" }}>{fromScreen}</span>
                </div>
                <div className="flex-1" style={{ borderBottom: "0.5px solid var(--border-default)" }} />
                <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{conns.length} connection{conns.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Connection rows */}
              <div className="rounded-xl border overflow-hidden"
                style={{ borderColor: "var(--border-default)", borderWidth: "0.5px", backgroundColor: "var(--bg-primary)" }}>
                {conns.map((c, i) => {
                  const cat = CATEGORY_STYLE[c.category];
                  return (
                    <div key={i}
                      className="flex items-center gap-4 px-4 py-3"
                      style={{ borderBottom: i < conns.length - 1 ? "0.5px solid var(--border-default)" : "none" }}>
                      {/* Category badge */}
                      <span className="rounded-full px-2 py-0.5 flex-shrink-0"
                        style={{ fontSize: "9px", fontWeight: 500, backgroundColor: cat.bg, color: cat.text, minWidth: "44px", textAlign: "center" }}>
                        {cat.label}
                      </span>
                      {/* Trigger */}
                      <div className="flex-1 min-w-0">
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{c.trigger}</span>
                      </div>
                      {/* Arrow */}
                      <ArrowRight size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                      {/* Destination */}
                      <div className="flex items-center gap-2 flex-shrink-0" style={{ minWidth: "200px" }}>
                        <Zap size={11} style={{ color: "var(--text-tertiary)" }} />
                        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>{c.to}</span>
                      </div>
                      {/* Navigate button */}
                      <button onClick={() => onRoute(c.toView)}
                        className="flex items-center gap-1 px-2.5 rounded-md border transition-colors cursor-pointer flex-shrink-0"
                        style={{ height: "26px", fontSize: "11px", color: "var(--accent-blue)", borderColor: "var(--border-default)", borderWidth: "0.5px", backgroundColor: "var(--bg-primary)" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-secondary)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-primary)")}>
                        Open <ArrowRight size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Spec notes */}
        <div className="mt-10 rounded-xl border p-[14px_18px]"
          style={{ borderColor: "var(--border-default)", borderWidth: "0.5px", backgroundColor: "var(--bg-primary)" }}>
          <p className="mb-3" style={{ fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Prototype spec
          </p>
          <div className="grid gap-0" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {[
              ["Transition type",       "Instant (no animation)"],
              ["Trigger",               "On click"],
              ["Overlay behaviour",     "Modal overlays darken bg (rgba 0,0,0,0.45)"],
              ["Back navigation",       "'Cancel' / 'Back' returns to prior screen"],
              ["Variable passing",      "Vessel name implicit via shared state"],
              ["Nav pill → screen",     "Instant swap, no transition"],
              ["Form submit → next",    "Immediate navigation on button click"],
              ["Modal close",           "Click outside overlay or × button"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between py-2"
                style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{k}</span>
                <span style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "var(--text-primary)", fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
