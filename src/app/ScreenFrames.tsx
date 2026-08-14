import { useState } from "react";
import { Anchor, Bell, ArrowRight, Layers, Monitor, Info, X, Code2 } from "lucide-react";
import { Avatar, Badge, RiskBadge } from "./ComponentLibrary";

type NavTab = "Operations" | "Claims" | "Analytics" | "Vessels";

// ─── Annotation data ──────────────────────────────────────────────────────────

interface Annotation {
  components: string[];
  tokens: string[];
  interactive: string[];
  conditionalLogic?: string[];
}

interface ScreenDef {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  annotations: Annotation;
}

const SECTIONS: { label: string; range: string; color: string; screens: ScreenDef[] }[] = [
  {
    label: "Operations core",
    range: "01–03",
    color: "#1A4ED8",
    screens: [
      {
        id: "01",
        title: "Ops dashboard",
        subtitle: "Main operations command centre",
        route: "Operations",
        annotations: {
          components: ["TopNavBar", "KPICard ×4", "DataTableRow ×5 (accent bar)", "RiskBadge", "FeedCard ×4", "LaytimeBar ×3", "LaytiemLegend"],
          tokens: ["bg/primary", "bg/secondary", "border/default 0.5px", "accent/blue (nav active)", "critical/text (exposure values)", "chart/blue|green|red|grey (laytime segments)"],
          interactive: ["Nav pills → screen route", "+ New shipment → CreateShipmentForm", "Table row → ShipmentDetail", "Analytics pill → CommercialIntelligence", "Vessels pill → PreOpsRiskEngine"],
          conditionalLogic: ["Exposure value: negative = green dispatch, zero = muted, positive = red demurrage", "Risk badge: 3 fixed variants from RiskLevel type"],
        },
      },
      {
        id: "02",
        title: "Create shipment",
        subtitle: "Multi-step shipment initialisation form",
        route: "CreateShipment",
        annotations: {
          components: ["TopNavBar (breadcrumb variant)", "StepIndicator (custom)", "FormField ×12", "ModeToggle ×3", "TagPill ×7", "KPICard (sidebar summary)", "AlertStrip (warning)", "Btn (primary + ghost)"],
          tokens: ["bg/primary cards", "accent/blue (active step, active mode border)", "#EFF6FF (active mode bg)", "critical/text (required asterisk)", "elevated/fill (warning strip)"],
          interactive: ["ModeToggle → switches deal framework mode", "TagPill → toggles deductible category active/default", "Cancel → back to ops dashboard", "Step indicator circles → visual only (no nav)"],
          conditionalLogic: ["Mode toggle: 3 states (spot/term/upload), only one active at once", "Deductible tags: multi-select allowed"],
        },
      },
      {
        id: "03",
        title: "Shipment detail",
        subtitle: "Per-vessel overview, clocks, timeline",
        route: "ShipmentDetail",
        annotations: {
          components: ["TopNavBar (breadcrumb)", "KPICard ×4", "SectionTabs (custom)", "ClockSubCard ×2", "TimelineEvent ×8", "PartyRow ×4", "AlertStrip", "Btn ×4"],
          tokens: ["chart/amber (81% supplier clock bar)", "chart/blue (71% receiver bar)", "bg/secondary (clock card bg)", "elevated/fill (amber badge)", "optimal/text (party Active badge)"],
          interactive: ["Section tabs → content switch (Overview default)", "ClockCard → static display, hover on row", "Timeline events → static, 4 dot states"],
          conditionalLogic: ["Clock progress bar: colour switches amber >75%, blue <75%", "Timeline dot: done=green, active=blue, warning=amber, pending=dashed-grey"],
        },
      },
    ],
  },
  {
    label: "Risk & ops",
    range: "04–06",
    color: "#D97706",
    screens: [
      {
        id: "04",
        title: "Cargo risk monitor",
        subtitle: "Live fleet risk grid with feed",
        route: "Analytics",
        annotations: {
          components: ["TopNavBar (pill nav, Analytics active)", "KPICard ×4", "VesselRiskCard ×6 (3 states)", "EtaProgressBar (4px)", "FeedCard ×4", "StatusBar"],
          tokens: ["critical/fill (breach card top border)", "elevated/fill (emerging)", "optimal/fill (safe)", "chart/red|amber|green (ETA bars)"],
          interactive: ["Corridor filter select → static demo", "Risk card click → navigates to shipment", "Feed 'Mitigate ↗' → static"],
          conditionalLogic: ["VesselCard top border: 2px, colour = tier", "ETA bar pct: reactive to vessel.etaPct", "Status bar: always visible, pinned bottom"],
        },
      },
      {
        id: "05",
        title: "Pre-ops risk engine",
        subtitle: "ETA scenarios, flags, exposure forecast",
        route: "Vessels",
        annotations: {
          components: ["TopNavBar (breadcrumb)", "ScenarioCard ×3", "LaycanBar ×2 (custom SVG segments)", "FlagRow ×4 (danger/warn/info/success)", "ExposureCard ×4", "RecItem ×3", "Btn ×3"],
          tokens: ["#EFF6FF + accent/blue border (active scenario)", "critical/fill|elevated/fill|optimal/fill (flag row bgs)", "chart/blue (laycan inside window)", "chart/red (outside laycan)"],
          interactive: ["ScenarioCard → click to activate, blue border + #EFF6FF bg", "Laycan bars → ETA marker at fixed position", "Action buttons → navigation"],
          conditionalLogic: ["ScenarioCard: only one active, controlled by useState(likely)", "ExposureCard 'Most likely': highlighted border #1A4ED8"],
        },
      },
      {
        id: "06",
        title: "SOF timeline",
        subtitle: "Statement of facts event log & laytime calc",
        route: "Claims",
        annotations: {
          components: ["TopNavBar (breadcrumb)", "KPICard ×5", "SOFFileRow", "LaytimeBar (10px)", "DataTableRow ×10 (3 states)", "CausePill (active/inactive)", "AnnotationFlag ×2", "Btn ×3"],
          tokens: ["#FFFBEB (deductible row bg)", "#F9FAFB (pending row bg)", "chart/blue (counting bar)", "chart/grey (deductible segments)", "elevated/fill (warning strip)"],
          interactive: ["Table row hover → #F9FAFB", "Edit icon → action per row", "Cause pill → active/inactive toggle", "'Add manual event' → dashed ghost button"],
          conditionalLogic: ["Row state: normal=white, deductible=amber tint, pending=surface", "Pending row number: dashed circle vs filled", "Deductible tag: grey fill vs blue counting"],
        },
      },
    ],
  },
  {
    label: "Claims",
    range: "07–09",
    color: "#7C3AED",
    screens: [
      {
        id: "07",
        title: "Claims audit console",
        subtitle: "Side-by-side counterparty vs AI reconstruction",
        route: "ClaimsAudit",
        annotations: {
          components: ["TopNavBar (breadcrumb)", "VarianceCard ×3 (tinted)", "EventRow ×4 left+right (normal/disputed/adjusted)", "DiscrepancyCard ×3", "EvidencePill ×5", "FooterActionBar"],
          tokens: ["#FEF2F2 + #FECACA border (their claim)", "#EFF6FF + #BFDBFE border (our calc)", "#FFFBEB + #FDE68A border (variance)", "critical/fill (disputed event row)", "optimal/fill (adjusted event row)"],
          interactive: ["Footer: Save for review / Draft email / Escalate / Generate report / Accept", "Evidence pills → hover #DBEAFE"],
          conditionalLogic: ["EventRow state: disputed=#FEF2F2 bg, adjusted=#EFF6FF", "Row number badge: disputed=red circle, adjusted=blue circle"],
        },
      },
      {
        id: "08",
        title: "Generate claim",
        subtitle: "Strategy selection, calc breakdown, PDF generation",
        route: "GenerateClaim",
        annotations: {
          components: ["TopNavBar (breadcrumb)", "StrategyTabBtn ×4", "StrategyCard ×2 (recommended/alternative)", "CalcTableRow ×6", "SOFEventRow ×4", "ClauseItem ×3", "SettlementBar (2-segment)", "Btn ×3"],
          tokens: ["accent/blue (primary strategy active)", "#B45309 (firm strategy)", "#276749 (soft strategy)", "#FFF7ED (overtime row bg)", "#F9FAFB (total row bg)"],
          interactive: ["StrategyTabBtn → click to activate, colour changes per tab", "CalcRow 'Pro-rata': 16px/500 red value", "API key reveal → toggles mask"],
          conditionalLogic: ["Strategy tab: each type has unique active bg/border/text colour", "Confidence bar: 94% fill width from static data", "Settlement bar: 78% light + 22% dark blue"],
        },
      },
      {
        id: "09",
        title: "Claims list",
        subtitle: "Pipeline Kanban + detail table",
        route: "Claims",
        annotations: {
          components: ["TopNavBar (breadcrumb)", "KPICard ×4", "PipelineCard ×8 (4 col Kanban)", "StatusBadge ×6", "DataTableRow ×6", "FilterSelect ×2", "Btn"],
          tokens: ["bg/primary pipeline cards", "#93C5FD hover border", "critical/text (red values)", "elevated/text (amber)", "optimal/text (green settled)"],
          interactive: ["PipelineCard click → ClaimsAuditConsole", "Table row click → ClaimsAuditConsole", "Kanban column scroll → overflow-y on column"],
          conditionalLogic: ["Settled cards: 80% opacity", "Settled table rows: 70% opacity", "Review/Dispute cards: show progress bar, Open/Settled: no bar"],
        },
      },
    ],
  },
  {
    label: "Intelligence",
    range: "10–12",
    color: "#059669",
    screens: [
      {
        id: "10",
        title: "Recommendations engine",
        subtitle: "AI-generated tactical & strategic advice",
        route: "Recommendations",
        annotations: {
          components: ["TopNavBar (breadcrumb)", "SectionTabs ×4", "RecItem ×4 (3 priority states)", "InsightCard ×2", "MiniBarChart (7 bars)", "EvidenceItem ×5", "BenchmarkRow ×2", "Btn ×3"],
          tokens: ["critical/border 3px left (high priority)", "elevated/border (medium)", "border/default (low)", "#EFF6FF + accent/blue border (active scenario)"],
          interactive: ["Section tabs → switch content (Tactical default)", "RecItem 'Apply to claim' → toggles to green 'Applied ✓'", "InsightCard action buttons → navigation"],
          conditionalLogic: ["RecItem: high=red border, med=amber, low=grey", "MiniBarChart: first 3 bars blue, last 4 red", "Apply button: toggles state via useState"],
        },
      },
      {
        id: "11",
        title: "Commercial intelligence",
        subtitle: "Supplier performance, delay distribution, costs",
        route: "Analytics",
        annotations: {
          components: ["TopNavBar (pill nav)", "KPICard ×4", "BarChart (Recharts grouped)", "DonutChart (custom SVG)", "BarChart (Recharts stacked)", "CostRankingRow ×5", "RiskSupplierCard ×3", "FeedItem ×4"],
          tokens: ["chart/blue (target bars)", "chart/blue solid (actual bars)", "chart/red (berth)", "chart/amber (weather)", "chart/grey (ops/other)"],
          interactive: ["Filter selects → static demo", "Terminal analytics ↗ → TerminalAnalytics", "Chart tooltips → Recharts built-in"],
          conditionalLogic: ["DonutChart: SVG arc path calculation from pct values", "Actual bars: Cell fill → blue if ≤100%, darker blue if >100%"],
        },
      },
      {
        id: "12",
        title: "Terminal analytics",
        subtitle: "Port congestion, turnaround trends, cost ranking",
        route: "TerminalAnalytics",
        annotations: {
          components: ["TopNavBar (pill nav)", "KPICard ×4", "TerminalCard ×4 (2×2 grid, 3 risk states)", "BarChart horizontal (Recharts)", "LineChart (3 series)", "RankingRow ×5", "BenchmarkBar ×4 (target line overlay)"],
          tokens: ["critical/fill 2px top border (Rotterdam)", "elevated/fill (Singapore, Fujairah)", "optimal/fill (Houston)", "chart/red|amber|grey|green (horizontal bars)"],
          interactive: ["Deal templates ↗ → DealTemplates", "TerminalCard → hover state", "Line chart tooltips → Recharts"],
          conditionalLogic: ["BenchmarkBar: 2px blue vertical mark at targetPct% — position as absolute overlay", "Rank 5 circle: green border vs grey bg for ranks 1–4"],
        },
      },
    ],
  },
  {
    label: "Library & config",
    range: "13–15",
    color: "#6B7280",
    screens: [
      {
        id: "13",
        title: "Deal template library",
        subtitle: "Template grid with detail panel",
        route: "DealTemplates",
        annotations: {
          components: ["TopNavBar ('Library' pill active)", "DropZone", "SideNavItem ×14", "TemplateCard ×4 (featured/draft/default)", "TagPill ×16", "ClauseRow ×9", "Btn"],
          tokens: ["bg/primary featured border accent/blue 1px", "#93C5FD hover border", "elevated/fill (draft badge)", "#EFF6FF (active template detail)"],
          interactive: ["Sidebar filter → sets activeFilter", "TemplateCard click → sets selectedCard (highlights blue border)", "DropZone drag → dragOver state changes bg+border", "Edit/Use template buttons → stop propagation"],
          conditionalLogic: ["Featured card: 1px accent/blue border always", "Draft card: 90% opacity, 'Publish' amber button instead of 'Use template'", "Selected card: blue border same as featured"],
        },
      },
      {
        id: "14",
        title: "Entity directory",
        subtitle: "3-col master-detail with risk profile",
        route: "EntityDirectory",
        annotations: {
          components: ["TopNavBar ('Library' active)", "SideNavItem ×13", "EntityRow ×8 (active/hover/default)", "Avatar ×8 (coloured variants)", "MiniKPIGrid", "CommercialProfileCard", "RiskProfileCard (bar)", "ActivityRow ×4"],
          tokens: ["bg/secondary (active entity row)", "border/emphasis (active row border)", "optimal/text (low risk)", "elevated/text (medium)", "critical/text (high)"],
          interactive: ["Sidebar filter → setActiveFilter", "EntityRow click → setSelectedEntity, updates right panel", "Edit button → static", "Risk bar: 62% amber fill from static data"],
          conditionalLogic: ["Right panel: all values update from selected entity (active entity drives metric, colour, avatar)"],
        },
      },
      {
        id: "15",
        title: "Settings",
        subtitle: "Profile, team, notifications, integrations, API",
        route: "Settings",
        annotations: {
          components: ["TopNavBar (no active pill)", "NavItem ×10 (2px left border active)", "FormField ×4", "TeamMemberRow ×4", "Toggle ×5", "IntegrationRow ×4", "APIKeyBlock", "Btn (danger Rotate)"],
          tokens: ["accent/blue 2px left border (active nav)", "bg/secondary (active + hover nav)", "critical/fill (Remove + Rotate danger buttons)", "optimal/fill (Connected badge)"],
          interactive: ["NavItem click → setActiveSection (visual only, all cards remain visible)", "Toggle click → flips on/off state via useState array", "Key Reveal → toggles masked/unmasked", "Drag-over DropZone → state change"],
          conditionalLogic: ["Toggle: ON=accent/blue bg, dot right; OFF=border/default bg, dot left", "Admin row: no Remove button (isAdmin flag)", "Integration: Connected→Configure ghost; Pending/Disconnected→Connect blue"],
        },
      },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnnotationPanel({ ann, onClose }: { ann: Annotation; onClose: () => void }) {
  const SECTION = ({ title, items, color }: { title: string; items: string[]; color: string }) => (
    <div className="mb-3">
      <p className="mb-1.5" style={{ fontSize: "10px", fontWeight: 500, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</p>
      <div className="flex flex-col" style={{ gap: "3px" }}>
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "1px", flexShrink: 0 }}>·</span>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.4 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed right-6 top-20 z-50 rounded-xl border overflow-y-auto"
      style={{ width: "320px", maxHeight: "calc(100vh - 120px)", backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)", borderWidth: "0.5px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
      <div className="flex items-center justify-between sticky top-0 p-[12px_14px]"
        style={{ borderBottom: "0.5px solid var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
        <div className="flex items-center gap-2">
          <Info size={13} style={{ color: "var(--accent-blue)" }} />
          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>Annotations</span>
        </div>
        <button onClick={onClose}
          className="flex items-center justify-center rounded cursor-pointer"
          style={{ width: "22px", height: "22px", border: "none", backgroundColor: "transparent", color: "var(--text-tertiary)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-tertiary)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}>
          <X size={12} />
        </button>
      </div>
      <div className="p-[12px_14px]">
        <SECTION title="Components in use" items={ann.components} color="var(--accent-blue)" />
        <SECTION title="Variable tokens" items={ann.tokens} color="var(--elevated-text)" />
        <SECTION title="Interactive targets" items={ann.interactive} color="var(--optimal-text)" />
        {ann.conditionalLogic && <SECTION title="Conditional logic" items={ann.conditionalLogic} color="var(--text-tertiary)" />}
      </div>
    </div>
  );
}

function ScreenCard({ screen, sectionColor, onNavigate, onAnnotate }: {
  screen: ScreenDef; sectionColor: string; onNavigate: () => void; onAnnotate: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div className="flex flex-col rounded-xl border overflow-hidden transition-all"
      style={{ borderColor: hov ? "#93C5FD" : "var(--border-default)", borderWidth: "0.5px", backgroundColor: "var(--bg-primary)" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>

      {/* Screen preview area */}
      <div className="relative flex flex-col items-center justify-center"
        style={{ height: "160px", backgroundColor: "var(--bg-secondary)", borderBottom: "0.5px solid var(--border-default)" }}>
        {/* Mini nav bar preview */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3"
          style={{ height: "28px", backgroundColor: "var(--bg-primary)", borderBottom: "0.5px solid var(--border-default)" }}>
          <div className="flex items-center gap-1.5">
            <div className="rounded flex-shrink-0" style={{ width: "14px", height: "14px", backgroundColor: sectionColor }} />
            <span style={{ fontSize: "8px", fontWeight: 500, color: "var(--text-primary)" }}>Demurrage Defender</span>
          </div>
          <div className="flex items-center gap-1">
            {["Ops", "Claims", "Anlys", "Vsls"].map((t) => (
              <span key={t} className="rounded-full" style={{ padding: "2px 5px", fontSize: "7px", color: "var(--text-tertiary)", backgroundColor: "transparent" }}>{t}</span>
            ))}
          </div>
          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: sectionColor, opacity: 0.8 }} />
        </div>

        {/* ID badge */}
        <div className="rounded-lg flex items-center justify-center mb-2"
          style={{ width: "40px", height: "40px", backgroundColor: "var(--bg-primary)", border: `1.5px solid ${sectionColor}` }}>
          <span style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: sectionColor, fontWeight: 500 }}>
            S{screen.id}
          </span>
        </div>
        <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-secondary)", textAlign: "center" }}>{screen.title}</p>

        {/* Annotation count */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{ backgroundColor: "var(--bg-tertiary)" }}>
          <Layers size={9} style={{ color: "var(--text-tertiary)" }} />
          <span style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>
            {screen.annotations.components.length} components
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-[12px_14px]" style={{ gap: "10px" }}>
        <div>
          <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "2px" }}>{screen.title}</p>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{screen.subtitle}</p>
        </div>

        {/* Token chips */}
        <div className="flex flex-wrap" style={{ gap: "4px" }}>
          {screen.annotations.tokens.slice(0, 3).map((t, i) => (
            <span key={i} className="rounded-full px-1.5 py-0.5"
              style={{ fontSize: "9px", backgroundColor: "var(--bg-tertiary)", color: "var(--text-tertiary)", fontFamily: "JetBrains Mono, monospace" }}>
              {t.split(" ")[0]}
            </span>
          ))}
          {screen.annotations.tokens.length > 3 && (
            <span style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>+{screen.annotations.tokens.length - 3} more</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1" style={{ borderTop: "0.5px solid var(--border-default)" }}>
          <button onClick={onNavigate}
            className="flex-1 flex items-center justify-center gap-1 rounded-md transition-colors cursor-pointer"
            style={{ height: "28px", fontSize: "11px", fontWeight: 500, color: "#ffffff", backgroundColor: sectionColor, border: "none" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}>
            Open screen <ArrowRight size={11} />
          </button>
          <button onClick={onAnnotate}
            className="flex items-center justify-center rounded-md border transition-colors cursor-pointer"
            style={{ width: "28px", height: "28px", border: "0.5px solid var(--border-default)", backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-secondary)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-primary)")}>
            <Info size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ScreenFrames({ onNav, onRoute }: {
  onNav: (tab: NavTab) => void;
  onRoute: (route: string) => void;
}) {
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const navTabs: NavTab[] = ["Operations", "Claims", "Analytics", "Vessels"];

  const totalScreens = SECTIONS.reduce((a, s) => a + s.screens.length, 0);
  const totalComponents = [...new Set(SECTIONS.flatMap((s) => s.screens.flatMap((sc) => sc.annotations.components)))].length;

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
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Screen frames</span>
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
            Screens
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

      {/* Page header */}
      <div className="flex-shrink-0" style={{ padding: "32px 24px 24px", borderBottom: "0.5px solid var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "6px" }}>Screen frames</h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
          15 screens across 5 sections — 1440×960px frames. Click any card to open the live screen, or the annotation icon to view component, token, and interaction details.
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-6">
          {[
            { icon: <Monitor size={14} />, label: `${totalScreens} screens`, color: "var(--accent-blue)" },
            { icon: <Layers size={14} />,  label: "5 sections",              color: "var(--optimal-text)" },
            { icon: <Code2 size={14} />,   label: "20 base components",      color: "var(--elevated-text)" },
          ].map(({ icon, label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span style={{ color }}>{icon}</span>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Section filter pills */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <button onClick={() => setActiveSection(null)}
            className="rounded-full px-3 py-1 transition-colors cursor-pointer"
            style={{ fontSize: "11px", backgroundColor: activeSection === null ? "var(--accent-blue)" : "var(--bg-tertiary)", color: activeSection === null ? "#ffffff" : "var(--text-secondary)", border: "none" }}>
            All sections
          </button>
          {SECTIONS.map((s) => (
            <button key={s.range} onClick={() => setActiveSection(activeSection === s.range ? null : s.range)}
              className="rounded-full px-3 py-1 transition-colors cursor-pointer"
              style={{ fontSize: "11px", backgroundColor: activeSection === s.range ? s.color : "var(--bg-tertiary)", color: activeSection === s.range ? "#ffffff" : "var(--text-secondary)", border: "none" }}>
              {s.range} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div style={{ padding: "24px", flex: 1 }}>
        {SECTIONS.filter((s) => !activeSection || activeSection === s.range).map((section) => (
          <div key={section.range} className="mb-10">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-md flex items-center justify-center"
                style={{ width: "28px", height: "28px", backgroundColor: section.color }}>
                <span style={{ fontSize: "10px", fontFamily: "JetBrains Mono, monospace", color: "#ffffff", fontWeight: 600 }}>{section.range}</span>
              </div>
              <div>
                <h2 style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>{section.label}</h2>
                <p style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{section.screens.length} screens</p>
              </div>
              <div className="flex-1" style={{ borderBottom: `1px solid ${section.color}22`, marginLeft: "8px" }} />
            </div>

            {/* Screen card grid */}
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {section.screens.map((screen) => (
                <ScreenCard
                  key={screen.id}
                  screen={screen}
                  sectionColor={section.color}
                  onNavigate={() => onRoute(screen.route)}
                  onAnnotate={() => setActiveAnnotation(
                    activeAnnotation === screen.annotations ? null : screen.annotations
                  )}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Frame spec reference */}
        <div className="rounded-xl border p-[14px_18px]"
          style={{ borderColor: "var(--border-default)", borderWidth: "0.5px", backgroundColor: "var(--bg-primary)" }}>
          <p className="mb-3" style={{ fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Frame specification (all screens)
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {[
              ["Frame size",          "1440 × 960px"],
              ["Top-level layout",    "Auto-layout vertical, gap 0"],
              ["Nav bar",             "56px height, fill width"],
              ["Page header",         "Auto-height, padding 14–16px 24px"],
              ["Body columns",        "Flex row, gap 14–16px, padding 16px 24px"],
              ["Right sidebar",       "200–240px fixed, flex-shrink 0"],
              ["Left column",         "flex: 1, min-width: 0"],
              ["Card radius",         "radius/lg (12px)"],
              ["Card border",         "0.5px border/default"],
              ["Card padding",        "14–18px inner"],
              ["Section eyebrow",     "Label/10/Uppercase + token text/secondary"],
              ["Annotation layer",    "Component names, token refs, interaction notes"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between py-1.5" style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{k}</span>
                <span style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "var(--text-primary)", fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Annotation panel */}
      {activeAnnotation && (
        <AnnotationPanel ann={activeAnnotation} onClose={() => setActiveAnnotation(null)} />
      )}
    </div>
  );
}
