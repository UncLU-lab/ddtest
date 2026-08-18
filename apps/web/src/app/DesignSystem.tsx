import { Anchor, Bell } from "lucide-react";

type NavTab = "Operations" | "Claims" | "Analytics" | "Vessels";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "16px", paddingBottom: "8px", borderBottom: "0.5px solid var(--border-default)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ name, value, light, dark, border }: { name: string; value?: string; light?: string; dark?: string; border?: boolean }) {
  const bg = value ?? light ?? "#ffffff";
  return (
    <div className="flex items-center gap-3">
      <div className="rounded flex-shrink-0"
        style={{
          width: "40px", height: "40px", backgroundColor: bg,
          border: border ? "0.5px solid var(--border-default)" : "none",
          borderRadius: "var(--radius-md)",
        }} />
      <div>
        <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>{name}</p>
        <p style={{ fontSize: "10px", color: "var(--text-tertiary)", fontFamily: "JetBrains Mono, monospace" }}>
          {value ?? `L: ${light}  D: ${dark}`}
        </p>
      </div>
    </div>
  );
}

function SwatchGroup({ label, swatches }: { label: string; swatches: React.ReactNode[] }) {
  return (
    <div className="mb-6">
      <p style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>{label}</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {swatches}
      </div>
    </div>
  );
}

function TypeSample({ name, sample, style }: { name: string; sample: string; style: React.CSSProperties }) {
  return (
    <div className="flex items-center gap-6 py-3" style={{ borderBottom: "0.5px solid var(--border-default)" }}>
      <div style={{ width: "200px", flexShrink: 0 }}>
        <p style={{ fontSize: "11px", color: "var(--text-tertiary)", fontFamily: "JetBrains Mono, monospace" }}>{name}</p>
      </div>
      <p style={{ ...style, color: "var(--text-primary)" }}>{sample}</p>
      <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginLeft: "auto", fontFamily: "JetBrains Mono, monospace", flexShrink: 0 }}>
        {style.fontSize} / {(style.fontWeight ?? 400) === 500 ? "Medium 500" : "Regular 400"}
        {style.letterSpacing ? ` / ls ${style.letterSpacing}` : ""}
        {style.fontFamily?.includes("Mono") ? " / Mono" : ""}
      </p>
    </div>
  );
}

function SpacingRow({ name, value, px }: { name: string; value: string; px: number }) {
  return (
    <div className="flex items-center gap-4 py-2" style={{ borderBottom: "0.5px solid var(--border-default)" }}>
      <div style={{ width: "160px", flexShrink: 0 }}>
        <p style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "var(--text-primary)" }}>{name}</p>
      </div>
      <div style={{ width: `${Math.min(px * 4, 240)}px`, height: "8px", backgroundColor: "var(--accent-blue)", borderRadius: "2px", flexShrink: 0 }} />
      <p style={{ fontSize: "11px", color: "var(--text-tertiary)", fontFamily: "JetBrains Mono, monospace" }}>{value}</p>
    </div>
  );
}

function BadgeRow({ label, bg, text, border }: { label: string; bg: string; text: string; border?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
        style={{ backgroundColor: bg, color: text, fontSize: "11px", fontWeight: 500, border: border ? `0.5px solid ${border}` : "none" }}>
        <span className="rounded-full" style={{ width: "5px", height: "5px", backgroundColor: text }} />
        {label}
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DesignSystem({ onNav }: { onNav: (tab: NavTab) => void }) {
  const navTabs: NavTab[] = ["Operations", "Claims", "Analytics", "Vessels"];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-secondary)", fontFamily: "'Inter', sans-serif" }}>

      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-6 flex-shrink-0"
        style={{ height: "56px", backgroundColor: "var(--bg-primary)", borderBottom: "0.5px solid var(--border-default)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg"
            style={{ width: "30px", height: "30px", backgroundColor: "var(--accent-blue)" }}>
            <Anchor size={15} color="#ffffff" strokeWidth={2} />
          </div>
          <div className="flex flex-col leading-tight">
            <span style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)" }}>Demurrage Defender</span>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Design System</span>
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
            Design System
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 flex items-center justify-center rounded-md"
            style={{ color: "var(--text-secondary)", border: "none", backgroundColor: "transparent" }}>
            <Bell size={15} />
          </button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: "var(--accent-blue)", fontSize: "11px", fontWeight: 600 }}>WJ</div>
        </div>
      </nav>

      {/* ── Content ── */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px", width: "100%" }}>

        {/* Header */}
        <div className="mb-10">
          <h1 style={{ fontSize: "22px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "6px" }}>
            Demurrage Defender — Design System
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Colour tokens, typography scale, spacing variables, and component patterns. All values reference CSS custom properties defined in <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "12px", backgroundColor: "var(--bg-tertiary)", padding: "1px 5px", borderRadius: "4px" }}>theme.css</code>.
          </p>
        </div>

        {/* ── Colour tokens ── */}
        <Section title="Colour tokens">
          <SwatchGroup label="Background" swatches={[
            <Swatch key="bg1" name="background/primary"   light="#FFFFFF"  dark="#0F1117" border />,
            <Swatch key="bg2" name="background/secondary" light="#F9FAFB"  dark="#1A1D27" />,
            <Swatch key="bg3" name="background/tertiary"  light="#F3F4F6"  dark="#12141C" />,
          ]} />
          <SwatchGroup label="Text" swatches={[
            <Swatch key="t1" name="text/primary"   light="#111827" dark="#F9FAFB" />,
            <Swatch key="t2" name="text/secondary" light="#6B7280" dark="#9CA3AF" />,
            <Swatch key="t3" name="text/tertiary"  light="#9CA3AF" dark="#6B7280" />,
          ]} />
          <SwatchGroup label="Border" swatches={[
            <Swatch key="b1" name="border/default"  light="#E5E7EB" dark="#2D3748" border />,
            <Swatch key="b2" name="border/emphasis" light="#D1D5DB" dark="#4A5568" border />,
          ]} />
          <SwatchGroup label="Accent" swatches={[
            <Swatch key="a1" name="accent/blue"       value="#1A4ED8" />,
            <Swatch key="a2" name="accent/blue/hover" value="#1741B8" />,
          ]} />
          <SwatchGroup label="Semantic — critical" swatches={[
            <Swatch key="c1" name="critical/fill"   light="#FED7D7" dark="#3D1515" />,
            <Swatch key="c2" name="critical/text"   light="#9B2C2C" dark="#FC8181" />,
            <Swatch key="c3" name="critical/border" light="#FECACA" dark="#C53030" border />,
          ]} />
          <SwatchGroup label="Semantic — elevated" swatches={[
            <Swatch key="e1" name="elevated/fill"   light="#FEEBC8" dark="#3D2808" />,
            <Swatch key="e2" name="elevated/text"   light="#7B341E" dark="#F6AD55" />,
            <Swatch key="e3" name="elevated/border" light="#FDE68A" dark="#B45309" border />,
          ]} />
          <SwatchGroup label="Semantic — optimal" swatches={[
            <Swatch key="o1" name="optimal/fill"   light="#C6F6D5" dark="#0D2D1A" />,
            <Swatch key="o2" name="optimal/text"   light="#22543D" dark="#68D391" />,
            <Swatch key="o3" name="optimal/border" light="#9AE6B4" dark="#276749" border />,
          ]} />
          <SwatchGroup label="Chart" swatches={[
            <Swatch key="ch1" name="chart/blue"   value="#3B82F6" />,
            <Swatch key="ch2" name="chart/green"  value="#10B981" />,
            <Swatch key="ch3" name="chart/red"    value="#EF4444" />,
            <Swatch key="ch4" name="chart/amber"  value="#F59E0B" />,
            <Swatch key="ch5" name="chart/grey"   value="#D1D5DB" border />,
            <Swatch key="ch6" name="chart/purple" value="#8B5CF6" />,
          ]} />
        </Section>

        {/* ── Typography ── */}
        <Section title="Typography scale">
          <TypeSample name="Label/10/Uppercase" sample="SHIPMENT STATUS · ACTIVE" style={{ fontSize: "10px", fontWeight: 400, letterSpacing: "0.07em", textTransform: "uppercase" }} />
          <TypeSample name="Label/11/Regular"   sample="Monitoring 42 active shipments" style={{ fontSize: "11px", fontWeight: 400 }} />
          <TypeSample name="Label/11/Medium"    sample="Laycan breach risk" style={{ fontSize: "11px", fontWeight: 500 }} />
          <TypeSample name="Body/12/Regular"    sample="Counterparty: Vitol Asia Pte. Ltd." style={{ fontSize: "12px", fontWeight: 400 }} />
          <TypeSample name="Body/12/Medium"     sample="Maran Gas Apollonia" style={{ fontSize: "12px", fontWeight: 500 }} />
          <TypeSample name="Body/13/Regular"    sample="ETA 25 Oct 14:30 UTC — Singapore Terminal 3" style={{ fontSize: "13px", fontWeight: 400 }} />
          <TypeSample name="Body/13/Medium"     sample="$842,500 net demurrage exposure" style={{ fontSize: "13px", fontWeight: 500 }} />
          <TypeSample name="Body/14/Regular"    sample="Laytime remaining: 13h 40m" style={{ fontSize: "14px", fontWeight: 400 }} />
          <TypeSample name="Title/15/Medium"    sample="Demurrage Defender" style={{ fontSize: "15px", fontWeight: 500 }} />
          <TypeSample name="Title/17/Medium"    sample="Cargo risk monitor" style={{ fontSize: "17px", fontWeight: 500 }} />
          <TypeSample name="Title/18/Medium"    sample="BW Magnolia" style={{ fontSize: "18px", fontWeight: 500 }} />
          <TypeSample name="Display/22/Medium"  sample="142" style={{ fontSize: "22px", fontWeight: 500 }} />
          <TypeSample name="Mono/11"            sample="dd_live_a4f8c291be03d7e5f6…" style={{ fontSize: "11px", fontWeight: 400, fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)" }} />
        </Section>

        {/* ── Spacing & radius ── */}
        <Section title="Spacing & radius">
          <div className="grid gap-0" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 48px" }}>
            <div>
              <p style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Gap scale</p>
              <SpacingRow name="gap/xs"  value="4px"  px={4}  />
              <SpacingRow name="gap/sm"  value="6px"  px={6}  />
              <SpacingRow name="gap/md"  value="8px"  px={8}  />
              <SpacingRow name="gap/lg"  value="10px" px={10} />
              <SpacingRow name="gap/xl"  value="12px" px={12} />
              <SpacingRow name="gap/2xl" value="14px" px={14} />
              <SpacingRow name="gap/3xl" value="16px" px={16} />
              <SpacingRow name="gap/4xl" value="20px" px={20} />
              <SpacingRow name="gap/5xl" value="24px" px={24} />
            </div>
            <div>
              <p style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Radius & border</p>
              {[
                { name: "radius/sm",   value: "4px",   px: 4   },
                { name: "radius/md",   value: "8px",   px: 8   },
                { name: "radius/lg",   value: "12px",  px: 12  },
                { name: "radius/xl",   value: "16px",  px: 16  },
                { name: "radius/pill", value: "999px", px: 48  },
                { name: "border/width",value: "0.5px", px: 0.5 },
              ].map(({ name, value, px }) => (
                <div key={name} className="flex items-center gap-4 py-2" style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                  <div style={{ width: "160px", flexShrink: 0 }}>
                    <p style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "var(--text-primary)" }}>{name}</p>
                  </div>
                  <div style={{ width: "40px", height: "24px", backgroundColor: "var(--bg-tertiary)", border: "0.5px solid var(--border-default)", borderRadius: `${Math.min(px, 12)}px`, flexShrink: 0 }} />
                  <p style={{ fontSize: "11px", color: "var(--text-tertiary)", fontFamily: "JetBrains Mono, monospace" }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Component patterns ── */}
        <Section title="Component patterns">

          {/* Badges */}
          <div className="mb-8">
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Risk badges</p>
            <div className="flex flex-wrap gap-3">
              <BadgeRow label="Critical"      bg="#FED7D7" text="#9B2C2C" border="#FECACA" />
              <BadgeRow label="Elevated"      bg="#FEEBC8" text="#7B341E" border="#FDE68A" />
              <BadgeRow label="Optimal"       bg="#C6F6D5" text="#22543D" border="#9AE6B4" />
              <BadgeRow label="Active"        bg="#EFF6FF" text="#1E40AF" border="#BFDBFE" />
              <BadgeRow label="Draft"         bg="#FEEBC8" text="#7B341E" border="#FDE68A" />
              <BadgeRow label="Archived"      bg="#F3F4F6" text="#6B7280" border="#E5E7EB" />
            </div>
          </div>

          {/* Buttons */}
          <div className="mb-8">
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Buttons</p>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: "Primary",   bg: "var(--accent-blue)", color: "#ffffff", border: "none" },
                { label: "Ghost",     bg: "#ffffff",            color: "var(--text-primary)", border: "0.5px solid var(--border-default)" },
                { label: "Danger",    bg: "#FEF2F2",            color: "#9B2C2C", border: "0.5px solid #FECACA" },
                { label: "Success",   bg: "#276749",            color: "#ffffff", border: "none" },
                { label: "Amber",     bg: "#B45309",            color: "#ffffff", border: "none" },
              ].map(({ label, bg, color, border }) => (
                <button key={label} className="rounded-lg px-4 cursor-pointer"
                  style={{ height: "34px", fontSize: "13px", fontWeight: 500, backgroundColor: bg, color, border }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* KPI card */}
          <div className="mb-8">
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>KPI card</p>
            <div className="flex gap-3">
              {[
                { label: "Active shipments",        value: "142",      vc: "var(--text-primary)", sub: "+12.5% vs last cycle",     sc: "var(--optimal-text)"  },
                { label: "Net demurrage exposure",  value: "$842,500", vc: "var(--critical-text)", sub: "Across 18 high-risk vessels", sc: "var(--text-tertiary)" },
                { label: "Claims pending",          value: "24",       vc: "#B45309",              sub: "$1.2M recoverable value",  sc: "var(--text-tertiary)" },
              ].map(({ label, value, vc, sub, sc }) => (
                <div key={label} className="flex-1 rounded-lg border flex flex-col gap-1 p-[12px_14px]"
                  style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-default)", borderWidth: "0.5px" }}>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                  <p style={{ fontSize: "22px", fontWeight: 500, color: vc, lineHeight: 1.2 }}>{value}</p>
                  <p style={{ fontSize: "11px", color: sc }}>{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Laytime bar */}
          <div className="mb-8">
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Laytime bar</p>
            <div className="rounded-xl border p-[14px_16px]" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)", borderWidth: "0.5px" }}>
              <div className="flex items-center gap-4 mb-4">
                {[["var(--chart-blue)","Laytime"],["var(--chart-green)","Dispatch"],["var(--chart-red)","Demurrage"],["var(--chart-grey)","Deductible"]].map(([c,l]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <span className="rounded-sm" style={{ width: "8px", height: "8px", backgroundColor: c }} />
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{l}</span>
                  </div>
                ))}
              </div>
              {[
                { label: "Maran Gas Apol.", b: 48, d: 7, dem: 45, dis: 0 },
                { label: "BW Magnolia",    b: 55, d: 8, dem: 37, dis: 0 },
                { label: "Gaslog Geneva",  b: 60, d: 0, dem: 0,  dis: 40 },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 mb-2 last:mb-0">
                  <span className="flex-shrink-0 text-right" style={{ width: "100px", fontSize: "12px", color: "var(--text-secondary)" }}>{row.label}</span>
                  <div className="flex-1 flex rounded-full overflow-hidden" style={{ height: "10px", backgroundColor: "var(--bg-tertiary)" }}>
                    {row.b > 0 && <div style={{ width: `${row.b}%`, backgroundColor: "var(--chart-blue)" }} />}
                    {row.d > 0 && <div style={{ width: `${row.d}%`, backgroundColor: "var(--chart-grey)" }} />}
                    {row.dem > 0 && <div style={{ width: `${row.dem}%`, backgroundColor: "var(--chart-red)" }} />}
                    {row.dis > 0 && <div style={{ width: `${row.dis}%`, backgroundColor: "var(--chart-green)" }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Input field */}
          <div className="mb-8">
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Form inputs</p>
            <div className="flex gap-4 flex-wrap">
              <div>
                <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "4px" }}>Text input <span style={{ color: "var(--chart-red)" }}>*</span></p>
                <input defaultValue="BW Magnolia" className="outline-none"
                  style={{ width: "200px", height: "34px", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "0 10px", fontSize: "12px", color: "var(--text-primary)", backgroundColor: "var(--bg-primary)" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-blue)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")} />
              </div>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "4px" }}>Select</p>
                <div className="relative">
                  <select className="appearance-none outline-none cursor-pointer"
                    style={{ width: "200px", height: "34px", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "0 28px 0 10px", fontSize: "12px", color: "var(--text-primary)", backgroundColor: "var(--bg-primary)" }}>
                    <option>6h SHINC</option>
                    <option>SHEX</option>
                    <option>WWD</option>
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10">
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="#9CA3AF" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
