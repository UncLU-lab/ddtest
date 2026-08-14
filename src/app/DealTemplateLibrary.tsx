import { useState, useRef } from "react";
import { Upload, Plus, Search, ChevronDown, FileText, Zap, Droplets, Flame } from "lucide-react";
import { PageHeader } from "./Layout";

// ─── Data ─────────────────────────────────────────────────────────────────────

const sidebarSections = [
  {
    label: "Template type",
    items: [
      { label: "All templates", count: 42, key: "all" },
      { label: "Supplier", count: 18, key: "supplier" },
      { label: "Receiver", count: 14, key: "receiver" },
      { label: "Charter party", count: 7, key: "charter" },
      { label: "Internal KPI", count: 3, key: "kpi" },
    ],
  },
  {
    label: "Product type",
    items: [
      { label: "Crude oil", count: 14, key: "crude" },
      { label: "LNG", count: 11, key: "lng" },
      { label: "LPG", count: 9, key: "lpg" },
      { label: "Fuel oil", count: 8, key: "fuel" },
    ],
  },
  {
    label: "Status",
    items: [
      { label: "Active", count: 36, key: "active" },
      { label: "Draft", count: 4, key: "draft" },
      { label: "Archived", count: 2, key: "archived" },
    ],
  },
];

const recentItems = ["Vitol Asia LNG", "Shell Intl. crude", "ADNOC LPG"];

const seedTemplates = [
  {
    key: "vitol",
    name: "Vitol Asia LNG standard",
    type: "Supplier template",
    iconBg: "#DBEAFE",
    iconColor: "#1A4ED8",
    icon: "LNG",
    status: "Active",
    statusBg: "#C6F6D5",
    statusText: "#22543D",
    featured: true,
    tags: ["LNG", "SHINC", "Supplier", "Asia-Pacific"],
    metrics: [
      { k: "Laytime", v: "72h" },
      { k: "Dem rate", v: "$25,000/day" },
      { k: "Dispatch", v: "$12,500/day" },
      { k: "Laycan window", v: "5 days" },
    ],
    usage: "Used 14 times · Last: Oct 2023",
    action: "Use template",
  },
  {
    key: "shell",
    name: "Shell Intl. crude standard",
    type: "Supplier template",
    iconBg: "#D1FAE5",
    iconColor: "#059669",
    icon: "CRD",
    status: "Active",
    statusBg: "#C6F6D5",
    statusText: "#22543D",
    featured: false,
    tags: ["Crude oil", "SHEX", "Supplier", "North Sea"],
    metrics: [
      { k: "Laytime", v: "48h" },
      { k: "Dem rate", v: "$32,000/day" },
      { k: "Dispatch", v: "$16,000/day" },
      { k: "Laycan window", v: "4 days" },
    ],
    usage: "Used 9 times · Last: Sep 2023",
    action: "Use template",
  },
  {
    key: "adnoc",
    name: "ADNOC LPG Gulf standard",
    type: "Supplier template",
    iconBg: "#FEF3C7",
    iconColor: "#D97706",
    icon: "LPG",
    status: "Draft",
    statusBg: "#FEEBC8",
    statusText: "#7B341E",
    featured: false,
    tags: ["LPG", "SHINC", "Supplier", "Arabian Gulf"],
    metrics: [
      { k: "Laytime", v: "60h" },
      { k: "Dem rate", v: "$28,000/day" },
      { k: "Dispatch", v: "$14,000/day" },
      { k: "Laycan window", v: "5 days" },
    ],
    usage: "Draft · not yet deployed",
    action: "Publish",
  },
  {
    key: "cheniere",
    name: "Cheniere LNG US Gulf",
    type: "Supplier template",
    iconBg: "#EDE9FE",
    iconColor: "#7C3AED",
    icon: "LNG",
    status: "Active",
    statusBg: "#C6F6D5",
    statusText: "#22543D",
    featured: false,
    tags: ["LNG", "WWD", "Supplier", "US Gulf"],
    metrics: [
      { k: "Laytime", v: "84h" },
      { k: "Dem rate", v: "$22,000/day" },
      { k: "Dispatch", v: "$11,000/day" },
      { k: "Laycan window", v: "6 days" },
    ],
    usage: "Used 6 times · Last: Oct 2023",
    action: "Use template",
  },
];

const detailClausesLeft = [
  { n: "01", key: "Time counting basis", value: "SHINC — Sundays and Holidays Included in Counting" },
  { n: "02", key: "Laytime allowed", value: "72 hours from NOR acceptance" },
  { n: "03", key: "NOR acceptance", value: "6 hours after tender at pilot station" },
  { n: "04", key: "Demurrage rate", value: "$25,000 per day, pro-rata" },
  { n: "05", key: "Dispatch rate", value: "$12,500 per day (half demurrage)" },
];

const detailClausesRight = [
  { n: "D1", key: "Weather / rain", value: "Deductible when rain gauge >2mm/hr — terminal certification required" },
  { n: "D2", key: "Berth congestion", value: "Deductible if berth occupied on arrival — port agent confirmation" },
  { n: "D3", key: "Terminal breakdown", value: "Deductible if terminal equipment failure — written log required" },
  { n: "D4", key: "Excluded delays", value: "Vessel breakdown, crew issues, and draft restrictions excluded from deductibles" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidebarItem({ label, count, active, onClick }: {
  label: string; count?: number; active: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick}
      className="w-full text-left flex items-center justify-between transition-colors cursor-pointer rounded-sm"
      style={{
        padding: "7px 14px",
        backgroundColor: active ? "#F3F4F6" : hovered ? "#F9FAFB" : "transparent",
        color: active ? "#1A4ED8" : "#374151",
        fontWeight: active ? 500 : 400,
        fontSize: "12px",
        border: "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <span>{label}</span>
      {count !== undefined && (
        <span className="rounded-full px-1.5 py-0.5"
          style={{
            fontSize: "10px",
            backgroundColor: active ? "#DBEAFE" : "#F3F4F6",
            color: active ? "#1E40AF" : "#9CA3AF",
          }}>
          {count}
        </span>
      )}
    </button>
  );
}

function StatusBadge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 font-medium flex-shrink-0"
      style={{ fontSize: "10px", backgroundColor: bg, color: text }}>{label}</span>
  );
}

function TagPill({ label }: { label: string }) {
  return (
    <span className="rounded-full px-2 py-0.5"
      style={{ fontSize: "10px", backgroundColor: "#F3F4F6", color: "#6B7280" }}>{label}</span>
  );
}

function TemplateCard({ t, onSelect, selected, onAction }: {
  t: typeof seedTemplates[0]; onSelect: () => void; selected: boolean; onAction: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isDraft = t.status === "Draft";
  return (
    <div onClick={onSelect}
      className="flex flex-col rounded-xl border cursor-pointer transition-all"
      style={{
        backgroundColor: "#ffffff",
        borderColor: selected || t.featured ? "#1A4ED8" : hovered ? "#93C5FD" : "#E5E7EB",
        borderWidth: t.featured ? "1px" : "0.5px",
        opacity: isDraft ? 0.9 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div className="flex flex-col gap-2.5 p-[13px_14px] flex-1">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ width: "32px", height: "32px", backgroundColor: t.iconBg }}>
              <span style={{ fontSize: "9px", fontWeight: 700, color: t.iconColor }}>{t.icon}</span>
            </div>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{t.name}</p>
              <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "1px" }}>{t.type}</p>
            </div>
          </div>
          <StatusBadge label={t.status} bg={t.statusBg} text={t.statusText} />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {t.tags.map((tag) => <TagPill key={tag} label={tag} />)}
        </div>

        {/* 2×2 metric grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {t.metrics.map(({ k, v }) => (
            <div key={k}>
              <p style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "1px" }}>{k}</p>
              <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-[14px] py-[10px]"
        style={{ borderTop: "0.5px solid #F3F4F6" }}>
        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{t.usage}</span>
        <div className="flex items-center gap-1.5">
          <button className="px-2.5 rounded-md border transition-colors cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            style={{ height: "26px", fontSize: "11px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
            Edit
          </button>
          <button className="px-2.5 rounded-md transition-colors cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onSelect(); onAction(); }}
            style={{
              height: "26px", fontSize: "11px", color: "#ffffff",
              backgroundColor: isDraft ? "#B45309" : "#1A4ED8", border: "none",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = isDraft ? "#92400e" : "#1e40af")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = isDraft ? "#B45309" : "#1A4ED8")}>
            {t.action}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClauseRow({ n, clauseKey, value, last }: { n: string; clauseKey: string; value: string; last?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: last ? "none" : "0.5px solid #F3F4F6" }}>
      <span className="flex-shrink-0 font-medium" style={{ fontSize: "10px", color: "#D1D5DB", width: "20px", paddingTop: "1px" }}>
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "1px" }}>{clauseKey}</p>
        <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>{value}</p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DealTemplateLibrary({ onEntities, onVault, onUseTemplate }: {
  onEntities?: () => void;
  onVault?: () => void;
  onUseTemplate?: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedCard, setSelectedCard] = useState("vitol");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("Most used");
  const [templates, setTemplates] = useState(seedTemplates);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = templates.find((t) => t.key === selectedCard) ?? templates[0];

  function duplicateTemplate() {
    const copyKey = `${selectedTemplate.key}-copy-${Date.now()}`;
    const copy = {
      ...selectedTemplate,
      key: copyKey,
      name: `${selectedTemplate.name} (copy)`,
      status: "Draft",
      statusBg: "#FEF3C7",
      statusText: "#92400E",
      featured: false,
      usage: "Used 0 times · Last: —",
    };
    setTemplates([copy, ...templates]);
    setSelectedCard(copyKey);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = `import-${Date.now()}`;
    setTemplates([
      {
        key, name: file.name.replace(/\.[^/.]+$/, ""), type: "Supplier template",
        iconBg: "#F3F4F6", iconColor: "#374151", icon: "DOC", status: "Draft",
        statusBg: "#FEF3C7", statusText: "#92400E", featured: false,
        tags: ["Imported"], metrics: [
          { k: "Laytime", v: "—" }, { k: "Dem rate", v: "—" }, { k: "Dispatch", v: "—" }, { k: "Laycan window", v: "—" },
        ],
        usage: "Used 0 times · Last: —", action: "Review template",
      },
      ...templates,
    ]);
    setSelectedCard(key);
    e.target.value = "";
  }

  const CATEGORY_TYPE: Record<string, string> = {
    supplier: "Supplier template",
    receiver: "Receiver template",
    charter: "Charter party template",
    kpi: "Internal KPI template",
  };
  const COMMODITY_TAG: Record<string, string> = {
    crude: "Crude oil",
    lng: "LNG",
    lpg: "LPG",
    fuel: "Fuel oil",
  };
  const STATUS_LABEL: Record<string, string> = {
    active: "Active",
    draft: "Draft",
    archived: "Archived",
  };

  function usageCount(usage: string): number {
    const match = usage.match(/Used (\d+)/);
    return match ? Number(match[1]) : 0;
  }

  const visibleTemplates = templates
    .filter((t) => {
      if (activeFilter === "all") return true;
      if (activeFilter in CATEGORY_TYPE) return t.type === CATEGORY_TYPE[activeFilter];
      if (activeFilter in COMMODITY_TAG) return t.tags.includes(COMMODITY_TAG[activeFilter]) || t.icon === COMMODITY_TAG[activeFilter];
      if (activeFilter in STATUS_LABEL) return t.status === STATUS_LABEL[activeFilter];
      return true;
    })
    .filter((t) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === "Alphabetical") return a.name.localeCompare(b.name);
      if (sortBy === "Most used") return usageCount(b.usage) - usageCount(a.usage);
      return 0; // "Recently updated" — no real date field in the mock data, keep source order
    });

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Analytics", to: "/analytics" }, { label: "Terminal analytics", to: "/analytics/terminal" }, { label: "Deal template library" }]} />

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-2.5">
          <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Deal template library</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
            style={{ backgroundColor: "#EFF6FF", color: "#1E40AF", fontSize: "11px" }}>
            <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "#1A4ED8" }} />
            42 templates
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleImportFile} accept=".pdf,.doc,.docx" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
            style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
            <Upload size={11} /> Import template
          </button>
          <button
            onClick={() => {
              const key = `new-${Date.now()}`;
              setTemplates([
                {
                  key, name: "Untitled template", type: "Supplier template",
                  iconBg: "#F3F4F6", iconColor: "#374151", icon: "NEW", status: "Draft",
                  statusBg: "#FEF3C7", statusText: "#92400E", featured: false,
                  tags: [], metrics: [
                    { k: "Laytime", v: "—" }, { k: "Dem rate", v: "—" }, { k: "Dispatch", v: "—" }, { k: "Laycan window", v: "—" },
                  ],
                  usage: "Used 0 times · Last: —", action: "Set up template",
                },
                ...templates,
              ]);
              setSelectedCard(key);
            }}
            className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
            style={{ height: "32px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
            <Plus size={11} /> New template
          </button>
        </div>
      </div>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Sidebar ── */}
        <div className="flex-shrink-0 flex flex-col" style={{ width: "180px", borderRight: "0.5px solid #E5E7EB", backgroundColor: "#ffffff", padding: "14px 0", overflowY: "auto" }}>
          {sidebarSections.map((section, si) => (
            <div key={section.label} style={{ marginBottom: si < sidebarSections.length - 1 ? "18px" : 0 }}>
              <p style={{ fontSize: "10px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 14px", marginBottom: "4px" }}>
                {section.label}
              </p>
              {section.items.map((item) => (
                <SidebarItem key={item.key} label={item.label} count={item.count}
                  active={activeFilter === item.key}
                  onClick={() => setActiveFilter(item.key)} />
              ))}
            </div>
          ))}

          {/* Divider */}
          <div style={{ borderTop: "0.5px solid #E5E7EB", margin: "14px 0" }} />

          {/* Recently used */}
          <div>
            <p style={{ fontSize: "10px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 14px", marginBottom: "4px" }}>
              Recently used
            </p>
            {recentItems.map((item) => (
              <button key={item}
                className="w-full text-left transition-colors cursor-pointer"
                style={{ padding: "7px 14px", fontSize: "12px", color: "#374151", backgroundColor: "transparent", border: "none" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}>
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "16px 20px" }}>

          {/* Content header */}
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Supplier templates — 18 templates
            </span>
            <div className="flex items-center gap-2">
              {/* Search input */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9CA3AF" }} />
                <input placeholder="Search templates…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="outline-none"
                  style={{
                    width: "200px", height: "30px",
                    border: "0.5px solid #E5E7EB", borderRadius: "8px",
                    padding: "0 10px 0 28px", fontSize: "12px", color: "#374151", backgroundColor: "#ffffff",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#1A4ED8")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")} />
              </div>
              {/* Sort select */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none outline-none cursor-pointer"
                  style={{ height: "30px", border: "0.5px solid #E5E7EB", borderRadius: "8px", padding: "0 24px 0 9px", fontSize: "12px", color: "#374151", backgroundColor: "#ffffff" }}>
                  <option>Most used</option>
                  <option>Recently updated</option>
                  <option>Alphabetical</option>
                </select>
                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9CA3AF" }} />
              </div>
            </div>
          </div>

          {/* Template grid */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {visibleTemplates.length === 0 && (
              <p style={{ fontSize: "12px", color: "#9CA3AF", gridColumn: "1 / -1" }}>No templates match "{searchQuery}".</p>
            )}
            {visibleTemplates.map((t) => (
              <TemplateCard key={t.key} t={t}
                selected={selectedCard === t.key}
                onSelect={() => setSelectedCard(t.key)}
                onAction={() => onUseTemplate?.()} />
            ))}
          </div>

          {/* Template detail panel */}
          <div className="rounded-xl p-[14px_16px]"
            style={{ backgroundColor: "#F9FAFB", border: "0.5px solid #E5E7EB" }}>
            {/* Panel header */}
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Template detail — {selectedTemplate.name}
              </span>
              <div className="flex items-center gap-2">
                <button className="px-3 rounded-md border transition-colors cursor-pointer"
                  onClick={duplicateTemplate}
                  style={{ height: "28px", fontSize: "11px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
                  Duplicate
                </button>
                <button className="flex items-center gap-1 px-3 rounded-md transition-colors cursor-pointer"
                  style={{ height: "28px", fontSize: "11px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}
                  onClick={(e) => { e.stopPropagation(); onUseTemplate?.(); }}>
                  Use template ↗
                </button>
              </div>
            </div>

            {/* Two-column clause grid */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Left — Laytime terms */}
              <div className="rounded-lg border bg-white p-[11px_13px]"
                style={{ borderColor: "#E5E7EB", borderWidth: "0.5px" }}>
                <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                  Laytime terms
                </p>
                {detailClausesLeft.map((c, i) => (
                  <ClauseRow key={c.n} n={c.n} clauseKey={c.key} value={c.value}
                    last={i === detailClausesLeft.length - 1} />
                ))}
              </div>

              {/* Right — Deductible categories */}
              <div className="rounded-lg border bg-white p-[11px_13px]"
                style={{ borderColor: "#E5E7EB", borderWidth: "0.5px" }}>
                <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                  Deductible delay categories
                </p>
                {detailClausesRight.map((c, i) => (
                  <ClauseRow key={c.n} n={c.n} clauseKey={c.key} value={c.value}
                    last={i === detailClausesRight.length - 1} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
