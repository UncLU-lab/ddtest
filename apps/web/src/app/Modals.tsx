import { useState } from "react";
import {
  Anchor, Bell, X, Upload, Cloud, FileText, AlertTriangle,
  CheckCircle, Circle,
} from "lucide-react";
import { TagPill, Btn, FormField, AlertStrip, Avatar } from "./ComponentLibrary";

type NavTab = "Operations" | "Claims" | "Analytics" | "Vessels";

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED MODAL SHELL
// ═══════════════════════════════════════════════════════════════════════════════

function ModalShell({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col" style={{
      backgroundColor: "#ffffff", borderRadius: "var(--radius-lg)",
      padding: "24px", border: "0.5px solid var(--border-default)",
      maxWidth: "480px", width: "100%", gap: "16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
    }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: "17px", fontWeight: 500, color: "var(--text-primary)" }}>{title}</h2>
        <button onClick={onClose}
          className="flex items-center justify-center rounded-md transition-colors cursor-pointer"
          style={{ width: "28px", height: "28px", border: "none", backgroundColor: "transparent", color: "var(--text-tertiary)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-tertiary)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}>
          <X size={15} />
        </button>
      </div>
      {children}
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, confirmLabel, confirmType = "primary", disabled }: {
  onCancel: () => void; onConfirm: () => void;
  confirmLabel: string; confirmType?: "primary" | "danger" | "success";
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: "0.5px solid var(--border-default)" }}>
      <Btn label="Cancel" type="secondary" onClick={onCancel} />
      <Btn label={confirmLabel} type={confirmType} state={disabled ? "disabled" : "default"} onClick={onConfirm} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL 01 — Add manual SOF event
// ═══════════════════════════════════════════════════════════════════════════════

function Modal01({ onClose }: { onClose: () => void }) {
  const causes = ["Weather", "Terminal", "Vessel", "Supplier"] as const;
  const [activeCause, setActiveCause] = useState<string>("Terminal");

  return (
    <ModalShell title="Add SOF event" onClose={onClose}>
      <div className="flex flex-col" style={{ gap: "12px" }}>
        <FormField label="Timestamp" required type="date" />
        <FormField label="Event name" required type="text" placeholder="e.g. Loading commenced" />

        {/* Cause / party tag pills */}
        <div className="flex flex-col" style={{ gap: "4px" }}>
          <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-primary)" }}>Cause / party <span style={{ color: "var(--critical-text)" }}>*</span></label>
          <div className="flex flex-wrap" style={{ gap: "6px" }}>
            {causes.map((c) => (
              <TagPill key={c} label={c} state={activeCause === c ? "active" : "default"} onClick={() => setActiveCause(c)} />
            ))}
          </div>
        </div>

        <FormField label="Duration" type="number" placeholder="Hours (e.g. 2.5)" hint="Leave blank if duration is not yet known" />
        <FormField label="Notes" type="textarea" placeholder="Add any supporting context or evidence references…" />
      </div>
      <ModalFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Add event" />
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL 02 — Invite team member
// ═══════════════════════════════════════════════════════════════════════════════

function Modal02({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Invite team member" onClose={onClose}>
      <div className="flex flex-col" style={{ gap: "12px" }}>
        <FormField label="Full name" required type="text" placeholder="e.g. Sarah Adeyemi" />
        <FormField label="Email address" required type="text" placeholder="name@company.com" />
        <FormField label="Role" required type="select" value="Claims analyst"
          options={["Admin", "Claims analyst", "Ops viewer", "Commercial"]} />

        {/* Role descriptions */}
        <div className="rounded-lg p-[10px_12px]" style={{ backgroundColor: "var(--bg-secondary)" }}>
          {[
            { role: "Admin",           desc: "Full access — settings, billing, all data" },
            { role: "Claims analyst",  desc: "Manage claims, SOF, and audit console" },
            { role: "Ops viewer",      desc: "Read-only access to operations and shipments" },
            { role: "Commercial",      desc: "Template library, entity directory, analytics" },
          ].map(({ role, desc }) => (
            <div key={role} className="flex items-baseline gap-2 py-1">
              <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-primary)", width: "100px", flexShrink: 0 }}>{role}</span>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
      <ModalFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Send invite" />
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL 03 — Accept claim confirmation
// ═══════════════════════════════════════════════════════════════════════════════

function Modal03({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Accept this claim?" onClose={onClose}>
      {/* Claim summary */}
      <div className="rounded-lg p-[12px_14px] flex flex-col" style={{ backgroundColor: "var(--bg-secondary)", gap: "8px" }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Claim reference</span>
          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>CLM-2311-OTI</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Counterparty</span>
          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>Ocean Traders Inc.</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Vessel / voyage</span>
          <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>BW Magnolia · VOY-2311</span>
        </div>
        <div style={{ borderTop: "0.5px solid var(--border-default)", paddingTop: "8px", marginTop: "2px" }}>
          <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "2px" }}>Claim value to accept</p>
          <p style={{ fontSize: "24px", fontWeight: 500, color: "var(--critical-text)", lineHeight: 1.2 }}>$127,604</p>
          <p style={{ fontSize: "11px", color: "var(--elevated-text)", marginTop: "2px" }}>Our AI reconstruction: $103,354 &nbsp;·&nbsp; $24,250 above baseline</p>
        </div>
      </div>

      <AlertStrip type="warning"
        title="This action cannot be undone."
        body="The claim will be marked as accepted and removed from the dispute pipeline. A record will be added to the audit log." />

      <ModalFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Accept claim" confirmType="danger" />
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL 04 — Rotate API key
// ═══════════════════════════════════════════════════════════════════════════════

function Modal04({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Rotate API key?" onClose={onClose}>
      <AlertStrip type="danger"
        body="Your current key will be immediately invalidated. Any systems using it will lose access until updated with the new key." />

      <div className="flex flex-col" style={{ gap: "10px" }}>
        <p style={{ fontSize: "13px", color: "var(--text-primary)" }}>
          Before rotating, make sure you've updated all integrations that use this key:
        </p>
        {["AIS tracking integration", "SOF email ingestion webhook", "Internal reporting pipeline"].map((item) => (
          <div key={item} className="flex items-center gap-2">
            <div className="rounded-full flex-shrink-0" style={{ width: "5px", height: "5px", backgroundColor: "var(--elevated-text)" }} />
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{item}</span>
          </div>
        ))}
      </div>

      <div className="rounded-lg p-[10px_12px]" style={{ backgroundColor: "var(--bg-secondary)" }}>
        <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current key</p>
        <p style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)" }}>dd_live_a4f8c291be03d7e5f62a…</p>
        <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "4px" }}>Last used 2 hours ago &nbsp;·&nbsp; Created 14 Mar 2023</p>
      </div>

      <ModalFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Rotate key" confirmType="danger" />
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL 05 — Export options
// ═══════════════════════════════════════════════════════════════════════════════

type ExportFormat = "pdf" | "excel" | "csv";

const EXPORT_OPTIONS: { key: ExportFormat; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: "pdf",   label: "PDF report",         desc: "Formatted report with charts and summaries", icon: <FileText size={15} color="var(--critical-text)" /> },
  { key: "excel", label: "Excel spreadsheet",  desc: "Full data with formulas and pivot-ready layout", icon: <FileText size={15} color="var(--optimal-text)" /> },
  { key: "csv",   label: "CSV data",            desc: "Raw comma-separated data for custom analysis", icon: <FileText size={15} color="var(--accent-blue)" /> },
];

function Modal05({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<ExportFormat>("pdf");

  return (
    <ModalShell title="Export" onClose={onClose}>
      <div className="flex flex-col" style={{ gap: "8px" }}>
        {EXPORT_OPTIONS.map(({ key, label, desc, icon }) => {
          const isSelected = selected === key;
          return (
            <button key={key} onClick={() => setSelected(key)}
              className="flex items-center gap-3 rounded-lg transition-colors text-left cursor-pointer"
              style={{
                padding: "11px 13px",
                border: `0.5px solid ${isSelected ? "var(--accent-blue)" : "var(--border-default)"}`,
                backgroundColor: isSelected ? "#EFF6FF" : "var(--bg-primary)",
              }}>
              {/* Radio dot */}
              <div className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: "16px", height: "16px", border: `1.5px solid ${isSelected ? "var(--accent-blue)" : "var(--border-emphasis)"}`, backgroundColor: "var(--bg-primary)" }}>
                {isSelected && <div className="rounded-full" style={{ width: "8px", height: "8px", backgroundColor: "var(--accent-blue)" }} />}
              </div>
              <span className="flex-shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Date range */}
      <div className="flex flex-col" style={{ gap: "4px" }}>
        <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-primary)" }}>Date range</label>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" defaultValue="2023-10-01" className="outline-none"
            style={{ height: "34px", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "0 10px", fontSize: "12px", color: "var(--text-primary)", backgroundColor: "var(--bg-primary)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-blue)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")} />
          <input type="date" defaultValue="2023-10-31" className="outline-none"
            style={{ height: "34px", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "0 10px", fontSize: "12px", color: "var(--text-primary)", backgroundColor: "var(--bg-primary)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-blue)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")} />
        </div>
      </div>

      <ModalFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Export" />
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL 06 — Upload SOF
// ═══════════════════════════════════════════════════════════════════════════════

function Modal06({ onClose }: { onClose: () => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  return (
    <ModalShell title="Upload statement of facts" onClose={onClose}>
      {!uploaded ? (
        /* Drop zone */
        <div
          className="flex flex-col items-center justify-center cursor-pointer transition-colors rounded-xl"
          style={{
            padding: "32px 24px", textAlign: "center",
            border: `1px dashed ${dragOver ? "var(--accent-blue)" : "var(--border-emphasis)"}`,
            backgroundColor: dragOver ? "#EFF6FF" : "var(--bg-secondary)",
            borderRadius: "var(--radius-lg)",
            gap: "10px",
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); setUploaded(true); }}
          onClick={() => setUploaded(true)}>
          <Cloud size={32} style={{ color: dragOver ? "var(--accent-blue)" : "var(--text-tertiary)" }} />
          <div>
            <p style={{ fontSize: "13px", color: dragOver ? "var(--accent-blue)" : "var(--text-primary)", fontWeight: 400 }}>
              Drop PDF here or <span style={{ color: "var(--accent-blue)", fontWeight: 500 }}>browse</span>
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "3px" }}>PDF, max 10MB</p>
          </div>
          <p style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
            Statement of Facts, Bill of Lading, or NOR document accepted
          </p>
        </div>
      ) : (
        /* File row — post-upload */
        <div className="flex items-center gap-3 rounded-lg border p-[11px_13px]"
          style={{ borderColor: "var(--border-default)", borderWidth: "0.5px", backgroundColor: "var(--bg-primary)" }}>
          <div className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: "36px", height: "36px", backgroundColor: "#DBEAFE" }}>
            <FileText size={16} color="var(--accent-blue)" />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "2px" }}>
              SOF_BW-Magnolia_VOY2311_Singapore.pdf
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>1.2 MB &nbsp;·&nbsp; Uploaded just now</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
              style={{ fontSize: "10px", backgroundColor: "var(--elevated-fill)", color: "var(--elevated-text)" }}>
              <span className="rounded-full animate-pulse" style={{ width: "5px", height: "5px", backgroundColor: "var(--elevated-text)" }} />
              Extracting…
            </span>
          </div>
          <button onClick={() => setUploaded(false)}
            className="flex items-center justify-center rounded cursor-pointer transition-colors"
            style={{ width: "24px", height: "24px", border: "none", backgroundColor: "transparent", color: "var(--text-tertiary)", flexShrink: 0 }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-tertiary)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}>
            <X size={13} />
          </button>
        </div>
      )}

      {!uploaded && (
        <p style={{ fontSize: "11px", color: "var(--text-tertiary)", textAlign: "center" }}>
          AI extraction runs automatically after upload. Events are mapped to the SOF timeline within ~30 seconds.
        </p>
      )}

      <ModalFooter onCancel={onClose} onConfirm={onClose}
        confirmLabel={uploaded ? "Upload & extract" : "Upload & extract"}
        disabled={!uploaded} />
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERLAY WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODALS SHOWCASE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const MODAL_DEFS = [
  { key: "m01", label: "Add SOF event",             sublabel: "Form — 5 fields, tag pill group" },
  { key: "m02", label: "Invite team member",         sublabel: "Form — name, email, role select" },
  { key: "m03", label: "Accept claim",               sublabel: "Confirmation — warning type, value summary" },
  { key: "m04", label: "Rotate API key",             sublabel: "Confirmation — danger type" },
  { key: "m05", label: "Export options",             sublabel: "Choice — radio select, date range" },
  { key: "m06", label: "Upload SOF",                 sublabel: "Upload — drop zone → file row state" },
];

export default function Modals({ onNav }: { onNav: (tab: NavTab) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const navTabs: NavTab[] = ["Operations", "Claims", "Analytics", "Vessels"];

  const close = () => setOpen(null);

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
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Modal Overlays</span>
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
            Modals
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
        <div className="mb-10">
          <h1 style={{ fontSize: "22px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "6px" }}>Modal overlays</h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            6 modal dialogs — click any card to preview on the live overlay. All modals are interactive with their working states.
          </p>
        </div>

        {/* Modal trigger grid */}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {MODAL_DEFS.map(({ key, label, sublabel }, i) => (
            <button key={key} onClick={() => setOpen(key)}
              className="flex flex-col items-start text-left rounded-xl border transition-all cursor-pointer"
              style={{ padding: "20px", borderColor: "var(--border-default)", borderWidth: "0.5px", backgroundColor: "var(--bg-primary)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#93C5FD"; (e.currentTarget as HTMLElement).style.backgroundColor = "#F8FBFF"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-primary)"; }}>
              {/* Modal number badge */}
              <div className="rounded-md flex items-center justify-center mb-3"
                style={{ width: "32px", height: "32px", backgroundColor: "var(--bg-tertiary)" }}>
                <span style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)", fontWeight: 500 }}>M{String(i + 1).padStart(2, "0")}</span>
              </div>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "4px" }}>{label}</p>
              <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{sublabel}</p>
              <span className="mt-3 inline-block rounded-full px-2.5 py-0.5"
                style={{ fontSize: "10px", backgroundColor: "var(--bg-tertiary)", color: "var(--text-tertiary)" }}>
                Click to preview →
              </span>
            </button>
          ))}
        </div>

        {/* Anatomy reference */}
        <div className="mt-10">
          <h2 style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "16px", paddingBottom: "8px", borderBottom: "0.5px solid var(--border-default)" }}>
            Modal anatomy
          </h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {[
              { label: "Background overlay",  value: "rgba(0,0,0,0.45)" },
              { label: "Modal background",    value: "#ffffff" },
              { label: "Border radius",       value: "radius/lg (12px)" },
              { label: "Border",             value: "0.5px border/default" },
              { label: "Padding",            value: "24px" },
              { label: "Max width",          value: "480px" },
              { label: "Internal gap",       value: "16px" },
              { label: "Footer border",      value: "0.5px border/default top" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{label}</span>
                <span style={{ fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live overlays */}
      {open === "m01" && <Overlay onClose={close}><Modal01 onClose={close} /></Overlay>}
      {open === "m02" && <Overlay onClose={close}><Modal02 onClose={close} /></Overlay>}
      {open === "m03" && <Overlay onClose={close}><Modal03 onClose={close} /></Overlay>}
      {open === "m04" && <Overlay onClose={close}><Modal04 onClose={close} /></Overlay>}
      {open === "m05" && <Overlay onClose={close}><Modal05 onClose={close} /></Overlay>}
      {open === "m06" && <Overlay onClose={close}><Modal06 onClose={close} /></Overlay>}
    </div>
  );
}

// Named exports for use across other screens
export { Modal01, Modal02, Modal03, Modal04, Modal05, Modal06, Overlay };
