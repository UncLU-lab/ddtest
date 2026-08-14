import { useState } from "react";
import { ArrowUpRight, CheckCircle, FileText, Scale, Clock } from "lucide-react";
import { PageHeader } from "./Layout";

type StrategyTab = "dispute" | "firm" | "soft" | "escalation";

// ─── Strategy tab ─────────────────────────────────────────────────────────────

const STRATEGY_CONFIG: Record<StrategyTab, { label: string; activeBg: string; activeText: string; idleBorder: string; idleText: string }> = {
  dispute:    { label: "Dispute & negotiate", activeBg: "#1A4ED8", activeText: "#ffffff", idleBorder: "#E5E7EB", idleText: "#6B7280" },
  firm:       { label: "Firm claim",          activeBg: "#B45309", activeText: "#ffffff", idleBorder: "#FDE68A", idleText: "#B45309" },
  soft:       { label: "Soft approach",       activeBg: "#276749", activeText: "#ffffff", idleBorder: "#6EE7B7", idleText: "#276749" },
  escalation: { label: "Escalation",          activeBg: "#374151", activeText: "#ffffff", idleBorder: "#E5E7EB", idleText: "#6B7280" },
};

function StrategyTabBtn({ id, active, onClick }: { id: StrategyTab; active: boolean; onClick: () => void }) {
  const c = STRATEGY_CONFIG[id];
  return (
    <button onClick={onClick}
      className="rounded-lg px-3 transition-colors cursor-pointer"
      style={{
        height: "32px", fontSize: "12px", fontWeight: active ? 500 : 400,
        backgroundColor: active ? c.activeBg : "#ffffff",
        color: active ? c.activeText : c.idleText,
        border: `0.5px solid ${active ? c.activeBg : c.idleBorder}`,
      }}>
      {c.label}
    </button>
  );
}

// ─── Strategy card ────────────────────────────────────────────────────────────

function StrategyCard({ variant, title, desc, pct, barColor, borderColor, bg, labelColor }:
  { variant: "recommended" | "alternative"; title: string; desc: string; pct: number; barColor: string; borderColor: string; bg: string; labelColor: string }) {
  return (
    <div className="rounded-lg p-[11px_13px]" style={{ backgroundColor: bg, border: `0.5px solid ${borderColor}` }}>
      <p style={{ fontSize: "10px", color: labelColor, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "3px" }}>
        {variant === "recommended" ? "Recommended strategy" : "Alternative approach"}
      </p>
      <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "3px" }}>{title}</p>
      <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.5, marginBottom: "8px" }}>{desc}</p>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: "10px", color: "#6B7280", flexShrink: 0 }}>Confidence</span>
        <div className="flex-1 rounded-full overflow-hidden" style={{ height: "6px", backgroundColor: "#E5E7EB" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
        <span style={{ fontSize: "10px", fontWeight: 500, color: barColor, flexShrink: 0 }}>{pct}%</span>
      </div>
    </div>
  );
}

// ─── Calculation table ────────────────────────────────────────────────────────

interface CalcRow { metric: string; detail: string; value: string; highlight?: "amber" | "total" | "surface" }

const calcRows: CalcRow[] = [
  { metric: "Laytime allowed", detail: "Per charter party clause 5 — 72h SHINC basis", value: "72h 00m" },
  { metric: "Gross laytime used", detail: "NOR acceptance to completion of loading", value: "62h 50m" },
  { metric: "Deductions applied", detail: "Weather (2h 30m) + Terminal breakdown (1h 30m) — clause 8b", value: "–4h 00m" },
  { metric: "Net laytime used", detail: "After qualifying deductions per CP terms", value: "58h 50m" },
  { metric: "Total overtime", detail: "Net used minus allowed — excess laytime attracting demurrage", value: "5h 10m", highlight: "amber" },
  { metric: "Pro-rata calc", detail: "$25,000/day × 5h 10m ÷ 24h = $127,604", value: "$127,604", highlight: "total" },
];

function CalcTableRow({ row }: { row: CalcRow }) {
  const isAmber = row.highlight === "amber";
  const isTotal = row.highlight === "total";
  const rowBg = isAmber ? "#FFF7ED" : isTotal ? "#F9FAFB" : "#ffffff";
  return (
    <tr style={{ backgroundColor: rowBg, borderBottom: "0.5px solid #F3F4F6" }}>
      <td className="py-2.5 pl-4 pr-3 align-top" style={{ width: "140px" }}>
        <span style={{ fontSize: "12px", fontWeight: isTotal ? 500 : 400, color: "#111827" }}>{row.metric}</span>
      </td>
      <td className="py-2.5 pr-3 align-top">
        <span style={{ fontSize: "11px", color: "#6B7280" }}>{row.detail}</span>
      </td>
      <td className="py-2.5 pr-4 align-top text-right" style={{ width: "70px" }}>
        <span style={{
          fontSize: isTotal ? "16px" : "12px",
          fontWeight: isTotal ? 500 : 400,
          color: isTotal ? "#C53030" : isAmber ? "#B45309" : "#374151",
        }}>{row.value}</span>
      </td>
    </tr>
  );
}

// ─── SOF event row ────────────────────────────────────────────────────────────

function SOFEventRow({ dotColor, timestamp, name, detail, last }:
  { dotColor: string; timestamp: string; name: string; detail: string; last?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: last ? "none" : "0.5px solid #F3F4F6" }}>
      <span className="rounded-full flex-shrink-0 mt-[3px]"
        style={{ width: "8px", height: "8px", backgroundColor: dotColor }} />
      <span className="flex-shrink-0" style={{ width: "90px", fontSize: "10px", color: "#9CA3AF" }}>{timestamp}</span>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "1px" }}>{name}</p>
        <p style={{ fontSize: "11px", color: "#6B7280" }}>{detail}</p>
      </div>
    </div>
  );
}

// ─── Clause item ──────────────────────────────────────────────────────────────

function ClauseItem({ icon, ref: clauseRef, desc }: { icon: React.ReactNode; ref: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-[9px_11px]"
      style={{ borderColor: "#E5E7EB", borderWidth: "0.5px" }}>
      <div className="flex items-center justify-center rounded-md flex-shrink-0"
        style={{ width: "28px", height: "28px", backgroundColor: "#DBEAFE" }}>
        <span style={{ color: "#1A4ED8" }}>{icon}</span>
      </div>
      <div>
        <p style={{ fontSize: "11px", fontWeight: 500, color: "#1A4ED8", marginBottom: "2px" }}>{clauseRef}</p>
        <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>{desc}</p>
      </div>
    </div>
  );
}

// ─── Sidebar KV row ───────────────────────────────────────────────────────────

function SideKV({ label, value, valueColor, noBorder }: { label: string; value: string; valueColor?: string; noBorder?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5"
      style={{ borderBottom: noBorder ? "none" : "0.5px solid #F3F4F6" }}>
      <span style={{ fontSize: "12px", color: "#6B7280" }}>{label}</span>
      <span style={{ fontSize: "12px", color: valueColor ?? "#111827", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GenerateClaim({ onComplete }: {
  onComplete?: () => void;
}) {
  const [activeStrategy, setActiveStrategy] = useState<StrategyTab>("dispute");
  const [targetMin, setTargetMin] = useState("118250");
  const [openingAsk, setOpeningAsk] = useState("127604");

  function handleDraftEmail() {
    const subject = encodeURIComponent("Demurrage claim CLM-2311-OTI — draft for review");
    const body = encodeURIComponent(
      `Hi,\n\nPlease find the draft demurrage claim against Ocean Traders Inc. (Ref: CLM-2311-OTI) for review.\n\nTarget minimum: $${Number(targetMin).toLocaleString()}\nOpening ask: $${Number(openingAsk).toLocaleString()}\nStrategy: ${STRATEGY_CONFIG[activeStrategy].label}\n\nLet me know if you'd like any adjustments before this goes out.\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        crumbs={[{ label: "Claims", to: "/claims" }, { label: "BW Magnolia · VOY-2311", to: "/shipments/VOY-2311" }, { label: "Generate claim" }]}
        actions={
          <>
            <button className="flex items-center gap-1.5 px-3 rounded-md border transition-colors cursor-pointer"
              style={{ height: "32px", fontSize: "12px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
              onClick={onComplete}>
              Save for review
            </button>
            <button className="flex items-center gap-1.5 px-3 rounded-md transition-colors cursor-pointer"
              style={{ height: "32px", fontSize: "12px", color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
              onClick={onComplete}>
              Generate claim PDF <ArrowUpRight size={12} />
            </button>
          </>
        }
      />

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between flex-shrink-0"
        style={{ padding: "14px 24px", borderBottom: "0.5px solid #E5E7EB", backgroundColor: "#ffffff" }}>
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 style={{ fontSize: "17px", fontWeight: 500, color: "#111827" }}>Generate claim</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
              style={{ backgroundColor: "#EFF6FF", color: "#1E40AF", fontSize: "11px" }}>
              <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "#1A4ED8" }} />
              Claim against: Ocean Traders Inc.
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
              style={{ backgroundColor: "#C6F6D5", color: "#22543D", fontSize: "11px" }}>
              <CheckCircle size={11} />
              Draft verified
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#6B7280" }}>
            BW Magnolia · VOY-2311 &nbsp;·&nbsp; Ref: CLM-2311-OTI &nbsp;·&nbsp; Claim profile: complete · ready to generate
          </p>
        </div>
      </div>

      {/* ── Main body ── */}
      <div className="flex gap-3.5 flex-1" style={{ padding: "16px 24px" }}>

        {/* ── Left column ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3.5">

          {/* Card 1 — Claim strategy */}
          <div className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center gap-2 mb-4">
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Claim strategy
              </span>
              <span className="rounded-full px-2 py-0.5 font-medium"
                style={{ fontSize: "10px", backgroundColor: "#EFF6FF", color: "#1E40AF" }}>
                98% confidence
              </span>
            </div>

            {/* Strategy tab row */}
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {(["dispute", "firm", "soft", "escalation"] as StrategyTab[]).map((id) => (
                <StrategyTabBtn key={id} id={id} active={activeStrategy === id} onClick={() => setActiveStrategy(id)} />
              ))}
            </div>

            {/* Strategy cards */}
            <div className="flex flex-col gap-2">
              <StrategyCard
                variant="recommended"
                title="Dispute &amp; negotiate — full claim with mediation fallback"
                desc="All 3 discrepancies are supported by primary evidence. Recommend filing full claim of $127,604 with a prepared negotiation settlement floor of $103,354. Mediation clause available if counterparty contests."
                pct={94}
                barColor="#1A4ED8"
                borderColor="#BFDBFE"
                bg="#EFF6FF"
                labelColor="#1E40AF"
              />
              <StrategyCard
                variant="alternative"
                title="Firm claim — press for full recovery without negotiation"
                desc="Evidence strength supports pressing for the full $127,604 without pre-emptive concessions. Higher recovery potential but increased dispute escalation risk and longer cycle time."
                pct={78}
                barColor="#F59E0B"
                borderColor="#FDE68A"
                bg="#FFFBEB"
                labelColor="#B45309"
              />
            </div>
          </div>

          {/* Card 2 — Calculation breakdown */}
          <div className="rounded-xl border overflow-hidden"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "0.5px solid #E5E7EB" }}>
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Calculation breakdown
              </span>
              <span style={{ fontSize: "11px", color: "#9CA3AF" }}>CLM-2311-OTI</span>
            </div>

            <table className="w-full" style={{ tableLayout: "fixed", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid #F3F4F6" }}>
                  <th className="py-2 pl-4 pr-3 text-left" style={{ width: "140px" }}>
                    <span style={{ fontSize: "10px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Metric</span>
                  </th>
                  <th className="py-2 pr-3 text-left">
                    <span style={{ fontSize: "10px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Detail / context</span>
                  </th>
                  <th className="py-2 pr-4 text-right" style={{ width: "70px" }}>
                    <span style={{ fontSize: "10px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Value</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {calcRows.map((row) => <CalcTableRow key={row.metric} row={row} />)}
              </tbody>
            </table>

            {/* Confidence strip */}
            <div className="flex items-center gap-3 mx-4 my-3 rounded-lg px-3 py-2.5"
              style={{ backgroundColor: "#F9FAFB" }}>
              <span style={{ fontSize: "11px", color: "#6B7280", flexShrink: 0 }}>Calculation confidence</span>
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: "6px", backgroundColor: "#E5E7EB" }}>
                <div className="h-full rounded-full" style={{ width: "98%", backgroundColor: "#1A4ED8" }} />
              </div>
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#22543D", flexShrink: 0 }}>98% high</span>
            </div>
          </div>

          {/* Card 3 — SOF events used */}
          <div className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                SOF events used
              </span>
              <span className="rounded-full px-2 py-0.5 font-medium"
                style={{ fontSize: "10px", backgroundColor: "#EFF6FF", color: "#1E40AF" }}>
                4 key events
              </span>
            </div>
            <SOFEventRow dotColor="#3B82F6" timestamp="23 Oct 14:00" name="Laytime commences"
              detail="NOR accepted — 6h notice period expired. Supplier and receiver clocks active." />
            <SOFEventRow dotColor="#F59E0B" timestamp="24 Oct 11:20" name="Rain squall — deductible"
              detail="2h 30m weather deductible. Terminal gauge confirms qualifying event under CP clause 8b." />
            <SOFEventRow dotColor="#F59E0B" timestamp="25 Oct 03:40" name="Terminal arm breakdown — deductible"
              detail="1h 30m terminal responsibility. Equipment failure log obtained from GAC port agent." />
            <SOFEventRow dotColor="#EF4444" timestamp="25 Oct 21:20" name="Loading completed"
              detail="Last hose disconnected. Net laytime: 58h 50m — 5h 10m in excess of 72h allowance." last />
          </div>

          {/* Card 4 — Contract clauses */}
          <div className="rounded-xl border p-[16px_18px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <span className="block mb-3" style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Contract clauses referenced
            </span>
            <div className="flex flex-col gap-2">
              <ClauseItem icon={<Clock size={13} />}
                ref="CP Clause 5 — Laytime commencement"
                desc="Defines NOR acceptance procedure and 6h notice period. Governs start of both supplier and receiver clocks." />
              <ClauseItem icon={<Scale size={13} />}
                ref="CP Clause 8b — Weather deductibles"
                desc="Qualifying weather events (rain, force majeure) are deductible from laytime calculation when supported by terminal evidence." />
              <ClauseItem icon={<FileText size={13} />}
                ref="ASBATANKVOY Clause 14 — Terminal liability"
                desc="Terminal equipment failures attributable to the terminal operator are excluded from laytime counting under this charter party framework." />
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ width: "216px", flexShrink: 0 }} className="flex flex-col gap-3">

          {/* Card 1 — Claim against party */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-3" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Claim against party
            </p>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: "36px", height: "36px", backgroundColor: "#DBEAFE" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#1A4ED8" }}>OT</span>
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>Ocean Traders Inc.</p>
                <p style={{ fontSize: "11px", color: "#9CA3AF" }}>Receiver / charterer</p>
              </div>
            </div>
            <SideKV label="Claim value" value="$127,604" valueColor="#C53030" />
            <SideKV label="vs baseline" value="–$24,250 saved" valueColor="#22543D" />
            <SideKV label="Confidence" value="94%" valueColor="#22543D" />
            <SideKV label="Strategy" value="Dispute & negotiate" valueColor="#1A4ED8" noBorder />
          </div>

          {/* Card 2 — Settlement range */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-3" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Settlement range
            </p>
            <div className="flex flex-col gap-2.5 mb-3">
              {[
                { label: "Target minimum", value: targetMin, set: setTargetMin, vc: "#1A4ED8" },
                { label: "Opening ask", value: openingAsk, set: setOpeningAsk, vc: "#C53030" },
              ].map(({ label, value, set, vc }) => (
                <div key={label}>
                  <p style={{ fontSize: "11px", color: "#9CA3AF", marginBottom: "2px" }}>{label}</p>
                  <div className="flex items-center gap-1">
                    <span style={{ fontSize: "16px", fontWeight: 500, color: vc }}>$</span>
                    <input
                      value={value}
                      onChange={(e) => set(e.target.value.replace(/[^0-9]/g, ""))}
                      style={{ fontSize: "16px", fontWeight: 500, color: vc, border: "none", outline: "none", width: "110px", backgroundColor: "transparent" }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {/* Settlement range bar */}
            <div className="rounded-full overflow-hidden mb-1.5" style={{ height: "8px", backgroundColor: "#F3F4F6" }}>
              <div className="flex h-full rounded-full overflow-hidden">
                <div style={{ width: "78%", backgroundColor: "#BFDBFE" }} />
                <div style={{ width: "22%", backgroundColor: "#1A4ED8" }} />
              </div>
            </div>
            <p style={{ fontSize: "10px", color: "#9CA3AF" }}>
              ${Number(targetMin || 0).toLocaleString()} floor &nbsp;·&nbsp; ${Number(openingAsk || 0).toLocaleString()} ceiling &nbsp;·&nbsp;
              {Number(targetMin) > 0 ? ` ${(((Number(openingAsk) - Number(targetMin)) / Number(targetMin)) * 100).toFixed(1)}% negotiation band` : ""}
            </p>
          </div>

          {/* Card 3 — Claim history */}
          <div className="rounded-xl border p-[14px_16px]"
            style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
            <p className="mb-2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Claim history
            </p>
            <SideKV label="Past claims" value="4 with OTI" />
            <SideKV label="Avg settlement" value="91% of ask" valueColor="#22543D" />
            <SideKV label="Avg cycle time" value="18 days" />
            <SideKV label="Last dispute" value="Mar 2023" noBorder />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button className="w-full flex items-center justify-center gap-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ height: "38px", fontSize: "13px", fontWeight: 500, color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}
              onClick={onComplete}>
              Generate claim PDF <ArrowUpRight size={13} />
            </button>
            {[{ label: "Draft claim email", action: handleDraftEmail }, { label: "Save for review", action: onComplete }].map(({ label, action }) => (
              <button key={label} onClick={action}
                className="w-full flex items-center justify-center rounded-lg border transition-colors cursor-pointer"
                style={{ height: "34px", fontSize: "13px", color: "#374151", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
