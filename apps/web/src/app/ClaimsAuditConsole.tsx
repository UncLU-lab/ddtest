import { useState } from "react";
import {
  Download, ArrowUpRight,
  CheckCircle, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "./Layout";

// ─── Variance Card ────────────────────────────────────────────────────────────

function VarianceCard({ label, value, sub, bg, border, valueColor, subColor }:
  { label: string; value: string; sub: string; bg: string; border: string; valueColor: string; subColor: string }) {
  return (
    <div className="flex-1 flex flex-col gap-1 rounded-lg p-[12px_14px]"
      style={{ backgroundColor: bg, border: `0.5px solid ${border}` }}>
      <p style={{ fontSize: "10px", color: subColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ fontSize: "22px", fontWeight: 500, color: valueColor, lineHeight: 1.2 }}>{value}</p>
      <p style={{ fontSize: "11px", color: subColor }}>{sub}</p>
    </div>
  );
}

// ─── Tag Pill ─────────────────────────────────────────────────────────────────

function TagPill({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 font-medium"
      style={{ fontSize: "10px", backgroundColor: bg, color: text }}>
      {label}
    </span>
  );
}

// ─── Event Row ────────────────────────────────────────────────────────────────

type EventRowState = "normal" | "disputed" | "adjusted";

function EventRow({ n, timestamp, name, detail, tag, tagBg, tagText, state = "normal" }: {
  n: string; timestamp: string; name: string; detail: string;
  tag: string; tagBg: string; tagText: string; state?: EventRowState;
}) {
  const isDisputed = state === "disputed";
  const isAdjusted = state === "adjusted";
  const rowBg = isDisputed ? "#FEF2F2" : isAdjusted ? "#EFF6FF" : "transparent";
  const numBg = isDisputed ? "#FECACA" : isAdjusted ? "#BFDBFE" : "#F3F4F6";
  const numColor = isDisputed ? "#9B2C2C" : isAdjusted ? "#1E40AF" : "#6B7280";

  return (
    <div className="flex gap-3 mb-3 last:mb-0">
      <div
        className="rounded-lg flex-1 p-2"
        style={{ backgroundColor: rowBg, transition: "background-color 0.12s" }}
      >
        <div className="flex items-start gap-2.5">
          <span className="inline-flex items-center justify-center rounded-full flex-shrink-0 font-medium"
            style={{ width: "20px", height: "20px", backgroundColor: numBg, color: numColor, fontSize: "10px", marginTop: "1px" }}>
            {n}
          </span>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "2px" }}>{timestamp}</p>
            <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>{name}</p>
            <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4, marginBottom: "5px" }}>{detail}</p>
            <TagPill label={tag} bg={tagBg} text={tagText} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Discrepancy Card ─────────────────────────────────────────────────────────

type DiscrepancyLevel = "critical" | "medium" | "low";

const discrepancyAccent: Record<DiscrepancyLevel, { border: string; labelColor: string; valueColor: string }> = {
  critical: { border: "#EF4444", labelColor: "#C53030", valueColor: "#C53030" },
  medium:   { border: "#F59E0B", labelColor: "#B45309", valueColor: "#B45309" },
  low:      { border: "#10B981", labelColor: "#22543D", valueColor: "#22543D" },
};

function DiscrepancyCard({ level, type, title, desc, variance }: {
  level: DiscrepancyLevel; type: string; title: string; desc: string; variance: string;
}) {
  const c = discrepancyAccent[level];
  return (
    <div className="flex flex-col gap-1.5 rounded-r-lg p-[12px_14px]"
      style={{
        border: "0.5px solid #E5E7EB",
        borderLeft: `3px solid ${c.border}`,
        borderRadius: "0 8px 8px 0",
        backgroundColor: "#ffffff",
      }}>
      <p style={{ fontSize: "10px", color: c.labelColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>{type}</p>
      <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{title}</p>
      <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>{desc}</p>
      <p style={{ fontSize: "12px", fontWeight: 500, color: c.valueColor }}>{variance}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClaimsAuditConsole({ onGenerateReport, onSaveForReview }: {
  onGenerateReport?: () => void;
  onSaveForReview?: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState<"escalated" | "accepted" | null>(null);
  const [noteError, setNoteError] = useState(false);

  function handleEscalate() {
    if (!notes.trim()) { setNoteError(true); return; }
    setNoteError(false);
    setDecision("escalated");
  }
  function handleAccept() {
    setDecision("accepted");
  }
  function handleDraftEmail() {
    const subject = encodeURIComponent("Demurrage claim CLM-2311-VAS — dispute discrepancies");
    const body = encodeURIComponent(
      `Hi,\n\nWe've identified 3 discrepancies in the demurrage claim from Vitol Asia (Ref: CLM-2311-VAS) totalling an overcharge that requires review.\n\n${notes ? `Reviewer notes:\n${notes}\n\n` : ""}Please advise on next steps.\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        crumbs={[{ label: "Claims", to: "/claims" }, { label: "BW Magnolia · VOY-2311", to: "/shipments/VOY-2311" }, { label: "Audit console" }]}
        actions={
          <>
            <button className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
              style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
              <Download size={11} /> Export audit log
            </button>
            <button className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
              style={{ height: "32px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
              onClick={onGenerateReport}>
              Generate dispute report <ArrowUpRight size={12} />
            </button>
          </>
        }
      />

      {/* ── Claim Header ── */}
      <div className="flex items-start justify-between flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Claims audit console</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold"
              style={{ backgroundColor: "#FED7D7", color: "#9B2C2C", fontSize: "11px" }}>
              <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "#C53030" }} />
              3 critical discrepancies
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
              style={{ backgroundColor: "#C6F6D5", color: "#22543D", fontSize: "11px" }}>
              <CheckCircle size={11} style={{ color: "#22543D" }} />
              AI reconstruction verified
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#6B7280" }}>
            Counterparty: Vitol Asia &nbsp;·&nbsp; Ref: CLM-2311-VAS &nbsp;·&nbsp; Submitted: 28 Oct 2023
          </p>
        </div>
      </div>

      {/* ── Variance Strip ── */}
      <div className="flex gap-2.5 flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <VarianceCard
          label="Their claim value"
          value="$142,500"
          sub="Counterparty submitted figure"
          bg="#FEF2F2" border="#FECACA"
          valueColor="#C53030" subColor="#9B2C2C"
        />
        <VarianceCard
          label="Our reconstructed value"
          value="$118,250"
          sub="AI-verified SOF reconstruction"
          bg="#EFF6FF" border="#BFDBFE"
          valueColor="#1A4ED8" subColor="#1E40AF"
        />
        <VarianceCard
          label="Total variance"
          value="–$24,250"
          sub="Recoverable via dispute"
          bg="#FFFBEB" border="#FDE68A"
          valueColor="#B45309" subColor="#7B341E"
        />
      </div>

      {/* ── Main Comparison Grid ── */}
      <div className="flex flex-1" style={{ borderTop: "0.5px solid #E5E7EB" }}>

        {/* Left — Supplier submission */}
        <div className="flex-1 min-w-0" style={{ borderRight: "0.5px solid #E5E7EB", padding: "14px 16px" }}>
          <p className="mb-4" style={{ fontSize: "11px", fontWeight: 500, color: "#C53030", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Supplier submission
          </p>

          <EventRow n="01" timestamp="23 Oct 08:00" name="NOR tendered"
            detail="Counterparty records NOR accepted at 08:00. Laytime commences immediately — no waiting applied."
            tag="Laytime counting" tagBg="#EFF6FF" tagText="#1E40AF" />

          <EventRow n="02" timestamp="23 Oct 14:30" name="Berth delay — congestion"
            detail="Terminal congestion delay. No deduction applied by counterparty."
            tag="Counting — 6h 30m" tagBg="#EFF6FF" tagText="#1E40AF" />

          <EventRow n="03" timestamp="24 Oct 11:20" name="Rain squall — not deducted"
            detail="Operations suspended 2h 30m. Counterparty argues SHINC applies — no deduction applied."
            tag="Disputed — no deduction applied" tagBg="#FED7D7" tagText="#9B2C2C"
            state="disputed" />

          <EventRow n="04" timestamp="25 Oct 21:20" name="Loading completed"
            detail="Last hose disconnected. Counterparty calculates total laytime used: 62h 50m."
            tag="Laytime ends" tagBg="#F3F4F6" tagText="#374151" />
        </div>

        {/* Right — AI reconstruction */}
        <div className="flex-1 min-w-0" style={{ padding: "14px 16px" }}>
          <p className="mb-4" style={{ fontSize: "11px", fontWeight: 500, color: "#1A4ED8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            AI reconstruction
          </p>

          <EventRow n="01" timestamp="23 Oct 14:00" name="NOR acceptance corrected"
            detail="Pilot station logs confirm NOR tendered 08:00, accepted 14:00 per 6h notice. +6h recovered."
            tag="+6h recovered · $9,200" tagBg="#C6F6D5" tagText="#22543D"
            state="adjusted" />

          <EventRow n="02" timestamp="23 Oct 14:30" name="Berth delay confirmed"
            detail="Terminal congestion confirmed by port authority records. Correctly counting."
            tag="Confirmed · matches SOF" tagBg="#EFF6FF" tagText="#1E40AF" />

          <EventRow n="03" timestamp="24 Oct 11:20" name="Rain squall — deduction applied"
            detail="Terminal weather log and rain gauge data confirm qualifying event under charter party clause 8(b)."
            tag="–4h 30m deducted · $11,450" tagBg="#C6F6D5" tagText="#22543D"
            state="adjusted" />

          <EventRow n="04" timestamp="25 Oct 21:20" name="Loading completion confirmed"
            detail="AI reconstruction: net laytime used 54h 20m. No demurrage — within allowed 72h."
            tag="Net used: 54h 20m · no demurrage" tagBg="#C6F6D5" tagText="#22543D" />
        </div>
      </div>

      {/* ── Discrepancy Analysis ── */}
      <div className="flex-shrink-0" style={{ padding: "14px 24px", borderTop: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-2.5 mb-3">
          <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Discrepancy analysis
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold"
            style={{ backgroundColor: "#FED7D7", color: "#9B2C2C", fontSize: "10px" }}>
            $24,250 recoverable
          </span>
        </div>

        {/* 3 discrepancy cards */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <DiscrepancyCard level="critical" type="Critical · NOR timing"
            title="Incorrect NOR start time"
            desc="Counterparty started laytime at NOR tender (08:00) rather than NOR acceptance (14:00), ignoring the 6h notice period mandated in the charter party."
            variance="+6h · $9,200 overcharge" />
          <DiscrepancyCard level="critical" type="Critical · deduction clause"
            title="Wrong deduction treatment"
            desc="Rain squall qualifying under CP clause 8(b) not deducted. Terminal weather log confirms 2h 30m + 2h arm breakdown = 4h 30m total deductible time."
            variance="+4h 30m · $11,450 overcharge" />
          <DiscrepancyCard level="medium" type="Medium · calendar basis"
            title="Calendar mismatch"
            desc="Counterparty applied SHEX calendar rather than SHINC as agreed. Affects weekend hours calculation for the Singapore terminal berth window."
            variance="+2h 15m · $3,600 overcharge" />
        </div>

        {/* Evidence + Recommendation row */}
        <div className="flex gap-2.5" style={{ borderTop: "0.5px solid #E5E7EB", paddingTop: "12px" }}>
          <div className="flex-1 rounded-lg p-[10px_12px]" style={{ backgroundColor: "#F9FAFB" }}>
            <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Evidence available
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Pilot station log",
                "Port authority NOR record",
                "Terminal weather log",
                "Rain gauge data",
                "CP clause 8(b) extract",
              ].map((ev) => (
                <span key={ev} className="rounded-full px-2.5 py-0.5 cursor-pointer transition-colors"
                  style={{ fontSize: "11px", border: "0.5px solid #BFDBFE", backgroundColor: "#EFF6FF", color: "#1E40AF" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#DBEAFE")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#EFF6FF")}>
                  {ev}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-[10px_12px] flex flex-col gap-1" style={{ backgroundColor: "#F9FAFB", minWidth: "200px" }}>
            <p style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Recommended action
            </p>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#22543D" }}>Dispute &amp; negotiate</p>
            <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>
              94% confidence · all 3 discrepancies supported by primary evidence
            </p>
          </div>
        </div>
      </div>

      {/* ── Reviewer notes ── */}
      <div className="flex-shrink-0" style={{ padding: "12px 24px 0", backgroundColor: "#F9FAFB" }}>
        <label className="flex flex-col gap-1">
          <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Reviewer notes {decision === null && <span style={{ color: "#9CA3AF", textTransform: "none", letterSpacing: 0 }}>(required to escalate)</span>}
          </span>
          <textarea
            value={notes}
            disabled={decision !== null}
            onChange={(e) => { setNotes(e.target.value); if (e.target.value.trim()) setNoteError(false); }}
            placeholder="Record the reasoning behind your decision — this is saved with the audit trail…"
            style={{
              height: "60px", border: `0.5px solid ${noteError ? "#DC2626" : "#E5E7EB"}`, borderRadius: "8px",
              padding: "8px 10px", fontSize: "12px", resize: "none", backgroundColor: decision !== null ? "#F3F4F6" : "#ffffff",
            }}
          />
          {noteError && <span style={{ fontSize: "11px", color: "#DC2626" }}>Add a note before escalating internally.</span>}
        </label>
      </div>

      {/* ── Footer Action Bar ── */}
      <div className="flex items-center justify-between flex-shrink-0"
        style={{ padding: "12px 24px", borderTop: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-2">
          <span className="rounded-full" style={{ width: "7px", height: "7px", backgroundColor: decision ? "#1A4ED8" : "#10B981" }} />
          <span style={{ fontSize: "11px", color: "#6B7280" }}>
            {decision === "escalated" && "Status: escalated for internal review"}
            {decision === "accepted" && "Status: claim accepted"}
            {decision === null && "Status: draft verified"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {decision === null ? (
            <>
              <button onClick={onSaveForReview}
                className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
                style={{ height: "34px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
                Save for review
              </button>
              <button onClick={handleDraftEmail}
                className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
                style={{ height: "34px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
                Draft email
              </button>
              <button onClick={handleEscalate}
                className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
                style={{ height: "34px", fontSize: "12px", color: "#ffffff", backgroundColor: "#B45309", border: "none" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#92400e")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#B45309")}>
                <AlertTriangle size={12} /> Escalate internally
              </button>
              <button onClick={onGenerateReport}
                className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
                style={{ height: "34px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
                Generate dispute report <ArrowUpRight size={12} />
              </button>
              <button onClick={handleAccept}
                className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
                style={{ height: "34px", fontSize: "12px", color: "#ffffff", backgroundColor: "#276749", border: "none" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1c4532")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#276749")}>
                <CheckCircle size={12} /> Accept claim
              </button>
            </>
          ) : (
            <button onClick={() => setDecision(null)}
              className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
              style={{ height: "34px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
              Undo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
