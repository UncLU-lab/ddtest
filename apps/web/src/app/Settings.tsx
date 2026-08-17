import { useEffect, useState, type ReactNode } from "react";
import {
  BellRing,
  Building2,
  Calculator,
  Clock,
  Cloud,
  FileOutput,
  FileText,
  Key,
  MessageSquare,
  Plug,
  Shield,
  SlidersHorizontal,
  Ship,
  User,
  Users,
} from "lucide-react";
import { PageHeader } from "./Layout";

type SettingsSection =
  | "profile"
  | "team"
  | "organisation"
  | "notifications"
  | "integrations"
  | "api"
  | "security"
  | "preferences"
  | "calc"
  | "exports"
  | "timezone";

type NotificationKey =
  | "laycanBreach"
  | "demurrageExposure"
  | "newClaim"
  | "sofExtraction"
  | "weeklyDigest";

const STORAGE_KEYS = {
  notifications: "settings.notifications.v1",
  currency: "settings.currency.v1",
  calcBasis: "settings.calc-basis.v1",
  timezone: "settings.timezone.v1",
} as const;

const notificationDefaults: Array<{
  key: NotificationKey;
  label: string;
  desc: string;
  defaultOn: boolean;
}> = [
  {
    key: "laycanBreach",
    label: "Laycan breach alerts",
    desc: "Notify when vessel ETA falls outside the laycan window.",
    defaultOn: true,
  },
  {
    key: "demurrageExposure",
    label: "Demurrage exposure threshold",
    desc: "Alert when exposure exceeds $50,000 per shipment.",
    defaultOn: true,
  },
  {
    key: "newClaim",
    label: "New claim submitted",
    desc: "Notify when a counterparty submits a new claim.",
    defaultOn: true,
  },
  {
    key: "sofExtraction",
    label: "SOF extraction complete",
    desc: "Alert when document extraction finishes processing a PDF.",
    defaultOn: false,
  },
  {
    key: "weeklyDigest",
    label: "Weekly digest",
    desc: "Sunday summary of exposure, claims, and efficiency.",
    defaultOn: true,
  },
];

const integrationRows = [
  {
    icon: <Ship size={16} color="#1A4ED8" />,
    iconBg: "#DBEAFE",
    name: "AIS tracking",
    desc: "Real-time vessel position and ETA data feed.",
  },
  {
    icon: <Cloud size={16} color="#1A4ED8" />,
    iconBg: "#DBEAFE",
    name: "Marine weather",
    desc: "Wind, sea state, and weather event data feed.",
  },
  {
    icon: <FileText size={16} color="#9CA3AF" />,
    iconBg: "#F3F4F6",
    name: "SOF email ingestion",
    desc: "Auto-import SOF documents from inbox.",
  },
  {
    icon: <MessageSquare size={16} color="#9CA3AF" />,
    iconBg: "#F3F4F6",
    name: "Slack alerts",
    desc: "Push critical alerts to Slack channels.",
  },
];

const currencyOptions = ["USD", "EUR", "GBP", "SGD"];
const calcBasisOptions = ["6h SHINC", "SHEX", "SHINC", "WWD", "CQD"];
const timezoneOptions = [
  "UTC+0 London",
  "UTC+1 CET",
  "UTC+4 Dubai",
  "UTC+8 Singapore",
  "UTC-5 New York",
];

const sidebarSections: Array<{
  label: string;
  items: Array<{ key: SettingsSection; label: string; icon: ReactNode }>;
}> = [
  {
    label: "Account",
    items: [
      { key: "profile", label: "Profile", icon: <User size={14} /> },
      { key: "team", label: "Team", icon: <Users size={14} /> },
      { key: "organisation", label: "Organisation", icon: <Building2 size={14} /> },
      { key: "notifications", label: "Notifications", icon: <BellRing size={14} /> },
    ],
  },
  {
    label: "Integrations",
    items: [
      { key: "integrations", label: "Integrations", icon: <Plug size={14} /> },
      { key: "api", label: "API access", icon: <Key size={14} /> },
      { key: "security", label: "Security", icon: <Shield size={14} /> },
    ],
  },
  {
    label: "Preferences",
    items: [
      { key: "preferences", label: "Preferences", icon: <SlidersHorizontal size={14} /> },
      { key: "calc", label: "Calculation defaults", icon: <Calculator size={14} /> },
      { key: "exports", label: "Export formats", icon: <FileOutput size={14} /> },
      { key: "timezone", label: "Time & timezone", icon: <Clock size={14} /> },
    ],
  },
];

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readStringLocalStorage(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocalStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota and privacy mode failures.
  }
}

function NavItem({
  item,
  active,
  onClick,
}: {
  item: { key: SettingsSection; label: string; icon: ReactNode };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="w-full text-left flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A4ED8] focus-visible:ring-offset-2"
      style={{
        padding: "7px 14px",
        backgroundColor: active ? "#F3F4F6" : "transparent",
        color: active ? "#1A4ED8" : "#374151",
        fontWeight: active ? 600 : 400,
        fontSize: "12px",
        border: "none",
        borderLeft: active ? "2px solid #1A4ED8" : "2px solid transparent",
        borderRadius: 0,
      }}
    >
      <span style={{ color: active ? "#1A4ED8" : "#9CA3AF", flexShrink: 0 }}>{item.icon}</span>
      {item.label}
    </button>
  );
}

function PanelCard({
  title,
  children,
  note,
}: {
  title: string;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <section
      className="rounded-xl border p-[14px_16px]"
      style={{ borderColor: "#E5E7EB", borderWidth: "0.5px", backgroundColor: "#ffffff" }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {title}
          </h3>
          {note ? (
            <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "4px" }}>{note}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function SettingRow({
  id,
  label,
  desc,
  children,
  last,
}: {
  id: string;
  label: string;
  desc?: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-[10px]"
      style={{ borderBottom: last ? "none" : "0.5px solid #F3F4F6" }}
    >
      <div className="pr-4">
        <label htmlFor={id} style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>
          {label}
        </label>
        {desc ? (
          <p id={`${id}-desc`} style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "1px" }}>
            {desc}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Select({
  id,
  value,
  options,
  onChange,
  describedBy,
}: {
  id: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  describedBy?: string;
}) {
  return (
    <div className="relative" style={{ width: "220px" }}>
      <select
        id={id}
        value={value}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none outline-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A4ED8] focus-visible:ring-offset-2"
        style={{
          height: "34px",
          border: "0.5px solid #E5E7EB",
          borderRadius: "8px",
          padding: "0 30px 0 10px",
          fontSize: "12px",
          color: "#111827",
          backgroundColor: "#ffffff",
        }}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        aria-hidden="true"
      >
        <path d="M2 3.5L5 6.5L8 3.5" stroke="#9CA3AF" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function LocalToggle({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 accent-[#1A4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A4ED8] focus-visible:ring-offset-2"
    />
  );
}

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [notificationPrefs, setNotificationPrefs] = useState<Record<NotificationKey, boolean>>(() =>
    readLocalStorage<Record<NotificationKey, boolean>>(STORAGE_KEYS.notifications, {
      laycanBreach: true,
      demurrageExposure: true,
      newClaim: true,
      sofExtraction: false,
      weeklyDigest: true,
    }),
  );
  const [currency, setCurrency] = useState(() => readStringLocalStorage(STORAGE_KEYS.currency, "USD"));
  const [calcBasis, setCalcBasis] = useState(() => readStringLocalStorage(STORAGE_KEYS.calcBasis, "6h SHINC"));
  const [timezone, setTimezone] = useState(() =>
    readStringLocalStorage(STORAGE_KEYS.timezone, "UTC+0 London"),
  );

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.notifications, notificationPrefs);
  }, [notificationPrefs]);

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.currency, currency);
  }, [currency]);

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.calcBasis, calcBasis);
  }, [calcBasis]);

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.timezone, timezone);
  }, [timezone]);

  const sectionMeta: Record<
    SettingsSection,
    { title: string; description: string }
  > = {
    profile: {
      title: "Profile",
      description: "Account profile will be available after authentication is enabled.",
    },
    team: {
      title: "Team",
      description: "Team management comes later, once organization membership exists.",
    },
    organisation: {
      title: "Organisation",
      description: "Organisation settings coming later.",
    },
    notifications: {
      title: "Notifications",
      description: "Saved on this browser only.",
    },
    integrations: {
      title: "Integrations",
      description: "These integrations are not configured yet.",
    },
    api: {
      title: "API access",
      description: "API access is not configured.",
    },
    security: {
      title: "Security",
      description: "Security settings will be available after authentication is enabled.",
    },
    preferences: {
      title: "Preferences",
      description: "Browser-only preferences for the current device.",
    },
    calc: {
      title: "Calculation defaults",
      description: "Default values for the current shipment and laytime flow.",
    },
    exports: {
      title: "Export formats",
      description: "Export preferences coming later.",
    },
    timezone: {
      title: "Time & timezone",
      description: "Timezone is saved on this browser only.",
    },
  };

  return (
    <div style={{ backgroundColor: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <PageHeader crumbs={[{ label: "Settings" }]} />

      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 104px)" }}>
        <aside
          className="flex-shrink-0 overflow-y-auto"
          style={{ width: "180px", borderRight: "0.5px solid #E5E7EB", padding: "14px 0", backgroundColor: "#ffffff" }}
        >
          {sidebarSections.map((section, index) => (
            <div key={section.label} style={{ marginBottom: "4px" }}>
              <p
                style={{
                  fontSize: "10px",
                  color: "#9CA3AF",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "8px 14px 4px",
                }}
              >
                {section.label}
              </p>
              {section.items.map((item) => (
                <NavItem
                  key={item.key}
                  item={item}
                  active={activeSection === item.key}
                  onClick={() => setActiveSection(item.key)}
                />
              ))}
              {index < sidebarSections.length - 1 ? (
                <div style={{ borderTop: "0.5px solid #E5E7EB", margin: "10px 0" }} />
              ) : null}
            </div>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto" style={{ padding: "20px 24px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#111827", marginBottom: "4px" }}>
              {sectionMeta[activeSection].title}
            </h2>
            <p style={{ fontSize: "12px", color: "#6B7280" }}>{sectionMeta[activeSection].description}</p>
          </div>

          {activeSection === "profile" ? (
            <PanelCard
              title="Profile"
              note="No authenticated profile data is available yet."
            >
              <p style={{ fontSize: "12px", color: "#374151", lineHeight: 1.6 }}>
                Profile not configured. Account profile details will become available after authentication is
                enabled.
              </p>
            </PanelCard>
          ) : null}

          {activeSection === "team" ? (
            <PanelCard title="Team">
              <p style={{ fontSize: "12px", color: "#374151", lineHeight: 1.6 }}>
                Team management coming later.
              </p>
            </PanelCard>
          ) : null}

          {activeSection === "organisation" ? (
            <PanelCard title="Organisation">
              <p style={{ fontSize: "12px", color: "#374151", lineHeight: 1.6 }}>
                Organisation settings coming later.
              </p>
            </PanelCard>
          ) : null}

          {activeSection === "notifications" ? (
            <PanelCard title="Notifications" note="Saved on this browser only.">
              {notificationDefaults.map((item, index) => {
                const inputId = `notification-${item.key}`;
                const descId = `${inputId}-desc`;
                return (
                  <div
                    key={item.key}
                    className="flex items-start justify-between gap-4 py-[10px]"
                    style={{
                      borderBottom: index < notificationDefaults.length - 1 ? "0.5px solid #F3F4F6" : "none",
                    }}
                  >
                    <div className="pr-4">
                      <label htmlFor={inputId} style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>
                        {item.label}
                      </label>
                      <p id={descId} style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "1px" }}>
                        {item.desc}
                      </p>
                    </div>
                    <LocalToggle
                      id={inputId}
                      checked={notificationPrefs[item.key]}
                      onChange={(value) =>
                        setNotificationPrefs((prev) => ({
                          ...prev,
                          [item.key]: value,
                        }))
                      }
                    />
                  </div>
                );
              })}
            </PanelCard>
          ) : null}

          {activeSection === "integrations" ? (
            <PanelCard title="Integrations">
              {integrationRows.map((row, index) => (
                <div
                  key={row.name}
                  className="flex items-center gap-3 py-[11px]"
                  style={{
                    borderBottom: index < integrationRows.length - 1 ? "0.5px solid #F3F4F6" : "none",
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ width: "34px", height: "34px", backgroundColor: row.iconBg, border: "0.5px solid #E5E7EB" }}
                  >
                    {row.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "12px", fontWeight: 500, color: "#111827" }}>{row.name}</p>
                    <p style={{ fontSize: "11px", color: "#9CA3AF" }}>{row.desc}</p>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      color: "#6B7280",
                      backgroundColor: "#F3F4F6",
                      border: "0.5px solid #E5E7EB",
                      borderRadius: "999px",
                      padding: "2px 8px",
                      flexShrink: 0,
                    }}
                  >
                    Not configured
                  </span>
                </div>
              ))}
            </PanelCard>
          ) : null}

          {activeSection === "api" ? (
            <PanelCard title="API access">
              <p style={{ fontSize: "12px", color: "#374151", lineHeight: 1.6 }}>
                API access not configured.
              </p>
            </PanelCard>
          ) : null}

          {activeSection === "security" ? (
            <PanelCard title="Security">
              <p style={{ fontSize: "12px", color: "#374151", lineHeight: 1.6 }}>
                Security settings will be available after authentication is enabled.
              </p>
            </PanelCard>
          ) : null}

          {activeSection === "preferences" ? (
            <PanelCard title="Preferences" note="Saved on this browser only.">
              <SettingRow
                id="currency"
                label="Currency"
                desc="Used for displayed exposure and claim values."
              >
                <Select
                  id="currency"
                  value={currency}
                  options={currencyOptions}
                  onChange={setCurrency}
                  describedBy="currency-desc"
                />
              </SettingRow>
            </PanelCard>
          ) : null}

          {activeSection === "calc" ? (
            <PanelCard title="Calculation defaults" note="Saved on this browser only.">
              <SettingRow
                id="calc-basis"
                label="Default time counting basis"
                desc="Default basis used for new shipments in the current laytime flow."
                last
              >
                <Select
                  id="calc-basis"
                  value={calcBasis}
                  options={calcBasisOptions}
                  onChange={setCalcBasis}
                  describedBy="calc-basis-desc"
                />
              </SettingRow>
            </PanelCard>
          ) : null}

          {activeSection === "exports" ? (
            <PanelCard title="Export formats">
              <p style={{ fontSize: "12px", color: "#374151", lineHeight: 1.6 }}>
                Export preferences coming later.
              </p>
            </PanelCard>
          ) : null}

          {activeSection === "timezone" ? (
            <PanelCard title="Time & timezone" note="Saved on this browser only.">
              <SettingRow
                id="timezone"
                label="Timezone"
                desc="Used for ETA display and clock calculations."
                last
              >
                <Select
                  id="timezone"
                  value={timezone}
                  options={timezoneOptions}
                  onChange={setTimezone}
                  describedBy="timezone-desc"
                />
              </SettingRow>
            </PanelCard>
          ) : null}
        </main>
      </div>
    </div>
  );
}
