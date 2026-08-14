import { useState } from "react";
import {
  Upload, ArrowUpRight, Search, ChevronDown,
  FileText, Eye, X, AlertTriangle, ChevronLeft, ChevronRight,
} from "lucide-react";
import { PageHeader } from "./Layout";

type DocStatus = "extracted" | "extracting" | "failed" | "archived";

// ─── Data ─────────────────────────────────────────────────────────────────────

const sidebarSections = [
  {
    label: "Document type",
    items: [
      { key: "all",       label: "All",           count: 126 },
      { key: "sof",       label: "SOF",            count: 48  },
      { key: "cp",        label: "Charter party",  count: 22  },
      { key: "claim",     label: "Claim",          count: 18  },
      { key: "evidence",  label: "Evidence",       count: 14  },
      { key: "contracts", label: "Contracts",      count: 12  },
      { key: "other",     label: "Other",          count: 12  },
    ],
  },
  {
    label: "Vessel",
    items: [
      { key: "bw",     label: "BW Magnolia",    count: 14 },
      { key: "maran",  label: "Maran Gas",       count: 11 },
      { key: "gaslog", label: "Gaslog Geneva",   count: 9  },
      { key: "all_v",  label: "All vessels…",    count: undefined },
    ],
  },
  {
    label: "Status",
    items: [
      { key: "s_extracted", label: "Extracted", count: 94 },
      { key: "s_pending",   label: "Pending",   count: 18 },
      { key: "s_failed",    label: "Failed",    count: 6  },
      { key: "s_archived",  label: "Archived",  count: 8  },
    ],
  },
];

const docs: {
  key: string;
  iconBg: string;
  iconColor: string;
  name: string;
  type: string;
  typeBg: string;
  typeText: string;
  vessel: string;
  voyage: string;
  uploaded: string;
  status: DocStatus;
}[] = [
  { key: "d1", iconBg: "#DBEAFE", iconColor: "#1A4ED8", name: "SOF_BW-Magnolia_VOY2311_Singapore.pdf", type: "SOF", typeBg: "#EFF6FF", typeText: "#1E40AF", vessel: "BW Magnolia", voyage: "VOY-2311", uploaded: "22 Oct", status: "extracted" },
  { key: "d2", iconBg: "#D1FAE5", iconColor: "#065F46", name: "CharterParty_BW-Magnolia_Vitol-Asia.pdf", type: "Charter party", typeBg: "#F0FFF4", typeText: "#22543D", vessel: "BW Magnolia", voyage: "VOY-2311", uploaded: "18 Oct", status: "extracted" },
  { key: "d3", iconBg: "#DBEAFE", iconColor: "#1A4ED8", name: "SOF_Maran-Gas_VOY2310_Rotterdam.pdf", type: "SOF", typeBg: "#EFF6FF", typeText: "#1E40AF", vessel: "Maran Gas Apol.", voyage: "VOY-2310", uploaded: "25 Oct", status: "extracting" },
  { key: "d4", iconBg: "#FEF3C7", iconColor: "#92400E", name: "RainGaugeLog_Singapore_T3_Oct24.pdf", type: "Evidence", typeBg: "#FFFBEB", typeText: "#7B341E", vessel: "BW Magnolia", voyage: "VOY-2311", uploaded: "24 Oct", status: "extracted" },
  { key: "d5", iconBg: "#FEE2E2", iconColor: "#991B1B", name: "SOF_Gaslog-Geneva_VOY2308_Houston.pdf", type: "SOF", typeBg: "#EFF6FF", typeText: "#1E40AF", vessel: "Gaslog Geneva", voyage: "VOY-2308", uploaded: "29 Oct", status: "failed" },
  { key: "d6", iconBg: "#EDE9FE", iconColor: "#6D28D9", name: "ClaimSubmission_CLM-2311_OceanTraders.pdf", type: "Claim", typeBg: "#F5F3FF", typeText: "#6D28D9", vessel: "BW Magnolia", voyage: "VOY-2311", uploaded: "28 Oct", status: "extracted" },
  { key: "d7", iconBg: "#DBEAFE", iconColor: "#1A4ED8", name: "SOF_ValenciaKnutsen_VOY2309_Zhoushan.pdf", type: "SOF", typeBg: "#EFF6FF", typeText: "#1E40AF", vessel: "Valencia Knutsen", voyage: "VOY-2309", uploaded: "31 Oct", status: "extracting" },
  { key: "d8", iconBg: "#D1FAE5", iconColor: "#065F46", name: "NORAcceptanceLog_SingaporePort_Oct23.pdf", type: "Evidence", typeBg: "#FFFBEB", typeText: "#7B341E", vessel: "BW Magnolia", voyage: "VOY-2311", uploaded: "23 Oct", status: "archived" },
];

const extractedEvents = [
  { dot: "#3B82F6", time: "23 Oct 14:00", name: "Laytime commences" },
  { dot: "#F59E0B", time: "24 Oct 11:20", name: "Rain squall — deductible" },
  { dot: "#F59E0B", time: "25 Oct 03:40", name: "Terminal arm breakdown" },
  { dot: "#EF4444", time: "25 Oct 21:20", name: "Loading completed" },
];

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS = {
  extracted:  { bg: "#C6F6D5", text: "#22543D", label: "Extracted",   pulse: false },
  extracting: { bg: "#FEEBC8", text: "#7B341E", label: "Extracting…", pulse: true  },
  failed:     { bg: "#FED7D7", text: "#9B2C2C", label: "Failed",      pulse: false },
  archived:   { bg: "#F3F4F6", text: "#6B7280", label: "Archived",    pulse: false },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidebarItem({ label, count, active, onClick }: {
  label: string; count?: number; active: boolean; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      className="w-full text-left flex items-center justify-between transition-colors cursor-pointer"
      style={{ padding: "6px 14px", backgroundColor: active ? "#F3F4F6" : hov ? "#F9FAFB" : "transparent", color: active ? "#1A4ED8" : "#374151", fontWeight: active ? 500 : 400, fontSize: "12px", border: "none" }}
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

function StatusPill({ status }: { status: DocStatus }) {
  const c = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
      style={{ fontSize: "10px", backgroundColor: c.bg, color: c.text }}>
      {c.pulse && (
        <span className="rounded-full animate-pulse"
          style={{ width: "5px", height: "5px", backgroundColor: c.text, flexShrink: 0 }} />
      )}
      {c.label}
    </span>
  );
}

function DocRow({ doc, selected, onClick }: { doc: typeof docs[0]; selected: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const isFailed = doc.status === "failed";
  const isPending = doc.status === "extracting";
  const isArchived = doc.status === "archived";
  return (
    <tr onClick={onClick}
      className="cursor-pointer transition-colors"
      style={{ backgroundColor: selected ? "#EFF6FF" : hov ? "#F9FAFB" : "#ffffff", opacity: isArchived ? 0.65 : 1, borderBottom: "0.5px solid #F3F4F6" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      {/* File */}
      <td className="py-2.5 pl-4 pr-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: "32px", height: "32px", backgroundColor: isFailed ? "#FEE2E2" : doc.iconBg }}>
            <FileText size={14} color={isFailed ? "#991B1B" : doc.iconColor} />
          </div>
          <span className="truncate" style={{ fontSize: "12px", color: "#111827", fontWeight: 500, maxWidth: "220px", display: "block" }}>
            {doc.name}
          </span>
        </div>
      </td>
      {/* Type */}
      <td className="py-2.5 pr-3" style={{ width: "110px" }}>
        <span className="rounded-full px-2 py-0.5 font-medium"
          style={{ fontSize: "10px", backgroundColor: doc.typeBg, color: doc.typeText }}>{doc.type}</span>
      </td>
      {/* Vessel */}
      <td className="py-2.5 pr-3" style={{ width: "120px" }}>
        <span style={{ fontSize: "12px", color: "#374151" }}>{doc.vessel}</span>
      </td>
      {/* Voyage */}
      <td className="py-2.5 pr-3" style={{ width: "80px" }}>
        <span style={{ fontSize: "12px", color: "#6B7280" }}>{doc.voyage}</span>
      </td>
      {/* Uploaded */}
      <td className="py-2.5 pr-3" style={{ width: "70px" }}>
        <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{doc.uploaded}</span>
      </td>
      {/* Status */}
      <td className="py-2.5 pr-3" style={{ width: "100px" }}>
        <StatusPill status={doc.status} />
      </td>
      {/* Actions */}
      <td className="py-2.5 pr-4" style={{ width: "100px" }}>
        <div className="flex items-center gap-1.5">
          <button onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-2 rounded transition-colors cursor-pointer"
            style={{ height: "24px", fontSize: "11px", color: "#374151", border: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
            <Eye size={10} /> View
          </button>
          {(isFailed || isPending) && (
            <button onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 px-2 rounded transition-colors cursor-pointer"
              style={{ height: "24px", fontSize: "11px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
              Extract
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ doc, onClose }: { doc: typeof docs[0]; onClose: () => void }) {
  const isExtracted = doc.status === "extracted";
  return (
    <div className="flex flex-col h-full overflow-y-auto"
      style={{ borderLeft: "0.5px solid #E5E7EB", backgroundColor: "#ffffff", padding: "14px 16px" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{ fontSize: "13px", fontWeight: 500, color: "#111827", marginBottom: "4px" }}>
            {doc.name}
          </p>
          <span className="rounded-full px-2 py-0.5 font-medium"
            style={{ fontSize: "10px", backgroundColor: doc.typeBg, color: doc.typeText }}>{doc.type}</span>
        </div>
        <button onClick={onClose}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer"
          style={{ color: "#9CA3AF", border: "none", backgroundColor: "transparent" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F3F4F6")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}>
          <X size={13} />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2 mb-4">
        <button className="w-full flex items-center justify-center gap-1.5 rounded-lg transition-colors cursor-pointer"
          style={{ height: "34px", fontSize: "12px", fontWeight: 500, color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
          Open document <ArrowUpRight size={12} />
        </button>
        <button className="w-full flex items-center justify-center gap-1.5 rounded-lg border transition-colors cursor-pointer"
          style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
          Re-extract
        </button>
      </div>

      {/* Extraction summary */}
      {isExtracted && (
        <div className="rounded-lg mb-3 p-[10px_12px]" style={{ backgroundColor: "#F9FAFB" }}>
          <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Extraction summary
          </p>
          {[
            { k: "Vessel", v: doc.vessel },
            { k: "Voyage", v: doc.voyage },
            { k: "Pages", v: "4" },
            { k: "Events extracted", v: "10", vc: "#1A4ED8" },
          ].map(({ k, v, vc }) => (
            <div key={k} className="flex items-center justify-between py-1"
              style={{ borderBottom: "0.5px solid #E5E7EB" }}>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>{k}</span>
              <span style={{ fontSize: "12px", color: vc ?? "#111827", fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Event preview */}
      {isExtracted && (
        <div className="rounded-lg border p-[10px_12px] mb-3"
          style={{ borderColor: "#E5E7EB", borderWidth: "0.5px" }}>
          <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Extracted events
          </p>
          {extractedEvents.map((ev, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5"
              style={{ borderBottom: i < extractedEvents.length - 1 ? "0.5px solid #F3F4F6" : "none" }}>
              <span className="rounded-full flex-shrink-0"
                style={{ width: "6px", height: "6px", backgroundColor: ev.dot }} />
              <span style={{ fontSize: "10px", color: "#9CA3AF", flexShrink: 0, width: "68px" }}>{ev.time}</span>
              <span style={{ fontSize: "11px", color: "#374151" }}>{ev.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Metadata */}
      <div className="rounded-lg border p-[10px_12px] mb-3"
        style={{ borderColor: "#E5E7EB", borderWidth: "0.5px" }}>
        <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Metadata
        </p>
        {[
          { k: "Uploaded by", v: "W. Johnson" },
          { k: "Upload date", v: doc.uploaded + " 2023" },
          { k: "File size", v: "1.2 MB" },
          { k: "Checksum", v: "a4f8…d391" },
        ].map(({ k, v }, i, arr) => (
          <div key={k} className="flex items-center justify-between py-1"
            style={{ borderBottom: i < arr.length - 1 ? "0.5px solid #F3F4F6" : "none" }}>
            <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{k}</span>
            <span style={{ fontSize: "11px", color: "#374151", fontWeight: 400 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Flag card (only for extracted with issues, or failed) */}
      {(isExtracted || doc.status === "failed") && (
        <div className="rounded-lg p-[9px_11px] flex items-start gap-2"
          style={{ backgroundColor: "#FFFBEB", border: "0.5px solid #FDE68A" }}>
          <AlertTriangle size={12} style={{ color: "#B45309", flexShrink: 0, marginTop: "1px" }} />
          <div>
            <p style={{ fontSize: "11px", color: "#7B341E", fontWeight: 500, marginBottom: "2px" }}>
              1 low-confidence extraction
            </p>
            <button style={{ fontSize: "11px", color: "#1A4ED8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Review events ↗
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DocumentVault() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedDoc, setSelectedDoc] = useState<string | null>("d1");
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeSelect, setTypeSelect] = useState("All types");

  const activeDoc = docs.find((d) => d.key === selectedDoc) ?? null;

  const TYPE_LABEL: Record<string, string> = { sof: "SOF", cp: "Charter party", claim: "Claim", evidence: "Evidence", contracts: "Contracts", other: "Other" };
  const VESSEL_LABEL: Record<string, string> = { bw: "BW Magnolia", maran: "Maran Gas Apol.", gaslog: "Gaslog Geneva" };
  const STATUS_KEY: Record<string, DocStatus> = { s_extracted: "extracted", s_pending: "extracting", s_failed: "failed", s_archived: "archived" };

  const visibleDocs = docs
    .filter((d) => {
      if (activeFilter === "all" || activeFilter === "all_v") return true;
      if (activeFilter in TYPE_LABEL) return d.type === TYPE_LABEL[activeFilter];
      if (activeFilter in VESSEL_LABEL) return d.vessel === VESSEL_LABEL[activeFilter];
      if (activeFilter in STATUS_KEY) return d.status === STATUS_KEY[activeFilter];
      return true;
    })
    .filter((d) => typeSelect === "All types" || d.type === typeSelect)
    .filter((d) => !searchQuery.trim() || d.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Analytics", to: "/analytics" }, { label: "Document vault" }]} />

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-2.5">
          <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Document vault</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
            style={{ backgroundColor: "#EFF6FF", color: "#1E40AF", fontSize: "11px" }}>
            <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "#1A4ED8" }} />
            126 documents
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
            style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
            <Upload size={11} /> Upload document
          </button>
          <button className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
            style={{ height: "32px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
            Extract SOF <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Sidebar ── */}
        <div className="flex-shrink-0 overflow-y-auto"
          style={{ width: "220px", borderRight: "0.5px solid #E5E7EB", padding: "14px 0", backgroundColor: "#ffffff" }}>

          {/* Drop zone */}
          <div className="mx-3 mb-4 flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors"
            style={{
              padding: "16px 12px", textAlign: "center",
              backgroundColor: dragOver ? "#EFF6FF" : "#F9FAFB",
              border: `1px dashed ${dragOver ? "#1A4ED8" : "#D1D5DB"}`,
              borderRadius: "8px",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={() => setDragOver(false)}>
            <Upload size={18} style={{ color: dragOver ? "#1A4ED8" : "#9CA3AF", marginBottom: "6px" }} />
            <p style={{ fontSize: "12px", fontWeight: 500, color: dragOver ? "#1A4ED8" : "#374151", marginBottom: "2px" }}>
              Drop files here
            </p>
            <p style={{ fontSize: "10px", color: "#9CA3AF" }}>PDF, XLSX, DOCX</p>
          </div>

          {/* Filter sections */}
          {sidebarSections.map((section, si) => (
            <div key={section.label} style={{ marginBottom: "14px" }}>
              <p style={{ fontSize: "10px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 14px", marginBottom: "4px" }}>
                {section.label}
              </p>
              {section.items.map((item) => (
                <SidebarItem key={item.key} label={item.label} count={item.count}
                  active={activeFilter === item.key} onClick={() => setActiveFilter(item.key)} />
              ))}
              {si < sidebarSections.length - 1 && (
                <div style={{ borderTop: "0.5px solid #E5E7EB", margin: "10px 0 0" }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 overflow-hidden flex flex-col" style={{ padding: "16px 20px", minWidth: 0 }}>

          {/* Content header */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              All documents
            </span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "#9CA3AF" }} />
                <input placeholder="Search documents…" className="outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "200px", height: "30px", border: "0.5px solid #E5E7EB", borderRadius: "8px", padding: "0 10px 0 26px", fontSize: "12px", color: "#374151", backgroundColor: "#ffffff" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#1A4ED8")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")} />
              </div>
              <div className="relative">
                <select className="appearance-none outline-none cursor-pointer"
                  value={typeSelect}
                  onChange={(e) => setTypeSelect(e.target.value)}
                  style={{ height: "30px", border: "0.5px solid #E5E7EB", borderRadius: "8px", padding: "0 22px 0 9px", fontSize: "12px", color: "#374151", backgroundColor: "#ffffff" }}>
                  <option>All types</option>
                  <option>SOF</option>
                  <option>Charter party</option>
                  <option>Claim</option>
                </select>
                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9CA3AF" }} />
              </div>
              <button className="flex items-center gap-1.5 px-2.5 rounded-md border transition-colors cursor-pointer"
                style={{ height: "30px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
                Sort
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border overflow-hidden flex-1 flex flex-col"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full" style={{ tableLayout: "fixed", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, backgroundColor: "#ffffff", zIndex: 1 }}>
                  <tr style={{ borderBottom: "0.5px solid #E5E7EB" }}>
                    {[
                      { label: "File", w: undefined },
                      { label: "Type", w: "110px" },
                      { label: "Vessel", w: "120px" },
                      { label: "Voyage", w: "80px" },
                      { label: "Uploaded", w: "70px" },
                      { label: "Status", w: "100px" },
                      { label: "Actions", w: "100px" },
                    ].map(({ label, w }) => (
                      <th key={label} className="py-2.5 pl-4 pr-3 text-left" style={{ width: w }}>
                        <span style={{ fontSize: "10px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleDocs.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: "20px", fontSize: "12px", color: "#9CA3AF", textAlign: "center" }}>No documents match your filters.</td></tr>
                  )}
                  {visibleDocs.map((doc) => (
                    <DocRow key={doc.key} doc={doc}
                      selected={selectedDoc === doc.key}
                      onClick={() => setSelectedDoc(selectedDoc === doc.key ? null : doc.key)} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
              style={{ borderTop: "0.5px solid #F3F4F6" }}>
              <span style={{ fontSize: "10px", color: "#9CA3AF" }}>Showing 8 of 126 documents</span>
              <div className="flex items-center gap-1">
                <button className="flex items-center gap-1 px-2 rounded transition-colors cursor-pointer"
                  style={{ height: "26px", fontSize: "11px", color: "#6B7280", border: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
                  <ChevronLeft size={11} /> Prev
                </button>
                <button className="flex items-center gap-1 px-2 rounded transition-colors cursor-pointer"
                  style={{ height: "26px", fontSize: "11px", color: "#6B7280", border: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
                  Next <ChevronRight size={11} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Detail Drawer ── */}
        {activeDoc && (
          <div className="flex-shrink-0" style={{ width: "280px" }}>
            <DetailDrawer doc={activeDoc} onClose={() => setSelectedDoc(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
