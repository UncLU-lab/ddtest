import { useState } from "react";
import {
  Anchor, Bell, Search, AlertTriangle, Info, CheckCircle,
  ChevronDown, Edit3, LayoutTemplate, Upload, Ship,
  FileText, Users, Box, Inbox, X,
} from "lucide-react";

type NavTab = "Operations" | "Claims" | "Analytics" | "Vessels";

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 01 — Top navigation bar
// ═══════════════════════════════════════════════════════════════════════════════

export type NavPillVariant = "default" | "hover" | "active";

function NavPill({ label, state }: { label: string; state: NavPillVariant }) {
  const [hov, setHov] = useState(false);
  const isActive = state === "active";
  const isHov = hov || state === "hover";
  return (
    <button
      className="rounded-lg cursor-pointer transition-colors"
      style={{
        padding: "5px 10px", fontSize: "12px",
        fontWeight: isActive ? 500 : 400,
        backgroundColor: isActive || isHov ? "var(--bg-secondary)" : "transparent",
        color: isActive || isHov ? "var(--text-primary)" : "var(--text-secondary)",
        border: "none",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 02 — KPI card
// ═══════════════════════════════════════════════════════════════════════════════

type KPIColour = "neutral" | "red" | "amber" | "green" | "blue";

const KPI_COLOUR: Record<KPIColour, string> = {
  neutral: "var(--text-primary)",
  red:     "var(--critical-text)",
  amber:   "var(--elevated-text)",
  green:   "var(--optimal-text)",
  blue:    "var(--accent-blue)",
};

export function KPICard({ label, value, sub, colour = "neutral" }: {
  label: string; value: string; sub?: string; colour?: KPIColour;
}) {
  return (
    <div className="flex flex-col gap-1" style={{ padding: "11px 13px", borderRadius: "var(--radius-lg)", backgroundColor: "var(--bg-secondary)", minWidth: "120px" }}>
      <p style={{ fontSize: "10px", fontWeight: 400, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
      <p style={{ fontSize: "22px", fontWeight: 500, color: KPI_COLOUR[colour], lineHeight: 1.2 }}>{value}</p>
      {sub && <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{sub}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 03 — Badge / pill
// ═══════════════════════════════════════════════════════════════════════════════

type BadgeColour = "blue" | "green" | "amber" | "red" | "gray" | "purple";
type BadgeSize   = "standard" | "compact";

const BADGE_COLOUR: Record<BadgeColour, { bg: string; text: string }> = {
  blue:   { bg: "var(--bg-secondary)",    text: "var(--accent-blue)"   },
  green:  { bg: "var(--optimal-fill)",    text: "var(--optimal-text)"  },
  amber:  { bg: "var(--elevated-fill)",   text: "var(--elevated-text)" },
  red:    { bg: "var(--critical-fill)",   text: "var(--critical-text)" },
  gray:   { bg: "var(--bg-tertiary)",     text: "var(--text-secondary)"},
  purple: { bg: "#EDE9FE",               text: "#5B21B6"              },
};

export function Badge({ label, colour = "blue", size = "standard", dot }: {
  label: string; colour?: BadgeColour; size?: BadgeSize; dot?: boolean;
}) {
  const c = BADGE_COLOUR[colour];
  return (
    <span className="inline-flex items-center" style={{ padding: "3px 8px", borderRadius: "var(--radius-pill)", backgroundColor: c.bg, gap: "4px" }}>
      {dot && <span className="rounded-full flex-shrink-0" style={{ width: "5px", height: "5px", backgroundColor: c.text }} />}
      <span style={{ fontSize: size === "compact" ? "9px" : "10px", color: c.text, fontWeight: 400 }}>{label}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 04 — Risk badge (extends Badge, fixed variants)
// ═══════════════════════════════════════════════════════════════════════════════

type RiskLevel = "critical" | "elevated" | "optimal";

const RISK_MAP: Record<RiskLevel, { colour: BadgeColour; label: string }> = {
  critical: { colour: "red",   label: "Critical" },
  elevated: { colour: "amber", label: "Elevated" },
  optimal:  { colour: "green", label: "Optimal"  },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const { colour, label } = RISK_MAP[level];
  return <Badge label={label} colour={colour} dot />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 05 — Toggle switch
// ═══════════════════════════════════════════════════════════════════════════════

export function Toggle({ on, onChange }: { on: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange?.(!on)}
      className="relative flex-shrink-0 cursor-pointer transition-colors"
      style={{ width: "36px", height: "20px", borderRadius: "var(--radius-pill)", backgroundColor: on ? "var(--accent-blue)" : "var(--border-default)", border: on ? "none" : "0.5px solid var(--border-emphasis)", padding: 0 }}>
      <span className="absolute transition-all"
        style={{ width: "14px", height: "14px", borderRadius: "50%", backgroundColor: "#ffffff", top: "3px", left: on ? "19px" : "3px", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 06 — Data table row
// ═══════════════════════════════════════════════════════════════════════════════

type RowState     = "default" | "hover" | "selected" | "deductible";
type AccentColour = "red" | "amber" | "green";

const ACCENT_COLOR: Record<AccentColour, string> = {
  red: "var(--chart-red)", amber: "var(--chart-amber)", green: "var(--chart-green)",
};

export function TableRow({ cells, state = "default", accentBar, accentColour = "red" }: {
  cells: React.ReactNode[];
  state?: RowState;
  accentBar?: boolean;
  accentColour?: AccentColour;
}) {
  const [hov, setHov] = useState(false);
  const bg = state === "deductible" ? "var(--elevated-fill)" : (state === "selected" || state === "hover" || hov) ? "var(--bg-secondary)" : "transparent";
  return (
    <div className="relative flex items-center"
      style={{ minHeight: "40px", padding: "10px 10px 10px " + (accentBar ? "16px" : "10px"), borderBottom: "0.5px solid var(--border-default)", backgroundColor: bg, border: state === "selected" ? "0.5px solid var(--border-emphasis)" : undefined, gap: "12px", cursor: "pointer" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      {accentBar && (
        <div className="absolute left-0 top-[3px] bottom-[3px]" style={{ width: "3px", backgroundColor: ACCENT_COLOR[accentColour] }} />
      )}
      {cells.map((cell, i) => <div key={i} className="flex-1 min-w-0">{cell}</div>)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 07 — Form field group
// ═══════════════════════════════════════════════════════════════════════════════

type InputType  = "text" | "select" | "date" | "number" | "textarea";
type InputState = "default" | "focused" | "filled" | "error" | "disabled";

export function FormField({ label, required, hint, error, type = "text", state = "default", value, placeholder, options }: {
  label: string; required?: boolean; hint?: string; error?: string;
  type?: InputType; state?: InputState; value?: string; placeholder?: string; options?: string[];
}) {
  const [focused, setFocused] = useState(false);
  const isError    = state === "error";
  const isDisabled = state === "disabled";
  const borderColor = isError ? "var(--critical-border)" : focused ? "var(--accent-blue)" : "var(--border-default)";
  const borderWidth = focused && !isError ? "1px" : "0.5px";
  const baseStyle: React.CSSProperties = {
    border: `${borderWidth} solid ${borderColor}`, borderRadius: "var(--radius-md)",
    padding: "7px 10px", fontSize: "12px", width: "100%", outline: "none",
    backgroundColor: isDisabled ? "var(--bg-secondary)" : "var(--bg-primary)",
    color: isDisabled ? "var(--text-tertiary)" : "var(--text-primary)",
  };

  return (
    <div className="flex flex-col" style={{ gap: "var(--gap-xs)" }}>
      <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-primary)" }}>
        {label}{required && <span style={{ color: "var(--critical-text)", marginLeft: "2px" }}>*</span>}
      </label>
      {type === "textarea" ? (
        <textarea placeholder={placeholder} disabled={isDisabled}
          style={{ ...baseStyle, height: "80px", resize: "none" }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      ) : type === "select" ? (
        <div className="relative">
          <select defaultValue={value} disabled={isDisabled} className="appearance-none cursor-pointer w-full"
            style={{ ...baseStyle, height: "34px", paddingRight: "28px" }}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
            {options?.map((o) => <option key={o}>{o}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
        </div>
      ) : (
        <input type={type} defaultValue={value} placeholder={placeholder} disabled={isDisabled}
          style={{ ...baseStyle, height: "34px" }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      )}
      {hint && !error && <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{hint}</p>}
      {error && <p style={{ fontSize: "11px", color: "var(--critical-text)" }}>{error}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 08 — Button
// ═══════════════════════════════════════════════════════════════════════════════

type ButtonType  = "primary" | "secondary" | "danger" | "success" | "ghost" | "link";
type ButtonSize  = "default" | "small";
type ButtonState = "default" | "hover" | "disabled" | "loading";

const BTN_STYLE: Record<ButtonType, { bg: string; color: string; border: string }> = {
  primary:   { bg: "var(--accent-blue)",    color: "#ffffff",                 border: "none" },
  secondary: { bg: "transparent",           color: "var(--text-primary)",     border: "0.5px solid var(--border-default)" },
  danger:    { bg: "var(--critical-fill)",  color: "var(--critical-text)",    border: "0.5px solid var(--critical-border)" },
  success:   { bg: "var(--optimal-fill)",   color: "var(--optimal-text)",     border: "0.5px solid var(--optimal-border)" },
  ghost:     { bg: "transparent",           color: "var(--text-secondary)",   border: "none" },
  link:      { bg: "transparent",           color: "var(--accent-blue)",      border: "none" },
};

export function Btn({ label, type = "primary", size = "default", state = "default", icon, trailingArrow, onClick }: {
  label: string; type?: ButtonType; size?: ButtonSize; state?: ButtonState; icon?: React.ReactNode; trailingArrow?: boolean; onClick?: () => void;
}) {
  const s  = BTN_STYLE[type];
  const h  = size === "small" ? "28px" : "36px";
  const px = size === "small" ? "9px" : "12px";
  return (
    <button onClick={onClick}
      disabled={state === "disabled"}
      className="inline-flex items-center gap-1.5 cursor-pointer transition-colors"
      style={{ height: h, padding: `0 ${px}`, borderRadius: "var(--radius-md)", fontSize: "12px", fontWeight: 500, backgroundColor: s.bg, color: s.color, border: s.border, opacity: state === "disabled" ? 0.4 : 1 }}
      onMouseEnter={(e) => { if (state !== "disabled" && type === "primary") (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-blue-hover)"; }}
      onMouseLeave={(e) => { if (type === "primary") (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-blue)"; }}>
      {icon}
      {state === "loading" ? <span className="animate-spin">↻</span> : label}
      {trailingArrow && "↗"}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 09 — Alert strip
// ═══════════════════════════════════════════════════════════════════════════════

type AlertType = "warning" | "danger" | "info" | "success";

const ALERT_STYLE: Record<AlertType, { bg: string; border: string; icon: React.ReactNode; iconColor: string }> = {
  warning: { bg: "var(--elevated-fill)",  border: "var(--elevated-border)", icon: <AlertTriangle size={14} />, iconColor: "var(--elevated-text)" },
  danger:  { bg: "var(--critical-fill)",  border: "var(--critical-border)", icon: <AlertTriangle size={14} />, iconColor: "var(--critical-text)" },
  info:    { bg: "#EFF6FF",               border: "#BFDBFE",                icon: <Info size={14} />,          iconColor: "var(--accent-blue)"   },
  success: { bg: "var(--optimal-fill)",   border: "var(--optimal-border)",  icon: <CheckCircle size={14} />,   iconColor: "var(--optimal-text)"  },
};

export function AlertStrip({ type = "warning", title, body }: {
  type?: AlertType; title?: string; body: string;
}) {
  const s = ALERT_STYLE[type];
  return (
    <div className="flex items-start w-full" style={{ padding: "9px 12px", borderRadius: "var(--radius-md)", backgroundColor: s.bg, border: `0.5px solid ${s.border}`, gap: "var(--gap-md)" }}>
      <span className="flex-shrink-0" style={{ color: s.iconColor, marginTop: "1px" }}>{s.icon}</span>
      <div className="flex flex-col" style={{ gap: "2px" }}>
        {title && <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>{title}</p>}
        <p style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.4 }}>{body}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 10 — Tag pill
// ═══════════════════════════════════════════════════════════════════════════════

type TagState = "default" | "active" | "disabled";

export function TagPill({ label, state = "default", onClick }: {
  label: string; state?: TagState; onClick?: () => void;
}) {
  const styles: Record<TagState, React.CSSProperties> = {
    default:  { border: "0.5px solid var(--border-default)", backgroundColor: "transparent",       color: "var(--text-secondary)" },
    active:   { border: "0.5px solid var(--accent-blue)",    backgroundColor: "#EFF6FF",           color: "#1E40AF"               },
    disabled: { border: "0.5px solid var(--border-default)", backgroundColor: "var(--bg-secondary)",color: "var(--text-tertiary)" },
  };
  return (
    <button onClick={onClick}
      style={{ padding: "3px 9px", borderRadius: "var(--radius-pill)", fontSize: "11px", cursor: state === "disabled" ? "default" : "pointer", ...styles[state] }}>
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 11 — Avatar circle
// ═══════════════════════════════════════════════════════════════════════════════

type AvatarSize   = "small" | "medium" | "large";
type AvatarColour = "blue" | "green" | "amber" | "red" | "purple" | "gray";

const AVATAR_SIZE: Record<AvatarSize, { px: number; fontSize: string }> = {
  small:  { px: 28, fontSize: "11px" },
  medium: { px: 32, fontSize: "12px" },
  large:  { px: 44, fontSize: "14px" },
};

const AVATAR_COLOUR: Record<AvatarColour, { bg: string; text: string }> = {
  blue:   { bg: "#DBEAFE", text: "#1E40AF" },
  green:  { bg: "#C6F6D5", text: "#22543D" },
  amber:  { bg: "#FEEBC8", text: "#7B341E" },
  red:    { bg: "#FED7D7", text: "#9B2C2C" },
  purple: { bg: "#EDE9FE", text: "#5B21B6" },
  gray:   { bg: "#F3F4F6", text: "#6B7280" },
};

export function Avatar({ initials, size = "medium", colour = "blue" }: {
  initials: string; size?: AvatarSize; colour?: AvatarColour;
}) {
  const sz = AVATAR_SIZE[size];
  const cl = AVATAR_COLOUR[colour];
  return (
    <div className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: sz.px, height: sz.px, backgroundColor: cl.bg }}>
      <span style={{ fontSize: sz.fontSize, fontWeight: 500, color: cl.text }}>{initials}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 12 — Timeline event
// ═══════════════════════════════════════════════════════════════════════════════

type DotState = "done" | "active" | "warning" | "pending";

const DOT_STYLE: Record<DotState, { bg: string; border: string; dashed: boolean }> = {
  done:    { bg: "var(--optimal-text)",   border: "var(--optimal-text)",  dashed: false },
  active:  { bg: "var(--accent-blue)",    border: "var(--accent-blue)",   dashed: false },
  warning: { bg: "var(--elevated-text)",  border: "var(--elevated-text)", dashed: false },
  pending: { bg: "transparent",           border: "var(--border-default)",dashed: true  },
};

export function TimelineEvent({ dot = "done", timestamp, name, detail, tags, last }: {
  dot?: DotState; timestamp: string; name: string; detail?: string; tags?: React.ReactNode[]; last?: boolean;
}) {
  const d = DOT_STYLE[dot];
  return (
    <div className="flex gap-4 items-start">
      {/* Dot column */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ paddingTop: "3px" }}>
        <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: d.bg, border: `1.5px ${d.dashed ? "dashed" : "solid"} ${d.border}`, flexShrink: 0 }} />
        {!last && <div style={{ width: "1px", flex: 1, minHeight: "20px", backgroundColor: "var(--border-default)", marginTop: "3px" }} />}
      </div>
      {/* Content */}
      <div className="flex flex-col pb-4" style={{ gap: "2px", minWidth: 0 }}>
        <p style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{timestamp}</p>
        <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>{name}</p>
        {detail && <p style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.4 }}>{detail}</p>}
        {tags && <div className="flex flex-wrap gap-1.5 mt-1">{tags}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 13 — Laytime bar
// ═══════════════════════════════════════════════════════════════════════════════

type SegmentType = "counting" | "dispatch" | "demurrage" | "deductible" | "remaining";

const SEG_COLOR: Record<SegmentType, string> = {
  counting:   "var(--chart-blue)",
  dispatch:   "var(--chart-green)",
  demurrage:  "var(--chart-red)",
  deductible: "var(--chart-grey)",
  remaining:  "var(--border-default)",
};

export function LaytimeBar({ segments, axisLabels }: {
  segments: { type: SegmentType; pct: number }[];
  axisLabels?: string[];
}) {
  return (
    <div className="flex flex-col w-full" style={{ gap: "var(--gap-xs)" }}>
      <div className="flex w-full rounded-full overflow-hidden" style={{ height: "10px", backgroundColor: "var(--bg-secondary)" }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, backgroundColor: SEG_COLOR[s.type] }} />
        ))}
      </div>
      {axisLabels && (
        <div className="flex justify-between">
          {axisLabels.map((l) => <span key={l} style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{l}</span>)}
        </div>
      )}
    </div>
  );
}

export function LaytiemLegend({ items }: { items: SegmentType[] }) {
  const labels: Record<SegmentType, string> = { counting: "Laytime", dispatch: "Dispatch", demurrage: "Demurrage", deductible: "Deductible", remaining: "Remaining" };
  return (
    <div className="flex items-center flex-wrap" style={{ gap: "var(--gap-xl)" }}>
      {items.map((type) => (
        <div key={type} className="flex items-center" style={{ gap: "var(--gap-sm)" }}>
          <span className="rounded-sm flex-shrink-0" style={{ width: "8px", height: "8px", backgroundColor: SEG_COLOR[type] }} />
          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{labels[type]}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 14 — Sidebar nav item
// ═══════════════════════════════════════════════════════════════════════════════

type SideNavState = "default" | "hover" | "active";

export function SideNavItem({ icon, label, count, state = "default", onClick }: {
  icon?: React.ReactNode; label: string; count?: number; state?: SideNavState; onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  const isActive = state === "active";
  const isHov    = hov || state === "hover";
  return (
    <button onClick={onClick}
      className="w-full text-left flex items-center transition-colors cursor-pointer"
      style={{
        height: "32px", padding: "7px 14px", gap: "var(--gap-md)",
        backgroundColor: isActive || isHov ? "var(--bg-secondary)" : "transparent",
        color: isActive ? "var(--accent-blue)" : isHov ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: isActive ? 500 : 400, fontSize: "12px", border: "none",
        borderLeft: `2px solid ${isActive ? "var(--accent-blue)" : "transparent"}`,
        borderRadius: 0,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      {icon && <span style={{ color: isActive ? "var(--accent-blue)" : "var(--text-tertiary)", flexShrink: 0 }}>{icon}</span>}
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <Badge label={String(count)} colour={isActive ? "blue" : "gray"} />
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 15 — Feed / alert card
// ═══════════════════════════════════════════════════════════════════════════════

type FeedType = "danger" | "warning" | "info" | "neutral";

const FEED_BORDER: Record<FeedType, string> = {
  danger:  "var(--critical-text)",
  warning: "var(--elevated-text)",
  info:    "var(--accent-blue)",
  neutral: "var(--border-default)",
};

const FEED_LABEL_COLOR: Record<FeedType, string> = {
  danger:  "var(--critical-text)",
  warning: "var(--elevated-text)",
  info:    "var(--accent-blue)",
  neutral: "var(--text-tertiary)",
};

export function FeedCard({ type = "warning", typeLabel, subject, description, timestamp }: {
  type?: FeedType; typeLabel: string; subject: string; description: string; timestamp: string;
}) {
  return (
    <div className="flex flex-col w-full"
      style={{ padding: "8px 0 8px 12px", borderLeft: `2px solid ${FEED_BORDER[type]}`, borderRadius: "0" }}>
      <p style={{ fontSize: "10px", fontWeight: 500, color: FEED_LABEL_COLOR[type], textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{typeLabel}</p>
      <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "2px" }}>{subject}</p>
      <p style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: "3px" }}>{description}</p>
      <p style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{timestamp}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 16 — Icon button
// ═══════════════════════════════════════════════════════════════════════════════

export function IconBtn({ icon, badge, onClick }: {
  icon: React.ReactNode; badge?: boolean; onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      className="relative flex items-center justify-center cursor-pointer transition-colors"
      style={{ width: "30px", height: "30px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--border-default)", backgroundColor: hov ? "var(--bg-secondary)" : "var(--bg-primary)" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      <span style={{ color: "var(--text-secondary)" }}>{icon}</span>
      {badge && (
        <span className="absolute rounded-full" style={{ width: "5px", height: "5px", backgroundColor: "var(--chart-red)", top: "4px", right: "4px" }} />
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 17 — Mode toggle button
// ═══════════════════════════════════════════════════════════════════════════════

type ModeState = "default" | "hover" | "active";

export function ModeToggle({ icon, label, sub, state = "default", onClick }: {
  icon: React.ReactNode; label: string; sub: string; state?: ModeState; onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  const isActive = state === "active";
  const isHov    = hov || state === "hover";
  return (
    <button onClick={onClick}
      className="flex flex-col items-center cursor-pointer transition-colors w-full"
      style={{
        padding: "9px 8px", gap: "3px", borderRadius: "var(--radius-md)", textAlign: "center",
        border: `0.5px solid ${isActive ? "var(--accent-blue)" : "var(--border-default)"}`,
        backgroundColor: isActive ? "#EFF6FF" : isHov ? "var(--bg-secondary)" : "var(--bg-primary)",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      <span style={{ color: isActive ? "var(--accent-blue)" : "var(--text-secondary)" }}>{icon}</span>
      <span style={{ fontSize: "11px", fontWeight: 500, color: isActive ? "#1E40AF" : "var(--text-primary)" }}>{label}</span>
      <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{sub}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 18 — Pipeline card
// ═══════════════════════════════════════════════════════════════════════════════

type PipelineCardColour = "red" | "amber" | "green" | "neutral";

const PIPELINE_COLOR: Record<PipelineCardColour, string> = {
  red:     "var(--critical-text)",
  amber:   "var(--elevated-text)",
  green:   "var(--optimal-text)",
  neutral: "var(--text-primary)",
};

export function PipelineCard({ vessel, party, value, meta, progress, colour = "red", onClick }: {
  vessel: string; party: string; value: string; meta: string;
  progress?: number; colour?: PipelineCardColour; onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      className="flex flex-col cursor-pointer transition-all"
      style={{ padding: "10px 11px", gap: "3px", borderRadius: "var(--radius-md)", border: `0.5px solid ${hov ? "#93C5FD" : "var(--border-default)"}`, backgroundColor: "var(--bg-primary)", width: "100%" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>{vessel}</p>
      <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{party}</p>
      <p style={{ fontSize: "13px", fontWeight: 500, color: PIPELINE_COLOR[colour] }}>{value}</p>
      <p style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{meta}</p>
      {progress !== undefined && (
        <div className="mt-1.5 rounded-full overflow-hidden" style={{ height: "4px", backgroundColor: "var(--bg-tertiary)" }}>
          <div style={{ width: `${progress}%`, height: "100%", backgroundColor: PIPELINE_COLOR[colour] }} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 19 — Empty state
// ═══════════════════════════════════════════════════════════════════════════════

type EmptyVariant = "shipments" | "claims" | "templates" | "entities" | "search";

const EMPTY_CONTENT: Record<EmptyVariant, { icon: React.ReactNode; title: string; desc: string; cta?: string }> = {
  shipments: { icon: <Ship size={32} />,     title: "No active shipments",       desc: "Create a new shipment to start tracking laytime and exposure.", cta: "+ New shipment" },
  claims:    { icon: <FileText size={32} />, title: "No claims yet",             desc: "Claims will appear here once a shipment is completed and SOF uploaded.", cta: "Upload SOF" },
  templates: { icon: <LayoutTemplate size={32} />, title: "No templates found",  desc: "Build your first deal template to speed up future shipment setup.", cta: "+ New template" },
  entities:  { icon: <Users size={32} />,   title: "No entities found",         desc: "Add suppliers, receivers, and terminals to your entity directory.", cta: "Add entity" },
  search:    { icon: <Search size={32} />,  title: "No results found",          desc: "Try adjusting your search or filters to find what you're looking for." },
};

export function EmptyState({ variant, onCTA }: { variant: EmptyVariant; onCTA?: () => void }) {
  const c = EMPTY_CONTENT[variant];
  return (
    <div className="flex flex-col items-center w-full" style={{ padding: "48px 24px", gap: "var(--gap-xl)" }}>
      <span style={{ color: "var(--text-tertiary)" }}>{c.icon}</span>
      <div className="flex flex-col items-center" style={{ gap: "var(--gap-sm)" }}>
        <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", textAlign: "center" }}>{c.title}</p>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", maxWidth: "300px", textAlign: "center" }}>{c.desc}</p>
      </div>
      {c.cta && <Btn label={c.cta} type="primary" onClick={onCTA} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 20 — Skeleton loader row
// ═══════════════════════════════════════════════════════════════════════════════

export function SkeletonRow() {
  return (
    <div className="flex items-center" style={{ padding: "10px", gap: "var(--gap-lg)", height: "40px", borderBottom: "0.5px solid var(--border-default)" }}>
      {[120, 80, 100, 60, 70].map((w) => (
        <div key={w} className="rounded-md flex-shrink-0" style={{ width: `${w}px`, height: "12px", backgroundColor: "var(--bg-secondary)" }} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHOWCASE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function ShowSection({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-4 pb-2" style={{ borderBottom: "0.5px solid var(--border-default)" }}>
        <span style={{ fontSize: "10px", fontFamily: "JetBrains Mono, monospace", color: "var(--text-tertiary)" }}>C{n.padStart(2, "0")}</span>
        <h2 style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) {
  return <div className={`flex items-start gap-4 ${wrap ? "flex-wrap" : ""}`}>{children}</div>;
}

function VariantLabel({ label }: { label: string }) {
  return <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>;
}

export default function ComponentLibrary({ onNav }: { onNav: (tab: NavTab) => void }) {
  const [toggle1, setToggle1] = useState(true);
  const [toggle2, setToggle2] = useState(false);
  const navTabs: NavTab[] = ["Operations", "Claims", "Analytics", "Vessels"];

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
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Component Library</span>
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
            Components
          </button>
        </div>
        <div className="flex items-center gap-2">
          <IconBtn icon={<Bell size={14} />} badge />
          <Avatar initials="WJ" size="medium" colour="blue" />
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px", width: "100%" }}>
        <div className="mb-10">
          <h1 style={{ fontSize: "22px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "6px" }}>Component Library</h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>20 master components — all variants and states. Every component uses CSS variable tokens from the Design System.</p>
        </div>

        {/* C01 — Nav pill */}
        <ShowSection n="1" title="Top navigation bar — Nav pill">
          <Row>
            {(["default", "hover", "active"] as const).map((s) => (
              <div key={s}><VariantLabel label={s} /><NavPill label="Operations" state={s} /></div>
            ))}
          </Row>
        </ShowSection>

        {/* C02 — KPI card */}
        <ShowSection n="2" title="KPI card">
          <Row wrap>
            {(["neutral","red","amber","green","blue"] as KPIColour[]).map((c) => (
              <div key={c}><VariantLabel label={c} />
                <KPICard label="Active shipments" value="142" sub="+12.5% vs last cycle" colour={c} />
              </div>
            ))}
          </Row>
        </ShowSection>

        {/* C03 — Badge */}
        <ShowSection n="3" title="Badge / pill">
          <div className="mb-3"><VariantLabel label="Standard with dot" />
            <Row wrap>{(["blue","green","amber","red","gray","purple"] as BadgeColour[]).map((c) => <Badge key={c} label={c} colour={c} dot />)}</Row>
          </div>
          <div><VariantLabel label="Compact no dot" />
            <Row wrap>{(["blue","green","amber","red","gray","purple"] as BadgeColour[]).map((c) => <Badge key={c} label={c} colour={c} size="compact" />)}</Row>
          </div>
        </ShowSection>

        {/* C04 — Risk badge */}
        <ShowSection n="4" title="Risk badge">
          <Row>{(["critical","elevated","optimal"] as RiskLevel[]).map((l) => (<div key={l}><VariantLabel label={l} /><RiskBadge level={l} /></div>))}</Row>
        </ShowSection>

        {/* C05 — Toggle */}
        <ShowSection n="5" title="Toggle switch">
          <Row>
            <div><VariantLabel label="ON" /><Toggle on={toggle1} onChange={setToggle1} /></div>
            <div><VariantLabel label="OFF" /><Toggle on={toggle2} onChange={setToggle2} /></div>
          </Row>
        </ShowSection>

        {/* C06 — Table row */}
        <ShowSection n="6" title="Data table row">
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border-default)", borderWidth: "0.5px", backgroundColor: "var(--bg-primary)" }}>
            {(["default","hover","selected","deductible"] as RowState[]).map((s) => (
              <div key={s}>
                <p style={{ fontSize: "10px", color: "var(--text-tertiary)", padding: "4px 10px", textTransform: "uppercase", letterSpacing: "0.05em", backgroundColor: "var(--bg-tertiary)" }}>{s}</p>
                <TableRow state={s} accentBar={s === "default"} accentColour="red" cells={[
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>BW Magnolia</span>,
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>VOY-2311 · Singapore</span>,
                  <RiskBadge level="elevated" />,
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--critical-text)" }}>$42,500</span>,
                ]} />
              </div>
            ))}
          </div>
        </ShowSection>

        {/* C07 — Form field */}
        <ShowSection n="7" title="Form field group">
          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div><VariantLabel label="Text / default" /><FormField label="Vessel name" required type="text" placeholder="e.g. BW Magnolia" /></div>
            <div><VariantLabel label="Select / filled" /><FormField label="Product" type="select" value="LNG" options={["LNG","LPG","Crude","Products"]} /></div>
            <div><VariantLabel label="Text / error" /><FormField label="Laycan close" type="date" state="error" error="Date cannot precede laycan open" /></div>
            <div><VariantLabel label="Text / disabled" /><FormField label="Voyage ref" type="text" state="disabled" value="VOY-2311" /></div>
            <div><VariantLabel label="Text / with hint" /><FormField label="Supplier" type="text" hint="Template auto-fills known terms" placeholder="Search entities…" /></div>
            <div><VariantLabel label="Textarea" /><FormField label="Notes" type="textarea" placeholder="Add operational notes…" /></div>
          </div>
        </ShowSection>

        {/* C08 — Button */}
        <ShowSection n="8" title="Button">
          <div className="mb-4"><VariantLabel label="Default size — all types" />
            <Row wrap>
              <Btn label="Primary" type="primary" />
              <Btn label="Secondary" type="secondary" />
              <Btn label="Danger" type="danger" />
              <Btn label="Success" type="success" />
              <Btn label="Ghost" type="ghost" />
              <Btn label="Link" type="link" />
            </Row>
          </div>
          <div className="mb-4"><VariantLabel label="Small size" />
            <Row wrap>
              <Btn label="Primary" type="primary" size="small" />
              <Btn label="Secondary" type="secondary" size="small" />
              <Btn label="Ghost" type="ghost" size="small" />
            </Row>
          </div>
          <div><VariantLabel label="With icon / trailing arrow / disabled" />
            <Row wrap>
              <Btn label="New shipment" type="primary" icon={<X size={12} />} />
              <Btn label="Open claim" type="primary" trailingArrow />
              <Btn label="Disabled" type="primary" state="disabled" />
              <Btn label="Loading" type="secondary" state="loading" />
            </Row>
          </div>
        </ShowSection>

        {/* C09 — Alert strip */}
        <ShowSection n="9" title="Alert strip">
          <div className="flex flex-col gap-3">
            <AlertStrip type="warning" title="Terminal congestion" body="Singapore Terminal 3 reporting +12h avg turnaround. Receiver clock impact likely." />
            <AlertStrip type="danger" body="ETA now outside supplier laycan window. Immediate demurrage risk detected." />
            <AlertStrip type="info" title="Speed optimisation" body="Reducing speed to 14 kts saves $4,200 fuel cost with minimal ETA impact." />
            <AlertStrip type="success" title="Extraction complete" body="SOF_BW-Magnolia_VOY2311 processed successfully. 10 events extracted." />
          </div>
        </ShowSection>

        {/* C10 — Tag pill */}
        <ShowSection n="10" title="Tag pill">
          <Row wrap>
            {(["default","active","disabled"] as TagState[]).map((s) => (
              <div key={s}><VariantLabel label={s} /><TagPill label="Rain / weather" state={s} /></div>
            ))}
          </Row>
        </ShowSection>

        {/* C11 — Avatar */}
        <ShowSection n="11" title="Avatar circle">
          <div className="mb-4"><VariantLabel label="Sizes" />
            <Row>{(["small","medium","large"] as AvatarSize[]).map((s) => <div key={s}><VariantLabel label={s} /><Avatar initials="WJ" size={s} colour="blue" /></div>)}</Row>
          </div>
          <div><VariantLabel label="Colour variants (medium)" />
            <Row>{(["blue","green","amber","red","purple","gray"] as AvatarColour[]).map((c) => <Avatar key={c} initials={c.slice(0,2).toUpperCase()} size="medium" colour={c} />)}</Row>
          </div>
        </ShowSection>

        {/* C12 — Timeline event */}
        <ShowSection n="12" title="Timeline event">
          <div style={{ paddingLeft: "8px" }}>
            <TimelineEvent dot="done"    timestamp="23 Oct 08:00" name="NOR tendered" detail="Notice of Readiness presented at pilot station." />
            <TimelineEvent dot="done"    timestamp="23 Oct 14:00" name="Laytime commences" detail="6h notice period expired." tags={[<Badge key="s" label="Supplier clock starts" colour="blue" />, <Badge key="r" label="Receiver clock starts" colour="blue" />]} />
            <TimelineEvent dot="warning" timestamp="24 Oct 11:20" name="Rain squall" detail="Operations suspended — deductible event." tags={[<Badge key="d" label="Deductible · 2h 00m" colour="gray" />]} />
            <TimelineEvent dot="active"  timestamp="25 Oct 05:10" name="Loading ongoing" detail="58h 20m used. 13h 40m remaining." tags={[<Badge key="w" label="Watch: demurrage risk" colour="red" dot />]} />
            <TimelineEvent dot="pending" timestamp="~25 Oct 14:30" name="Loading complete — projected" last />
          </div>
        </ShowSection>

        {/* C13 — Laytime bar */}
        <ShowSection n="13" title="Laytime bar">
          <div className="flex flex-col gap-3 p-4 rounded-xl border" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)", borderWidth: "0.5px" }}>
            <LaytiemLegend items={["counting","dispatch","demurrage","deductible"]} />
            {[
              { label: "Maran Gas Apol.", segs: [{type:"counting" as const,pct:48},{type:"deductible" as const,pct:7},{type:"demurrage" as const,pct:45}] },
              { label: "BW Magnolia",    segs: [{type:"counting" as const,pct:55},{type:"deductible" as const,pct:8},{type:"demurrage" as const,pct:37}] },
              { label: "Gaslog Geneva",  segs: [{type:"counting" as const,pct:60},{type:"dispatch" as const,pct:40}] },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="flex-shrink-0 text-right" style={{ width: "100px", fontSize: "12px", color: "var(--text-secondary)" }}>{row.label}</span>
                <LaytimeBar segments={row.segs} />
              </div>
            ))}
          </div>
        </ShowSection>

        {/* C14 — Sidebar nav item */}
        <ShowSection n="14" title="Sidebar nav item">
          <div className="rounded-xl border overflow-hidden" style={{ width: "220px", borderColor: "var(--border-default)", borderWidth: "0.5px", backgroundColor: "var(--bg-primary)" }}>
            {(["default","hover","active"] as SideNavState[]).map((s) => (
              <SideNavItem key={s} icon={<FileText size={14} />} label="SOF timeline" count={s === "active" ? 8 : undefined} state={s} />
            ))}
          </div>
        </ShowSection>

        {/* C15 — Feed card */}
        <ShowSection n="15" title="Feed / alert card">
          <div className="flex flex-col gap-3">
            {(["danger","warning","info","neutral"] as FeedType[]).map((t) => (
              <FeedCard key={t} type={t} typeLabel={t === "danger" ? "Laycan breach risk" : t === "warning" ? "Terminal congestion" : t === "info" ? "Early arrival" : "Deductible event"}
                subject={t === "danger" ? "Maran Gas Apollonia" : t === "warning" ? "Port of Singapore" : t === "info" ? "Gaslog Geneva" : "BW Magnolia"}
                description={t === "danger" ? "ETA now outside laycan window (+8h)." : t === "warning" ? "Terminal 3 reporting high congestion. +12h turnaround." : t === "info" ? "14h early arrival — reduce speed to optimise." : "Weather delay recorded at Gulf of Mexico."}
                timestamp={t === "danger" ? "14:28 UTC" : t === "warning" ? "14:15 UTC" : t === "info" ? "13:42 UTC" : "23:30 UTC"} />
            ))}
          </div>
        </ShowSection>

        {/* C16 — Icon button */}
        <ShowSection n="16" title="Icon button">
          <Row>
            <div><VariantLabel label="Default" /><IconBtn icon={<Search size={14} />} /></div>
            <div><VariantLabel label="With badge" /><IconBtn icon={<Bell size={14} />} badge /></div>
            <div><VariantLabel label="Edit" /><IconBtn icon={<Edit3 size={14} />} /></div>
          </Row>
        </ShowSection>

        {/* C17 — Mode toggle */}
        <ShowSection n="17" title="Mode toggle button">
          <div className="grid grid-cols-3 gap-2.5" style={{ maxWidth: "400px" }}>
            <div><VariantLabel label="Default" /><ModeToggle icon={<Edit3 size={16} />} label="Spot recap" sub="Manual entry" state="default" /></div>
            <div><VariantLabel label="Active" /><ModeToggle icon={<LayoutTemplate size={16} />} label="Term agreement" sub="Supplier template" state="active" /></div>
            <div><VariantLabel label="Hover" /><ModeToggle icon={<Upload size={16} />} label="Upload contract" sub="Auto-extraction" state="hover" /></div>
          </div>
        </ShowSection>

        {/* C18 — Pipeline card */}
        <ShowSection n="18" title="Pipeline card">
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <div><VariantLabel label="Red / no bar" /><PipelineCard vessel="BW Magnolia" party="Vitol Asia" value="$127,604" meta="CLM-2311 · 4 days" colour="red" /></div>
            <div><VariantLabel label="Amber / 55% bar" /><PipelineCard vessel="Maran Gas Apol." party="Shell Intl." value="$142,500" meta="CLM-2260 · 18 days" colour="amber" progress={55} /></div>
            <div><VariantLabel label="Red / 80% bar" /><PipelineCard vessel="MT Caspian Relayer" party="Repsol" value="$218,000" meta="CLM-2214 · 39 days" colour="red" progress={80} /></div>
            <div><VariantLabel label="Green / settled" /><PipelineCard vessel="MV Oceanic Voyager" party="BP Trading" value="$112,000 rec." meta="CLM-2180 · Closed" colour="green" /></div>
          </div>
        </ShowSection>

        {/* C19 — Empty state */}
        <ShowSection n="19" title="Empty state">
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {(["shipments","search"] as EmptyVariant[]).map((v) => (
              <div key={v} className="rounded-xl border" style={{ borderColor: "var(--border-default)", borderWidth: "0.5px", backgroundColor: "var(--bg-primary)" }}>
                <VariantLabel label={v} />
                <EmptyState variant={v} />
              </div>
            ))}
          </div>
        </ShowSection>

        {/* C20 — Skeleton row */}
        <ShowSection n="20" title="Skeleton loader row">
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border-default)", borderWidth: "0.5px", backgroundColor: "var(--bg-primary)" }}>
            {[0,1,2].map((i) => <SkeletonRow key={i} />)}
          </div>
        </ShowSection>
      </div>
    </div>
  );
}
