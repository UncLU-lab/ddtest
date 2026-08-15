import { useState } from "react";
import { Download, Plus, Edit3, ArrowUpRight, Search } from "lucide-react";
import { PageHeader } from "./Layout";

// ─── Data ─────────────────────────────────────────────────────────────────────

const sidebarSections = [
  {
    label: "Entity type",
    items: [
      { key: "all",       label: "All entities",  count: 84 },
      { key: "suppliers", label: "Suppliers",      count: 22 },
      { key: "receivers", label: "Receivers",      count: 19 },
      { key: "terminals", label: "Terminals",      count: 18 },
      { key: "vessels",   label: "Vessels",        count: 16 },
      { key: "agents",    label: "Agents",         count: 9  },
    ],
  },
  {
    label: "Risk profile",
    items: [
      { key: "high",   label: "High",   count: 8  },
      { key: "medium", label: "Medium", count: 24 },
      { key: "low",    label: "Low",    count: 52 },
    ],
  },
  {
    label: "Region",
    items: [
      { key: "apac", label: "Asia Pacific",  count: 28 },
      { key: "eu",   label: "Europe",        count: 22 },
      { key: "me",   label: "Middle East",   count: 18 },
      { key: "am",   label: "Americas",      count: 16 },
    ],
  },
];

const seedEntities = [
  {
    key: "vitol",
    initials: "VA",
    avatarBg: "#DBEAFE",
    avatarText: "#1A4ED8",
    name: "Vitol Asia",
    type: "Supplier",
    metric: "$820k",
    metricColor: "#B45309",
    metricLabel: "exposure",
    riskLevel: "medium" as const,
  },
  {
    key: "global",
    initials: "GE",
    avatarBg: "#FED7D7",
    avatarText: "#9B2C2C",
    name: "Global Energy Co.",
    type: "Supplier",
    metric: "$1.24M",
    metricColor: "#C53030",
    metricLabel: "exposure",
    riskLevel: "high" as const,
  },
  {
    key: "petro",
    initials: "PC",
    avatarBg: "#D1FAE5",
    avatarText: "#065F46",
    name: "PetroChina Intl.",
    type: "Receiver",
    metric: "$214k",
    metricColor: "#374151",
    metricLabel: "exposure",
    riskLevel: "low" as const,
  },
  {
    key: "shell",
    initials: "SI",
    avatarBg: "#EDE9FE",
    avatarText: "#6D28D9",
    name: "Shell International",
    type: "Supplier",
    metric: "$380k",
    metricColor: "#B45309",
    metricLabel: "exposure",
    riskLevel: "medium" as const,
  },
  {
    key: "rotterdam",
    initials: "T4",
    avatarBg: "#FEE2E2",
    avatarText: "#991B1B",
    name: "Rotterdam T4",
    type: "Terminal",
    metric: "42h avg",
    metricColor: "#C53030",
    metricLabel: "turnaround",
    riskLevel: "high" as const,
  },
  {
    key: "uniper",
    initials: "UE",
    avatarBg: "#DBEAFE",
    avatarText: "#1E40AF",
    name: "Uniper SE",
    type: "Receiver",
    metric: "$142k",
    metricColor: "#374151",
    metricLabel: "exposure",
    riskLevel: "low" as const,
  },
  {
    key: "adnoc",
    initials: "AD",
    avatarBg: "#FEF3C7",
    avatarText: "#92400E",
    name: "ADNOC Trading",
    type: "Supplier",
    metric: "$290k",
    metricColor: "#B45309",
    metricLabel: "exposure",
    riskLevel: "medium" as const,
  },
  {
    key: "gac",
    initials: "GS",
    avatarBg: "#D1FAE5",
    avatarText: "#065F46",
    name: "GAC Singapore",
    type: "Agent",
    metric: "14 SOFs",
    metricColor: "#22543D",
    metricLabel: "processed",
    riskLevel: "low" as const,
  },
];

const RISK_BADGE = {
  high:   { bg: "#FED7D7", text: "#9B2C2C", label: "High" },
  medium: { bg: "#FEEBC8", text: "#7B341E", label: "Med"  },
  low:    { bg: "#C6F6D5", text: "#22543D", label: "Low"  },
};

const recentActivity = [
  { dot: "#EF4444", desc: "CLM-9942 · BW Magnolia · Claim submitted", value: "$142,500", valueColor: "#C53030" },
  { dot: "#9CA3AF", desc: "VOY-2309 · Valencia Knutsen · Voyage complete", value: "Settled", valueColor: "#9CA3AF" },
  { dot: "#10B981", desc: "VOY-2301 · Gaslog Geneva · Dispatch earned", value: "$0 dispatch", valueColor: "#22543D" },
  { dot: "#EF4444", desc: "CLM-9880 · MT Caspian Relayer · Dispute open", value: "$86,000", valueColor: "#C53030" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidebarItem({ label, count, active, onClick }: {
  label: string; count?: number; active: boolean; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      className="w-full text-left flex items-center justify-between transition-colors cursor-pointer"
      style={{
        padding: "6px 14px",
        backgroundColor: active ? "#F3F4F6" : hov ? "#F9FAFB" : "transparent",
        color: active ? "#1A4ED8" : "#374151",
        fontWeight: active ? 500 : 400,
        fontSize: "12px", border: "none",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      <span>{label}</span>
      {count !== undefined && (
        <span className="rounded-full px-1.5 py-0.5"
          style={{ fontSize: "10px", backgroundColor: active ? "#DBEAFE" : "#F3F4F6", color: active ? "#1E40AF" : "#9CA3AF" }}>
          {count}
        </span>
      )}
    </button>
  );
}

function Avatar({ initials, bg, text, size = 34 }: { initials: string; bg: string; text: string; size?: number }) {
  return (
    <div className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: bg }}>
      <span style={{ fontSize: size > 36 ? "14px" : "11px", fontWeight: 600, color: text }}>{initials}</span>
    </div>
  );
}

function EntityRow({ entity, active, onClick }: { entity: typeof seedEntities[0]; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const badge = RISK_BADGE[entity.riskLevel];
  return (
    <div onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg cursor-pointer transition-colors mb-1"
      style={{
        padding: "9px 10px",
        backgroundColor: active ? "#F3F4F6" : hov ? "#F9FAFB" : "transparent",
        border: active ? "0.5px solid #E5E7EB" : "0.5px solid transparent",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      <Avatar initials={entity.initials} bg={entity.avatarBg} text={entity.avatarText} />
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{entity.name}</p>
        <p style={{ fontSize: "10px", color: "#9CA3AF" }}>{entity.type}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span style={{ fontSize: "12px", fontWeight: 500, color: entity.metricColor }}>{entity.metric}</span>
        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{entity.metricLabel}</span>
      </div>
      <span className="rounded-full px-1.5 py-0.5 font-semibold flex-shrink-0"
        style={{ fontSize: "10px", backgroundColor: badge.bg, color: badge.text }}>{badge.label}</span>
    </div>
  );
}

function KVRow({ label, value, valueColor, linked, noBorder }: {
  label: string; value: string; valueColor?: string; linked?: boolean; noBorder?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-1.5"
      style={{ borderBottom: noBorder ? "none" : "0.5px solid #F3F4F6" }}>
      <span style={{ fontSize: "12px", color: "#6B7280" }}>{label}</span>
      <span style={{ fontSize: "12px", color: linked ? "#1A4ED8" : valueColor ?? "#111827", fontWeight: 500, textAlign: "right", maxWidth: "140px" }}>
        {value}
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function EntityDirectory() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedEntity, setSelectedEntity] = useState("vitol");
  const [searchQuery, setSearchQuery] = useState("");
  const [entities, setEntities] = useState(seedEntities);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMetric, setEditMetric] = useState("");

  const active = entities.find((e) => e.key === selectedEntity)!;
  const badge = RISK_BADGE[active.riskLevel];

  function startEdit() {
    setEditName(active.name);
    setEditMetric(active.metric);
    setIsEditing(true);
  }
  function saveEdit() {
    setEntities(entities.map((e) => (e.key === active.key ? { ...e, name: editName, metric: editMetric } : e)));
    setIsEditing(false);
  }

  function exportCsv() {
    const header = ["Name", "Type", "Risk level", "Metric"];
    const rows = visibleEntities.map((e) => [e.name, e.type, e.riskLevel, e.metric]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "entity-directory.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const TYPE_LABEL: Record<string, string> = {
    suppliers: "Supplier",
    receivers: "Receiver",
    terminals: "Terminal",
    vessels: "Vessel",
    agents: "Agent",
  };
  const RISK_KEY: Record<string, string> = { high: "high", medium: "medium", low: "low" };

  const visibleEntities = entities
    .filter((e) => {
      if (activeFilter === "all") return true;
      if (activeFilter in TYPE_LABEL) return e.type === TYPE_LABEL[activeFilter];
      if (activeFilter in RISK_KEY) return e.riskLevel === RISK_KEY[activeFilter];
      return true; // region filters (apac/eu/me/am) — no region field in the current data model yet
    })
    .filter((e) => !searchQuery.trim() || e.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  return (
    <div style={{ backgroundColor: "#ffffff", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Analytics", to: "/analytics" }, { label: "Entity directory" }]} />

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-2.5">
          <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Entity directory</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
            style={{ backgroundColor: "#EFF6FF", color: "#1E40AF", fontSize: "11px" }}>
            <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "#1A4ED8" }} />
            84 entities
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
            style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
            <Download size={11} /> Export
          </button>
          <button className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
            style={{ height: "32px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
            <Plus size={11} /> Add entity
          </button>
        </div>
      </div>

      {/* ── 3-col body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ── */}
        <div className="flex-shrink-0 overflow-y-auto"
          style={{ width: "180px", borderRight: "0.5px solid #E5E7EB", padding: "14px 0" }}>
          {sidebarSections.map((section, si) => (
            <div key={section.label} style={{ marginBottom: si < sidebarSections.length - 1 ? "14px" : 0 }}>
              <p style={{ fontSize: "10px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 14px", marginBottom: "4px" }}>
                {section.label}
              </p>
              {section.items.map((item) => (
                <SidebarItem key={item.key} label={item.label} count={item.count}
                  active={activeFilter === item.key} onClick={() => setActiveFilter(item.key)} />
              ))}
              {si < sidebarSections.length - 1 && (
                <div style={{ borderTop: "0.5px solid #E5E7EB", margin: "14px 0 0" }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Centre list ── */}
        <div className="flex-1 overflow-y-auto"
          style={{ borderRight: "0.5px solid #E5E7EB", padding: "14px 16px", minWidth: 0 }}>
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              All entities
            </span>
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "#9CA3AF" }} />
              <input placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="outline-none"
                style={{
                  width: "160px", height: "28px",
                  border: "0.5px solid #E5E7EB", borderRadius: "8px",
                  padding: "0 10px 0 26px", fontSize: "12px", color: "#374151", backgroundColor: "#ffffff",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#1A4ED8")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")} />
            </div>
          </div>

          {/* Entity rows */}
          {visibleEntities.length === 0 && (
            <p style={{ fontSize: "12px", color: "#9CA3AF", padding: "12px 0" }}>No entities match your filters.</p>
          )}
          {visibleEntities.map((entity) => (
            <EntityRow key={entity.key} entity={entity}
              active={selectedEntity === entity.key}
              onClick={() => setSelectedEntity(entity.key)} />
          ))}
        </div>

        {/* ── Right detail panel ── */}
        <div className="flex-shrink-0 overflow-y-auto"
          style={{ width: "240px", padding: "14px 16px", backgroundColor: "#ffffff" }}>

          {/* Top section */}
          <div className="pb-4 mb-4" style={{ borderBottom: "0.5px solid #E5E7EB" }}>
            <div className="flex items-start gap-3 mb-3">
              <Avatar initials={active.initials} bg={active.avatarBg} text={active.avatarText} size={44} />
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ fontSize: "14px", fontWeight: 500, color: "#111827", marginBottom: "3px", border: "0.5px solid #E5E7EB", borderRadius: "6px", padding: "2px 6px", width: "100%" }}
                  />
                ) : (
                  <p style={{ fontSize: "15px", fontWeight: 500, color: "#111827", marginBottom: "3px" }}>{active.name}</p>
                )}
                <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.5 }}>
                  {active.type}<br />
                  Asia-Pacific region<br />
                  Active since Jan 2021
                </p>
              </div>
            </div>
            {isEditing && (
              <label className="flex flex-col gap-1 mb-2.5" style={{ fontSize: "10px", color: "#9CA3AF" }}>
                Total exposure
                <input
                  value={editMetric}
                  onChange={(e) => setEditMetric(e.target.value)}
                  style={{ fontSize: "12px", color: "#111827", border: "0.5px solid #E5E7EB", borderRadius: "6px", padding: "4px 8px" }}
                />
              </label>
            )}
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)}
                    className="flex items-center gap-1 px-2.5 rounded-md border transition-colors cursor-pointer"
                    style={{ height: "28px", fontSize: "11px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
                    Cancel
                  </button>
                  <button onClick={saveEdit}
                    className="flex items-center gap-1 px-2.5 rounded-md transition-colors cursor-pointer"
                    style={{ height: "28px", fontSize: "11px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}>
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button onClick={startEdit}
                    className="flex items-center gap-1 px-2.5 rounded-md border transition-colors cursor-pointer"
                    style={{ height: "28px", fontSize: "11px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
                    <Edit3 size={10} /> Edit
                  </button>
                  <button className="flex items-center gap-1 px-2.5 rounded-md transition-colors cursor-pointer"
                    style={{ height: "28px", fontSize: "11px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
                    View profile <ArrowUpRight size={10} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 2×2 mini KPI grid */}
          <div className="grid grid-cols-2 gap-2 mb-3 rounded-lg p-[9px_11px]"
            style={{ backgroundColor: "#F9FAFB" }}>
            {[
              { label: "Total exposure", value: active.metric, vc: active.metricColor },
              { label: "Shipments",      value: "34",           vc: "#111827" },
              { label: "On-time rate",   value: "62%",          vc: "#B45309" },
              { label: "Avg late by",    value: "+18h",         vc: "#C53030" },
            ].map(({ label, value, vc }) => (
              <div key={label}>
                <p style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "1px" }}>{label}</p>
                <p style={{ fontSize: "13px", fontWeight: 500, color: vc }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Card 1 — Commercial profile */}
          <div className="rounded-xl border p-[11px_13px] mb-2.5"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Commercial profile
            </p>
            <KVRow label="Default template" value="Vitol Asia LNG standard" linked />
            <KVRow label="Time basis" value="6h SHINC" />
            <KVRow label="Dem. rate" value="$25,000/day" />
            <KVRow label="Dispatch rate" value="$12,500/day" />
            <KVRow label="Std. laycan window" value="5 days" />
            <KVRow label="NOR notice" value="6 hours" noBorder />
          </div>

          {/* Card 2 — Risk profile */}
          <div className="rounded-xl border p-[11px_13px] mb-2.5"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Risk profile
            </p>
            <KVRow label="Risk rating" value="Medium" valueColor="#B45309" />
            <KVRow label="Laycan breach rate" value="38%" valueColor="#C53030" />
            <KVRow label="Avg delay" value="+18h" valueColor="#C53030" />
            <KVRow label="Dispute rate" value="22%" valueColor="#B45309" noBorder />
            <div className="mt-2.5 pt-2.5" style={{ borderTop: "0.5px solid #F3F4F6" }}>
              <div className="rounded-full overflow-hidden mb-1" style={{ height: "5px", backgroundColor: "#F3F4F6" }}>
                <div className="h-full rounded-full" style={{ width: "62%", backgroundColor: "#F59E0B" }} />
              </div>
              <p style={{ fontSize: "10px", color: "#9CA3AF" }}>Risk score: 6.2 / 10</p>
            </div>
          </div>

          {/* Card 3 — Recent activity */}
          <div className="rounded-xl border p-[11px_13px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-1" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Recent activity
            </p>
            {recentActivity.map((row, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5"
                style={{ borderBottom: i < recentActivity.length - 1 ? "0.5px solid #F3F4F6" : "none" }}>
                <span className="rounded-full flex-shrink-0 mt-[3px]"
                  style={{ width: "6px", height: "6px", backgroundColor: row.dot }} />
                <span className="flex-1" style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>{row.desc}</span>
                <span className="flex-shrink-0" style={{ fontSize: "11px", fontWeight: 500, color: row.valueColor }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
