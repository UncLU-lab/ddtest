import { useState } from "react";
import {
  User, Users, Building2, BellRing, Plug, Key,
  Shield, Calculator, FileOutput, Clock, Ship, Cloud, FileText,
  Eye, Copy, RotateCcw, Plus, MessageSquare,
} from "lucide-react";
import { PageHeader } from "./Layout";

type SettingsSection = "profile" | "team" | "organisation" | "notifications" | "integrations" | "api" | "security" | "calc" | "exports" | "timezone";

// ─── Sidebar config ───────────────────────────────────────────────────────────

const sidebarSections = [
  {
    label: "Account",
    items: [
      { key: "profile" as SettingsSection,       label: "Profile",        icon: <User size={14} /> },
      { key: "team" as SettingsSection,           label: "Team",           icon: <Users size={14} /> },
      { key: "organisation" as SettingsSection,   label: "Organisation",   icon: <Building2 size={14} /> },
      { key: "notifications" as SettingsSection,  label: "Notifications",  icon: <BellRing size={14} /> },
    ],
  },
  {
    label: "Integrations",
    items: [
      { key: "integrations" as SettingsSection,   label: "Integrations",   icon: <Plug size={14} /> },
      { key: "api" as SettingsSection,            label: "API access",     icon: <Key size={14} /> },
      { key: "security" as SettingsSection,       label: "Security",       icon: <Shield size={14} /> },
    ],
  },
  {
    label: "Preferences",
    items: [
      { key: "calc" as SettingsSection,           label: "Calc defaults",  icon: <Calculator size={14} /> },
      { key: "exports" as SettingsSection,        label: "Export formats", icon: <FileOutput size={14} /> },
      { key: "timezone" as SettingsSection,       label: "Time & timezone",icon: <Clock size={14} /> },
    ],
  },
];

const teamMembers = [
  { initials: "WJ", bg: "#DBEAFE", text: "#1E40AF", name: "Will Johnson",    email: "will@tradeops.com",    role: "Admin",            roleBg: "#EFF6FF",  roleText: "#1E40AF",  isAdmin: true  },
  { initials: "SA", bg: "#D1FAE5", text: "#065F46", name: "Sophie Adeyemi",  email: "s.adeyemi@tradeops.com", role: "Claims analyst",  roleBg: "#C6F6D5",  roleText: "#22543D",  isAdmin: false },
  { initials: "MK", bg: "#F3F4F6", text: "#374151", name: "Mark Kowalski",   email: "m.kowalski@tradeops.com", role: "Ops viewer",   roleBg: "#F3F4F6",  roleText: "#374151",  isAdmin: false },
  { initials: "PL", bg: "#FEF3C7", text: "#92400E", name: "Priya Larsson",   email: "p.larsson@tradeops.com",  role: "Commercial",  roleBg: "#FEEBC8",  roleText: "#7B341E",  isAdmin: false },
];

const notifications = [
  { label: "Laycan breach alerts",           desc: "Notify when vessel ETA falls outside laycan window",  on: true  },
  { label: "Demurrage exposure threshold",   desc: "Alert when exposure exceeds $50,000 per shipment",     on: true  },
  { label: "New claim submitted",            desc: "Notify when a counterparty submits a new claim",        on: true  },
  { label: "SOF extraction complete",        desc: "Alert when AI extraction finishes processing a PDF",   on: false },
  { label: "Weekly digest",                  desc: "Sunday summary of exposure, claims and efficiency",     on: true  },
];

const integrations = [
  { icon: <Ship size={16} color="#1A4ED8" />,         iconBg: "#DBEAFE", name: "AIS tracking",          desc: "Real-time vessel position and ETA data",         status: "connected" as const  },
  { icon: <Cloud size={16} color="#1A4ED8" />,         iconBg: "#DBEAFE", name: "Marine weather",        desc: "Wind, sea state and weather event data feed",    status: "connected" as const  },
  { icon: <FileText size={16} color="#9CA3AF" />,      iconBg: "#F3F4F6", name: "SOF email ingestion",   desc: "Auto-import SOF documents from inbox",           status: "pending" as const    },
  { icon: <MessageSquare size={16} color="#9CA3AF" />, iconBg: "#F3F4F6", name: "Slack alerts",          desc: "Push critical alerts to Slack channels",         status: "disconnected" as const },
];

const STATUS_BADGE = {
  connected:    { bg: "#C6F6D5", text: "#22543D",  label: "Connected"     },
  pending:      { bg: "#FEEBC8", text: "#7B341E",  label: "Pending setup" },
  disconnected: { bg: "#F3F4F6", text: "#6B7280",  label: "Not connected" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavItem({ item, active, onClick }: { item: typeof sidebarSections[0]["items"][0]; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      className="w-full text-left flex items-center gap-2 transition-colors cursor-pointer relative"
      style={{
        padding: "7px 14px",
        backgroundColor: active || hov ? "#F3F4F6" : "transparent",
        color: active ? "#1A4ED8" : "#374151",
        fontWeight: active ? 500 : 400,
        fontSize: "12px",
        border: "none",
        borderLeft: active ? "2px solid #1A4ED8" : "2px solid transparent",
        borderRadius: 0,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      <span style={{ color: active ? "#1A4ED8" : "#9CA3AF", flexShrink: 0 }}>{item.icon}</span>
      {item.label}
    </button>
  );
}

function FieldRow({ label, desc, children, last }: {
  label: string; desc?: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-[10px]"
      style={{ borderBottom: last ? "none" : "0.5px solid #F3F4F6" }}>
      <div>
        <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{label}</p>
        {desc && <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "1px" }}>{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function FieldInput({ value, placeholder, onChange }: { value?: string; placeholder?: string; onChange?: (v: string) => void }) {
  return (
    <input value={value ?? ""} placeholder={placeholder} className="outline-none"
      onChange={(e) => onChange?.(e.target.value)}
      style={{ width: "180px", height: "32px", border: "0.5px solid #E5E7EB", borderRadius: "8px", padding: "0 10px", fontSize: "12px", color: "#111827", backgroundColor: "#ffffff" }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "#1A4ED8")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")} />
  );
}

function FieldSelect({ value, options, onChange }: { value: string; options: string[]; onChange?: (v: string) => void }) {
  return (
    <div className="relative" style={{ width: "180px" }}>
      <select value={value} onChange={(e) => onChange?.(e.target.value)} className="w-full appearance-none outline-none cursor-pointer"
        style={{ height: "32px", border: "0.5px solid #E5E7EB", borderRadius: "8px", padding: "0 26px 0 10px", fontSize: "12px", color: "#111827", backgroundColor: "#ffffff" }}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10">
        <path d="M2 3.5L5 6.5L8 3.5" stroke="#9CA3AF" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
      className="relative flex-shrink-0 cursor-pointer transition-colors"
      style={{
        width: "36px", height: "20px", borderRadius: "999px",
        backgroundColor: on ? "#1A4ED8" : "#E5E7EB",
        border: on ? "none" : "0.5px solid #D1D5DB",
        padding: 0,
      }}>
      <span className="absolute top-[3px] transition-all"
        style={{
          width: "14px", height: "14px", borderRadius: "50%",
          backgroundColor: "#ffffff",
          left: on ? "19px" : "3px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
        }} />
    </button>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-[14px_16px]"
      style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}>
      <div className="flex items-center justify-between mb-3">
        <p style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function GhostBtn({ children, onClick, danger }: { children: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2.5 rounded-md border transition-colors cursor-pointer"
      style={{
        height: "26px", fontSize: "11px",
        color: danger ? "#9B2C2C" : "#374151",
        borderColor: danger ? "#FECACA" : "#E5E7EB",
        borderWidth: "0.5px",
        backgroundColor: danger ? "#FEF2F2" : "#ffffff",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = danger ? "#FEE2E2" : "#F9FAFB")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = danger ? "#FEF2F2" : "#ffffff")}>
      {children}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [toggles, setToggles] = useState(notifications.map((n) => n.on));
  const [keyRevealed, setKeyRevealed] = useState(false);

  const savedProfile = { fullName: "Will Johnson", email: "will@tradeops.com", role: "Ops director", timezone: "UTC+0 London" };
  const [profile, setProfile] = useState(savedProfile);
  const [committedProfile, setCommittedProfile] = useState(savedProfile);
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);
  const [calcDefaults, setCalcDefaults] = useState("6h SHINC");
  const [currency, setCurrency] = useState("USD");
  const profileDirty = JSON.stringify(profile) !== JSON.stringify(committedProfile);

  function saveProfile() {
    setCommittedProfile(profile);
    setProfileSavedMsg(true);
    setTimeout(() => setProfileSavedMsg(false), 2000);
  }
  function discardProfile() {
    setProfile(committedProfile);
  }

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Settings" }]} />

      {/* ── Body ── */}
      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 104px)" }}>

        {/* ── Sidebar ── */}
        <div className="flex-shrink-0 overflow-y-auto"
          style={{ width: "180px", borderRight: "0.5px solid #E5E7EB", padding: "14px 0", backgroundColor: "#ffffff" }}>
          {sidebarSections.map((section, si) => (
            <div key={section.label} style={{ marginBottom: "4px" }}>
              <p style={{ fontSize: "10px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 14px 4px" }}>
                {section.label}
              </p>
              {section.items.map((item) => (
                <NavItem key={item.key} item={item} active={activeSection === item.key} onClick={() => setActiveSection(item.key)} />
              ))}
              {si < sidebarSections.length - 1 && (
                <div style={{ borderTop: "0.5px solid #E5E7EB", margin: "10px 0" }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "20px 24px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 500, color: "#111827", marginBottom: "4px" }}>Profile &amp; account</h2>
          <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "20px" }}>
            Manage your personal details, team access, notifications and integrations.
          </p>

          <div className="flex flex-col gap-3.5">

            {/* Card 1 — Personal details */}
            <Card title="Personal details">
              <FieldRow label="Full name" desc="Your display name across the platform">
                <FieldInput value={profile.fullName} onChange={(v) => setProfile({ ...profile, fullName: v })} />
              </FieldRow>
              <FieldRow label="Email" desc="Used for notifications and login">
                <FieldInput value={profile.email} onChange={(v) => setProfile({ ...profile, email: v })} />
              </FieldRow>
              <FieldRow label="Role" desc="Your function within the organisation">
                <FieldSelect value={profile.role} onChange={(v) => setProfile({ ...profile, role: v })} options={["Ops director", "Claims analyst", "Commercial", "Admin"]} />
              </FieldRow>
              <FieldRow label="Timezone" desc="Used for ETA display and clock calculations" last>
                <FieldSelect value={profile.timezone} onChange={(v) => setProfile({ ...profile, timezone: v })} options={["UTC+0 London", "UTC+1 CET", "UTC+4 Dubai", "UTC+8 Singapore", "UTC−5 New York"]} />
              </FieldRow>
              <div className="flex items-center justify-end gap-2 mt-3 pt-3"
                style={{ borderTop: "0.5px solid #F3F4F6" }}>
                {profileSavedMsg && <span style={{ fontSize: "11px", color: "#22543D", marginRight: "auto" }}>Saved</span>}
                <button
                  disabled={!profileDirty}
                  onClick={discardProfile}
                  className="px-3 rounded-md border transition-colors cursor-pointer"
                  style={{ height: "32px", fontSize: "12px", color: profileDirty ? "#374151" : "#D1D5DB", borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff", cursor: profileDirty ? "pointer" : "default" }}
                  onMouseEnter={(e) => profileDirty && ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff")}>
                  Discard
                </button>
                <button
                  disabled={!profileDirty}
                  onClick={saveProfile}
                  className="px-3 rounded-md transition-colors cursor-pointer"
                  style={{ height: "32px", fontSize: "12px", fontWeight: 500, color: "#ffffff", backgroundColor: profileDirty ? "#1A4ED8" : "#93C5FD", border: "none", cursor: profileDirty ? "pointer" : "default" }}
                  onMouseEnter={(e) => profileDirty && ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = profileDirty ? "#1A4ED8" : "#93C5FD")}>
                  Save changes
                </button>
              </div>
            </Card>

            {/* Card 2 — Team & roles */}
            <Card title="Team & roles"
              action={
                <button className="flex items-center gap-1 px-2.5 rounded-md transition-colors cursor-pointer"
                  style={{ height: "26px", fontSize: "11px", fontWeight: 500, color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
                  <Plus size={10} /> Invite member
                </button>
              }>
              {teamMembers.map((m, i) => (
                <div key={m.initials} className="flex items-center gap-2.5 py-[10px]"
                  style={{ borderBottom: i < teamMembers.length - 1 ? "0.5px solid #F3F4F6" : "none" }}>
                  <div className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{ width: "32px", height: "32px", backgroundColor: m.bg }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: m.text }}>{m.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{m.name}</p>
                    <p style={{ fontSize: "11px", color: "#9CA3AF" }}>{m.email}</p>
                  </div>
                  <span className="rounded-full px-2 py-0.5 font-medium flex-shrink-0"
                    style={{ fontSize: "10px", backgroundColor: m.roleBg, color: m.roleText }}>{m.role}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <GhostBtn>Edit</GhostBtn>
                    {!m.isAdmin && <GhostBtn danger>Remove</GhostBtn>}
                  </div>
                </div>
              ))}
            </Card>

            {/* Card 3 — Notifications */}
            <Card title="Notifications">
              {notifications.map((n, i) => (
                <div key={n.label} className="flex items-center justify-between py-[10px]"
                  style={{ borderBottom: i < notifications.length - 1 ? "0.5px solid #F3F4F6" : "none" }}>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{n.label}</p>
                    <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "1px" }}>{n.desc}</p>
                  </div>
                  <Toggle on={toggles[i]} onChange={(v) => setToggles((prev) => prev.map((t, j) => j === i ? v : t))} />
                </div>
              ))}
            </Card>

            {/* Card 4 — Integrations */}
            <Card title="Integrations">
              {integrations.map((intg, i) => {
                const s = STATUS_BADGE[intg.status];
                return (
                  <div key={intg.name} className="flex items-center gap-3 py-[11px]"
                    style={{ borderBottom: i < integrations.length - 1 ? "0.5px solid #F3F4F6" : "none" }}>
                    <div className="flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{ width: "34px", height: "34px", backgroundColor: intg.iconBg, border: "0.5px solid #E5E7EB" }}>
                      {intg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{intg.name}</p>
                      <p style={{ fontSize: "11px", color: "#9CA3AF" }}>{intg.desc}</p>
                    </div>
                    <span className="rounded-full px-2 py-0.5 font-medium flex-shrink-0"
                      style={{ fontSize: "10px", backgroundColor: s.bg, color: s.text }}>{s.label}</span>
                    {intg.status === "connected" ? (
                      <GhostBtn>Configure</GhostBtn>
                    ) : (
                      <button className="px-2.5 rounded-md transition-colors cursor-pointer flex-shrink-0"
                        style={{ height: "26px", fontSize: "11px", fontWeight: 500, color: "#ffffff", backgroundColor: "#1A4ED8", border: "none" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1e40af")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1A4ED8")}>
                        Connect
                      </button>
                    )}
                  </div>
                );
              })}
            </Card>

            {/* Card 5 — API access */}
            <Card title="API access">
              <FieldRow label="Calculation defaults" desc="Default time counting basis for new shipments">
                <FieldSelect value={calcDefaults} onChange={setCalcDefaults} options={["6h SHINC", "SHEX", "SHINC", "WWD", "CQD"]} />
              </FieldRow>
              <FieldRow label="Currency" desc="Display currency for exposure and claim values" last>
                <FieldSelect value={currency} onChange={setCurrency} options={["USD", "EUR", "GBP", "SGD"]} />
              </FieldRow>

              {/* API key block */}
              <div className="mt-3 pt-3" style={{ borderTop: "0.5px solid #F3F4F6" }}>
                <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "8px" }}>API key</p>
                <div className="flex items-center justify-between rounded-lg px-[11px] py-2"
                  style={{ backgroundColor: "#F9FAFB", border: "0.5px solid #E5E7EB" }}>
                  <span style={{ fontSize: "11px", color: "#9CA3AF", fontFamily: "monospace", letterSpacing: "0.04em" }}>
                    {keyRevealed ? "dd_live_a4f8c291be03d7e5f62a0198d391c84a" : "dd_live_••••••••••••••••••••••••••••••••"}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                    <GhostBtn onClick={() => setKeyRevealed(!keyRevealed)}>
                      <Eye size={10} /> {keyRevealed ? "Hide" : "Reveal"}
                    </GhostBtn>
                    <GhostBtn><Copy size={10} /> Copy</GhostBtn>
                    <GhostBtn danger><RotateCcw size={10} /> Rotate</GhostBtn>
                  </div>
                </div>
                <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "6px" }}>
                  Last used 2 hours ago &nbsp;·&nbsp; Created 14 Mar 2023
                </p>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
