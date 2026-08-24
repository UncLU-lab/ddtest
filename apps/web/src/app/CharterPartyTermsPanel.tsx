import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, Edit3, Plus } from "lucide-react";
import {
  createCpClause,
  updateCharterParty,
  updateCpClause,
  type CharterParty,
  type ClauseOperation,
  type CpClause,
  type CpClauseParameters,
  type LaytimeOperationScope,
} from "../lib/api";
import { formatCurrencyAmount } from "../lib/currency";

type ClauseScope = "Global" | ClauseOperation;

const SUPPORTED_CLAUSE_TYPES = [
  "laytime_rate",
  "demurrage_rate",
  "despatch",
  "shex_shinc",
  "weather_working",
  "wibon",
  "wipon",
  "wifpon",
  "reversible_laytime",
  "atutc",
  "nor_commencement_schedule",
] as const;

type SupportedClauseType = (typeof SUPPORTED_CLAUSE_TYPES)[number];

type CommercialTerms = {
  laytimeAllowed?: number | null;
  demurrageRate?: string | null;
  dispatchRate?: string | null;
  timeCountingBasis?: string | null;
  norNoticePeriod?: string | null;
};

type ClauseEditorState = {
  clauseId: string | null;
  clauseType: SupportedClauseType;
  scope: ClauseScope;
  laytimeHours: string;
  noticeHours: string;
  demurrageRate: string;
  dispatchRate: string;
  dispatchMultiplier: string;
  dispatchTimeBasis: "" | "all_time_saved" | "working_time_saved";
  laytimeBasis: "" | "SHEX" | "SHINC";
  shexTimeZone: string;
  shexSaturdayExcepted: "Yes" | "No";
  shexHolidayDates: string[];
  shexLegacySaturdayConflict: boolean;
  enabled: "" | "Enabled" | "Disabled";
  cutoffReference: "" | "tenderTime" | "acceptedTime";
  tenderCutoffTime: string;
  sameDayCommencementTime: string;
  nextWorkingDayCommencementTime: string;
  workingDays: string[];
  timeZone: string;
};

type ClauseResolution = {
  clause: CpClause | null;
  source: "operation" | "global" | "missing";
};

const DAY_OPTIONS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

const CLAUSE_LABELS: Record<string, string> = {
  laytime_rate: "Laytime rate",
  demurrage_rate: "Demurrage rate",
  despatch: "Despatch",
  shex_shinc: "Laytime counting basis",
  weather_working: "Weather working",
  wibon: "WIBON",
  wipon: "WIPON",
  wifpon: "WIFPON",
  reversible_laytime: "Reversible laytime",
  atutc: "ATUTC",
  nor_commencement_schedule: "NOR commencement schedule",
};

function formatMoney(value?: string | number | null, currency?: string | null) {
  const formatted = formatCurrencyAmount(value, currency);
  return formatted === "Not available" ? "—" : `${formatted}/day`;
}

function formatHours(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return String(value);
  }

  return `${number} hours`;
}

function formatYesNo(value?: boolean | null) {
  if (value === null || value === undefined) {
    return "—";
  }

  return value ? "Yes" : "No";
}

function formatBasis(value?: string | null) {
  if (!value) {
    return "—";
  }

  if (value === "all_time_saved") {
    return "All time saved";
  }

  if (value === "working_time_saved") {
    return "Working time saved";
  }

  return value;
}

function formatCountingBasis(value?: string | null) {
  if (!value) {
    return "—";
  }

  const normalized = value.trim().toUpperCase();

  if (normalized === "SHEX" || normalized === "SHINC") {
    return normalized;
  }

  return value;
}

function formatWorkingDays(days: string[]) {
  if (days.length === 0) {
    return "—";
  }

  const labels: Record<string, string> = {
    MON: "Mon",
    TUE: "Tue",
    WED: "Wed",
    THU: "Thu",
    FRI: "Fri",
    SAT: "Sat",
    SUN: "Sun",
  };

  return days.map((day) => labels[day] ?? day).join(", ");
}

function extractNoticeHoursInput(value?: string | null): string {
  if (!value || !value.trim()) {
    return "";
  }

  const trimmed = value.trim();
  if (trimmed.toLowerCase() === "immediate") {
    return "0";
  }

  const match = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return "";
  }

  const hours = Number(match[1]);
  return Number.isFinite(hours) ? String(hours) : "";
}

function formatNoticePeriod(value?: string | null): string {
  if (!value || !value.trim()) {
    return "—";
  }

  const trimmed = value.trim();
  if (trimmed.toLowerCase() === "immediate") {
    return "Immediate";
  }

  const match = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return trimmed;
  }

  const hours = Number(match[1]);
  return Number.isFinite(hours) ? `${hours} hours` : trimmed;
}

function parseWorkingDays(value?: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (day): day is string =>
      typeof day === "string" &&
      DAY_OPTIONS.includes(day as (typeof DAY_OPTIONS)[number]),
  );
}

function clauseScope(parameters?: CpClauseParameters | null): ClauseScope {
  const scope = parameters?.operation;
  if (scope === "Loading" || scope === "Discharge") {
    return scope;
  }

  return "Global";
}

function isGlobalOnlyType(clauseType: SupportedClauseType) {
  return (
    clauseType === "reversible_laytime" ||
    clauseType === "atutc" ||
    clauseType === "nor_commencement_schedule"
  );
}

function isOperationScopedType(clauseType: SupportedClauseType) {
  return !isGlobalOnlyType(clauseType);
}

function clauseLabel(clauseType: SupportedClauseType) {
  return CLAUSE_LABELS[clauseType] ?? clauseType;
}

function findClause(
  clauses: CpClause[],
  clauseType: SupportedClauseType,
  scope?: ClauseScope,
): CpClause | null {
  const matches = clauses.filter((clause) => clause.clauseType === clauseType);

  if (scope === "Loading" || scope === "Discharge") {
    return (
      matches.find((clause) => clauseScope(clause.parameters) === scope) ??
      matches.find((clause) => clauseScope(clause.parameters) === "Global") ??
      null
    );
  }

  return (
    matches.find((clause) => clauseScope(clause.parameters) === "Global") ??
    matches[0] ??
    null
  );
}

function resolveClause(
  clauses: CpClause[],
  clauseType: SupportedClauseType,
  scope?: ClauseScope,
): ClauseResolution {
  const clause = findClause(clauses, clauseType, scope);

  if (!clause) {
    return { clause: null, source: "missing" };
  }

  const resolvedScope = clauseScope(clause.parameters);
  return {
    clause,
    source: resolvedScope === "Global" ? "global" : "operation",
  };
}

function buildRawText(
  clauseType: SupportedClauseType,
  state: ClauseEditorState,
): string {
  const scopeText = state.scope === "Global" ? "Global" : state.scope;

  switch (clauseType) {
    case "laytime_rate":
      return [
        `${scopeText} laytime allowed: ${state.laytimeHours || "0"}h`,
        state.noticeHours ? `NOR notice: ${state.noticeHours}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    case "demurrage_rate":
      return `${scopeText} demurrage: ${state.demurrageRate || "0"} per day`;
    case "despatch": {
      const parts = [`${scopeText} despatch`];
      if (state.dispatchRate) {
        parts.push(`rate: ${state.dispatchRate} per day`);
      }
      if (state.dispatchMultiplier) {
        parts.push(`multiplier: ${state.dispatchMultiplier}`);
      }
      if (state.dispatchTimeBasis) {
        parts.push(`basis: ${formatBasis(state.dispatchTimeBasis)}`);
      }
      return parts.join(" | ");
    }
    case "shex_shinc":
      return state.laytimeBasis === "SHEX"
        ? [
            "Laytime counting basis: SHEX",
            `Calendar timezone: ${state.shexTimeZone || "not configured"}`,
            `Saturday excepted: ${state.shexSaturdayExcepted}`,
            `Contractual holidays: ${state.shexHolidayDates.join(", ") || "none"}`,
          ].join("\n")
        : "Laytime counting basis: SHINC";
    case "weather_working":
      return `Weather working: ${state.enabled || "Enabled"}`;
    case "wibon":
      return `WIBON: ${state.enabled || "Enabled"}`;
    case "wipon":
      return `WIPON: ${state.enabled || "Enabled"}`;
    case "wifpon":
      return `WIFPON: ${state.enabled || "Enabled"}`;
    case "reversible_laytime":
      return state.enabled === "Disabled"
        ? "Reversible laytime: Disabled"
        : "Reversible laytime V1: pool explicit Loading and Discharge allowances";
    case "atutc":
      return `ATUTC: ${state.enabled || "Enabled"}`;
    case "nor_commencement_schedule":
      return [
        `NOR commencement schedule`,
        `Cutoff reference: ${state.cutoffReference === "tenderTime" ? "NOR tender time" : state.cutoffReference === "acceptedTime" ? "NOR acceptance time" : "not selected"}`,
        `Cutoff: ${state.tenderCutoffTime || "12:00"}`,
        `Same day: ${state.sameDayCommencementTime || "13:00"}`,
        `Next working day: ${state.nextWorkingDayCommencementTime || "08:00"}`,
        `Working days: ${formatWorkingDays(state.workingDays)}`,
        `Time zone: ${state.timeZone || "UTC"}`,
      ].join("\n");
    default:
      return clauseType;
  }
}

function buildParameters(
  clauseType: SupportedClauseType,
  state: ClauseEditorState,
): Record<string, unknown> {
  switch (clauseType) {
    case "laytime_rate":
      return {
        hours: Number(state.laytimeHours),
        ...(state.noticeHours
          ? { noticeHours: Number(state.noticeHours) }
          : {}),
        ...(state.scope !== "Global" ? { operation: state.scope } : {}),
      };
    case "demurrage_rate":
      return {
        rate: Number(state.demurrageRate),
        ...(state.scope !== "Global" ? { operation: state.scope } : {}),
      };
    case "despatch":
      return {
        ...(state.dispatchRate ? { rate: Number(state.dispatchRate) } : {}),
        ...(state.dispatchMultiplier
          ? { multiplier: Number(state.dispatchMultiplier) }
          : {}),
        ...(state.dispatchTimeBasis
          ? { timeBasis: state.dispatchTimeBasis }
          : {}),
        ...(state.scope !== "Global" ? { operation: state.scope } : {}),
      };
    case "shex_shinc":
      return {
        shex: state.laytimeBasis === "SHEX",
        ...(state.laytimeBasis === "SHEX"
          ? {
              calendarVersion: 1,
              timeZone: state.shexTimeZone,
              holidayDates: [...state.shexHolidayDates].sort(),
              saturdayExcepted: state.shexSaturdayExcepted === "Yes",
            }
          : {}),
        ...(state.scope !== "Global" ? { operation: state.scope } : {}),
      };
    case "weather_working":
    case "wibon":
    case "wipon":
    case "wifpon":
    case "atutc":
      return {
        enabled: state.enabled === "Enabled",
        ...(state.scope !== "Global" ? { operation: state.scope } : {}),
      };
    case "reversible_laytime":
      return state.enabled === "Enabled"
        ? {
            enabled: true,
            settlementVersion: 1,
            allowanceMode: "sum_operation_allowances",
          }
        : { enabled: false };
    case "nor_commencement_schedule":
      return {
        cutoffReference: state.cutoffReference,
        tenderCutoffTime: state.tenderCutoffTime,
        sameDayCommencementTime: state.sameDayCommencementTime,
        nextWorkingDayCommencementTime: state.nextWorkingDayCommencementTime,
        workingDays: [...state.workingDays],
        timeZone: state.timeZone,
      };
    default:
      return {};
  }
}

function initialEditorState(
  clauseType: SupportedClauseType = "laytime_rate",
): ClauseEditorState {
  return {
    clauseId: null,
    clauseType,
    scope: isGlobalOnlyType(clauseType) ? "Global" : "Global",
    laytimeHours: "",
    noticeHours: "",
    demurrageRate: "",
    dispatchRate: "",
    dispatchMultiplier: "",
    dispatchTimeBasis: "",
    laytimeBasis: "SHEX",
    shexTimeZone: "",
    shexSaturdayExcepted: "No",
    shexHolidayDates: [],
    shexLegacySaturdayConflict: false,
    enabled: "Enabled",
    cutoffReference: "",
    tenderCutoffTime: "",
    sameDayCommencementTime: "",
    nextWorkingDayCommencementTime: "",
    workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
    timeZone: "",
  };
}

function stateFromClause(
  clauseType: SupportedClauseType,
  clause: CpClause | null,
  scope: ClauseScope,
  commercialTerms: CommercialTerms | null,
): ClauseEditorState {
  const state = initialEditorState(clauseType);
  state.scope = isGlobalOnlyType(clauseType) ? "Global" : scope;

  const parameters = (clause?.parameters ?? {}) as Record<string, unknown>;

  switch (clauseType) {
    case "laytime_rate":
      state.laytimeHours = String(
        parameters.hours ?? commercialTerms?.laytimeAllowed ?? "",
      );
      state.noticeHours =
        parameters.noticeHours !== undefined
          ? String(parameters.noticeHours)
          : extractNoticeHoursInput(commercialTerms?.norNoticePeriod ?? "");
      break;
    case "demurrage_rate":
      state.demurrageRate = String(
        parameters.rate ?? commercialTerms?.demurrageRate ?? "",
      );
      break;
    case "despatch":
      state.dispatchRate = String(
        parameters.rate ?? commercialTerms?.dispatchRate ?? "",
      );
      state.dispatchMultiplier = String(parameters.multiplier ?? "");
      state.dispatchTimeBasis =
        parameters.timeBasis === "working_time_saved"
          ? "working_time_saved"
          : parameters.timeBasis === "all_time_saved"
            ? "all_time_saved"
            : "";
      break;
    case "shex_shinc":
      state.laytimeBasis = parameters.shex === false ? "SHINC" : "SHEX";
      state.shexTimeZone = String(parameters.timeZone ?? "");
      {
        const legacySaturdayValues = [
          parameters.saturdayExcepted,
          parameters.saturday_excepted,
          parameters.satShex,
        ].filter((value): value is boolean => typeof value === "boolean");
        state.shexLegacySaturdayConflict =
          new Set(legacySaturdayValues).size > 1;
        state.shexSaturdayExcepted = legacySaturdayValues.includes(true)
          ? "Yes"
          : "No";
      }
      state.shexHolidayDates = Array.isArray(parameters.holidayDates)
        ? parameters.holidayDates.filter((date): date is string => typeof date === "string")
        : [];
      break;
    case "weather_working":
    case "wibon":
    case "wipon":
    case "wifpon":
    case "reversible_laytime":
    case "atutc":
      state.enabled = parameters.enabled === false ? "Disabled" : "Enabled";
      break;
    case "nor_commencement_schedule":
      state.cutoffReference =
        parameters.cutoffReference === "tenderTime" ||
        parameters.cutoffReference === "acceptedTime"
          ? parameters.cutoffReference
          : "";
      state.tenderCutoffTime = String(parameters.tenderCutoffTime ?? "");
      state.sameDayCommencementTime = String(
        parameters.sameDayCommencementTime ?? "",
      );
      state.nextWorkingDayCommencementTime = String(
        parameters.nextWorkingDayCommencementTime ?? "",
      );
      state.workingDays = parseWorkingDays(parameters.workingDays) || [];
      state.timeZone = String(parameters.timeZone ?? "");
      break;
  }

  return state;
}

function termRow({
  label,
  value,
  sourceLabel,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  label: string;
  value: string;
  sourceLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 py-2"
      style={{
        borderBottom: "0.5px solid #F3F4F6",
      }}
    >
      <div className="min-w-0">
        <p style={{ fontSize: "12px", color: "#6B7280" }}>{label}</p>
        <p style={{ fontSize: "13px", color: "#111827", fontWeight: 500 }}>
          {value}
        </p>
        {sourceLabel && (
          <p style={{ fontSize: "10px", color: "#9CA3AF", marginTop: "1px" }}>
            {sourceLabel}
          </p>
        )}
      </div>

      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="rounded-md border px-2 py-1 text-xs cursor-pointer disabled:cursor-not-allowed"
          style={{
            color: actionDisabled ? "#9CA3AF" : "#374151",
            borderColor: "#E5E7EB",
            borderWidth: "0.5px",
            backgroundColor: "#ffffff",
            flexShrink: 0,
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function SectionCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-[14px_16px]"
      style={{
        borderColor: "#E5E7EB",
        borderWidth: "0.5px",
        backgroundColor: "#ffffff",
      }}
    >
      <div className="mb-3">
        <p
          style={{
            fontSize: "10px",
            color: "#6B7280",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "2px",
          }}
        >
          {title}
        </p>
        {note && (
          <p style={{ fontSize: "11px", color: "#9CA3AF", lineHeight: 1.45 }}>
            {note}
          </p>
        )}
      </div>

      {children}
    </div>
  );
}

export function CharterPartyTermsPanel({
  charterParty,
  commercialTerms,
  loading,
  error,
  onReload,
}: {
  charterParty: CharterParty | null;
  commercialTerms: CommercialTerms | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
}) {
  const clauses = charterParty?.clauses ?? [];
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [state, setState] = useState<ClauseEditorState>(initialEditorState());
  const [operationScope, setOperationScope] = useState<LaytimeOperationScope | "">("");
  const [scopeSaving, setScopeSaving] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [currencyInput, setCurrencyInput] = useState("");
  const [currencySaving, setCurrencySaving] = useState(false);
  const [currencyError, setCurrencyError] = useState<string | null>(null);

  useEffect(() => {
    setOperationScope(charterParty?.laytimeOperationScope ?? "");
  }, [charterParty?.id, charterParty?.laytimeOperationScope]);

  useEffect(() => {
    setCurrencyInput(charterParty?.settlementCurrency ?? "");
  }, [charterParty?.id, charterParty?.settlementCurrency]);

  async function saveOperationScope(nextScope: LaytimeOperationScope) {
    if (!charterParty) return;
    setOperationScope(nextScope);
    setScopeSaving(true);
    setScopeError(null);
    try {
      await updateCharterParty(charterParty.id, {
        laytimeOperationScope: nextScope,
      });
      onReload();
    } catch (scopeSaveError: any) {
      setOperationScope(charterParty.laytimeOperationScope ?? "");
      setScopeError(scopeSaveError?.message ?? "Unable to save laytime operation scope.");
    } finally {
      setScopeSaving(false);
    }
  }

  async function saveSettlementCurrency() {
    if (!charterParty) return;
    const nextCurrency = currencyInput.trim().toUpperCase();
    setCurrencyInput(nextCurrency);
    setCurrencySaving(true);
    setCurrencyError(null);
    try {
      await updateCharterParty(charterParty.id, {
        settlementCurrency: nextCurrency || null,
      });
      onReload();
    } catch (currencySaveError: any) {
      setCurrencyInput(charterParty.settlementCurrency ?? "");
      setCurrencyError(
        currencySaveError?.message ?? "Unable to save settlement currency.",
      );
    } finally {
      setCurrencySaving(false);
    }
  }

  const globalBase = commercialTerms ?? null;

  const hasNoticeAndSchedule =
    Boolean(globalBase?.norNoticePeriod) &&
    Boolean(resolveClause(clauses, "nor_commencement_schedule").clause);

  function openNewClause(
    clauseType: SupportedClauseType,
    scope: ClauseScope = "Global",
    clause?: CpClause | null,
  ) {
    const next = stateFromClause(clauseType, clause ?? null, scope, globalBase);
    setState(next);
    setSaveError(null);
    setEditorOpen(true);
  }

  async function saveClause() {
    if (!charterParty) {
      setSaveError("Load a charter party before creating or editing terms.");
      return;
    }

    if (!state.clauseType) {
      setSaveError("Choose a term type.");
      return;
    }

    if (isOperationScopedType(state.clauseType) && state.scope === "Global") {
      // global is allowed as a fallback for the supported operation-scoped clauses
    }

    const payload = {
      clauseType: state.clauseType,
      rawText: buildRawText(state.clauseType, state),
      parameters: buildParameters(
        state.clauseType,
        state,
      ) as CpClauseParameters,
    };

    if (state.clauseType === "laytime_rate" && !state.laytimeHours.trim()) {
      setSaveError("Laytime allowed is required.");
      return;
    }

    if (state.clauseType === "demurrage_rate" && !state.demurrageRate.trim()) {
      setSaveError("Demurrage rate is required.");
      return;
    }

    if (
      state.clauseType === "despatch" &&
      !state.dispatchRate.trim() &&
      !state.dispatchMultiplier.trim() &&
      !state.dispatchTimeBasis
    ) {
      setSaveError(
        "Enter a despatch rate, multiplier, or time basis so the term can be saved.",
      );
      return;
    }

    if (state.clauseType === "shex_shinc" && !state.laytimeBasis) {
      setSaveError("Choose SHEX or SHINC.");
      return;
    }

    if (
      state.clauseType === "shex_shinc" &&
      state.laytimeBasis === "SHEX" &&
      state.shexLegacySaturdayConflict
    ) {
      setSaveError(
        "This legacy clause has conflicting Saturday aliases. Select Saturday Yes or No explicitly before saving.",
      );
      return;
    }

    if (
      state.clauseType === "shex_shinc" &&
      state.laytimeBasis === "SHEX" &&
      !state.shexTimeZone.trim()
    ) {
      setSaveError("SHEX requires an explicit contractual IANA timezone.");
      return;
    }

    if (
      state.clauseType === "shex_shinc" &&
      state.laytimeBasis === "SHEX" &&
      state.shexHolidayDates.some((date) => !date.trim())
    ) {
      setSaveError("Remove empty holiday rows or enter each date as YYYY-MM-DD.");
      return;
    }

    if (
      [
        "weather_working",
        "wibon",
        "wipon",
        "wifpon",
        "reversible_laytime",
        "atutc",
      ].includes(state.clauseType) &&
      !state.enabled
    ) {
      setSaveError("Choose whether the term is enabled or disabled.");
      return;
    }

    if (
      state.clauseType === "reversible_laytime" &&
      state.enabled === "Enabled"
    ) {
      const hasLoadingAllowance = clauses.some(
        (clause) =>
          clause.clauseType === "laytime_rate" &&
          clauseScope(clause.parameters) === "Loading",
      );
      const hasDischargeAllowance = clauses.some(
        (clause) =>
          clause.clauseType === "laytime_rate" &&
          clauseScope(clause.parameters) === "Discharge",
      );

      if (!hasLoadingAllowance || !hasDischargeAllowance) {
        setSaveError(
          "Reversible laytime V1 requires explicit Loading and Discharge laytime allowances before it can be enabled.",
        );
        return;
      }
    }

    if (state.clauseType === "nor_commencement_schedule") {
      if (
        !state.cutoffReference ||
        !state.tenderCutoffTime.trim() ||
        !state.sameDayCommencementTime.trim() ||
        !state.nextWorkingDayCommencementTime.trim() ||
        state.workingDays.length === 0 ||
        !state.timeZone.trim()
      ) {
        setSaveError(
          "The NOR commencement schedule needs a cutoff reference, cutoff time, same-day commencement time, next working-day commencement time, working days, and a contractual time zone.",
        );
        return;
      }
    }

    setSaving(true);
    setSaveError(null);

    try {
      if (state.clauseId) {
        await updateCpClause(state.clauseId, payload);
      } else {
        await createCpClause(charterParty.id, payload);
      }

      setEditorOpen(false);
      onReload();
    } catch (error: any) {
      setSaveError(error?.message ?? "Unable to save charter party term.");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditorOpen(false);
    setSaveError(null);
  }

  function renderEditorFields() {
    switch (state.clauseType) {
      case "laytime_rate":
        return (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                Laytime allowed (hours)
              </span>
              <input
                value={state.laytimeHours}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    laytimeHours: event.target.value,
                  }))
                }
                className="w-full outline-none"
                style={inputStyle}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                Notice period (hours)
              </span>
              <input
                value={state.noticeHours}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    noticeHours: event.target.value,
                  }))
                }
                className="w-full outline-none"
                style={inputStyle}
              />
            </label>
          </div>
        );
      case "demurrage_rate":
        return (
          <label className="flex flex-col gap-1">
            <span style={{ fontSize: "10px", color: "#6B7280" }}>
              Demurrage rate per day
            </span>
            <input
              value={state.demurrageRate}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  demurrageRate: event.target.value,
                }))
              }
              className="w-full outline-none"
              style={inputStyle}
            />
          </label>
        );
      case "despatch":
        return (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                Despatch rate per day
              </span>
              <input
                value={state.dispatchRate}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    dispatchRate: event.target.value,
                  }))
                }
                className="w-full outline-none"
                style={inputStyle}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                Multiplier
              </span>
              <input
                value={state.dispatchMultiplier}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    dispatchMultiplier: event.target.value,
                  }))
                }
                className="w-full outline-none"
                style={inputStyle}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                Despatch time basis
              </span>
              <select
                value={state.dispatchTimeBasis}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    dispatchTimeBasis: event.target
                      .value as ClauseEditorState["dispatchTimeBasis"],
                  }))
                }
                className="w-full appearance-none outline-none cursor-pointer"
                style={inputStyle}
              >
                <option value="">Select basis...</option>
                <option value="all_time_saved">All time saved</option>
                <option value="working_time_saved">Working time saved</option>
              </select>
            </label>
          </div>
        );
      case "shex_shinc":
        return (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                Laytime counting basis
              </span>
              <select
                value={state.laytimeBasis}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    laytimeBasis: event.target.value as ClauseEditorState["laytimeBasis"],
                  }))
                }
                className="w-full appearance-none outline-none cursor-pointer"
                style={inputStyle}
              >
                <option value="SHEX">SHEX</option>
                <option value="SHINC">SHINC</option>
              </select>
            </label>
            {state.laytimeBasis === "SHEX" && (
              <>
                <label className="flex flex-col gap-1">
                  <span style={{ fontSize: "10px", color: "#6B7280" }}>
                    Contractual timezone
                  </span>
                  <input
                    value={state.shexTimeZone}
                    onChange={(event) =>
                      setState((current) => ({ ...current, shexTimeZone: event.target.value }))
                    }
                    placeholder="e.g. Australia/Sydney"
                    className="w-full outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span style={{ fontSize: "10px", color: "#6B7280" }}>
                    Saturday excepted?
                  </span>
                  <select
                    value={state.shexSaturdayExcepted}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        shexSaturdayExcepted: event.target.value as ClauseEditorState["shexSaturdayExcepted"],
                        shexLegacySaturdayConflict: false,
                      }))
                    }
                    className="w-full appearance-none outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                  {state.shexLegacySaturdayConflict && (
                    <span style={{ fontSize: "10px", color: "#B45309" }}>
                      Conflicting legacy Saturday values found. Choose the contractual value explicitly.
                    </span>
                  )}
                </label>
                <div className="col-span-2 flex flex-col gap-2">
                  <span style={{ fontSize: "10px", color: "#6B7280" }}>
                    Contractual holiday dates (YYYY-MM-DD)
                  </span>
                  {state.shexHolidayDates.map((date, index) => (
                    <div key={`${index}-${date}`} className="flex gap-2">
                      <input
                        value={date}
                        onChange={(event) =>
                          setState((current) => {
                            const shexHolidayDates = [...current.shexHolidayDates];
                            shexHolidayDates[index] = event.target.value;
                            return { ...current, shexHolidayDates };
                          })
                        }
                        className="w-full outline-none"
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setState((current) => ({
                            ...current,
                            shexHolidayDates: current.shexHolidayDates.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                        className="rounded-lg border px-3"
                        style={{ borderColor: "#E5E7EB", fontSize: "10px", color: "#6B7280" }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        shexHolidayDates: [...current.shexHolidayDates, ""],
                      }))
                    }
                    className="self-start rounded-lg border px-3 py-1.5"
                    style={{ borderColor: "#D1D5DB", fontSize: "10px", color: "#374151" }}
                  >
                    Add holiday date
                  </button>
                </div>
              </>
            )}
          </div>
        );
      case "weather_working":
      case "wibon":
      case "wipon":
      case "wifpon":
      case "atutc":
        return (
          <label className="flex flex-col gap-1">
            <span style={{ fontSize: "10px", color: "#6B7280" }}>Enabled</span>
            <select
              value={state.enabled}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  enabled: event.target.value as ClauseEditorState["enabled"],
                }))
              }
              className="w-full appearance-none outline-none cursor-pointer"
              style={inputStyle}
            >
              <option value="Enabled">Enabled</option>
              <option value="Disabled">Disabled</option>
            </select>
          </label>
        );
      case "reversible_laytime":
        return (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: "10px", color: "#6B7280" }}>Enabled</span>
              <select
                value={state.enabled}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    enabled: event.target.value as ClauseEditorState["enabled"],
                  }))
                }
                className="w-full appearance-none outline-none cursor-pointer"
                style={inputStyle}
              >
                <option value="Enabled">Enabled</option>
                <option value="Disabled">Disabled</option>
              </select>
            </label>
            <p style={{ fontSize: "10px", color: "#6B7280", lineHeight: 1.45 }}>
              Pool the explicit Loading and Discharge laytime allowances into one combined allowance and one demurrage threshold. Both operations must complete for a final settlement. V1 supports working-time-saved despatch only.
            </p>
          </div>
        );
      case "nor_commencement_schedule":
        return (
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1">
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                Which NOR timestamp determines whether the same-day cutoff has
                been met?
              </span>
              <select
                value={state.cutoffReference}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    cutoffReference: event.target
                      .value as ClauseEditorState["cutoffReference"],
                  }))
                }
                className="w-full appearance-none outline-none cursor-pointer"
                style={inputStyle}
              >
                <option value="">Select NOR timestamp...</option>
                <option value="tenderTime">NOR tender time</option>
                <option value="acceptedTime">NOR acceptance time</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                Schedule cutoff time
              </span>
              <input
                value={state.tenderCutoffTime}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    tenderCutoffTime: event.target.value,
                  }))
                }
                className="w-full outline-none"
                placeholder="12:00"
                style={inputStyle}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                Same-day commencement time
              </span>
              <input
                value={state.sameDayCommencementTime}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    sameDayCommencementTime: event.target.value,
                  }))
                }
                className="w-full outline-none"
                placeholder="13:00"
                style={inputStyle}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                Next working-day commencement time
              </span>
              <input
                value={state.nextWorkingDayCommencementTime}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    nextWorkingDayCommencementTime: event.target.value,
                  }))
                }
                className="w-full outline-none"
                placeholder="08:00"
                style={inputStyle}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                Time zone
              </span>
              <input
                value={state.timeZone}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    timeZone: event.target.value,
                  }))
                }
                className="w-full outline-none"
                placeholder="Asia/Singapore"
                style={inputStyle}
              />
            </label>
            <div className="col-span-2">
              <p
                style={{
                  fontSize: "10px",
                  color: "#6B7280",
                  marginBottom: "6px",
                }}
              >
                Working days
              </p>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((day) => {
                  const checked = state.workingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        setState((current) => ({
                          ...current,
                          workingDays: checked
                            ? current.workingDays.filter(
                                (entry) => entry !== day,
                              )
                            : [...current.workingDays, day],
                        }))
                      }
                      className="rounded-full px-2.5 py-1 text-xs cursor-pointer"
                      style={{
                        border: `0.5px solid ${checked ? "#1A4ED8" : "#E5E7EB"}`,
                        backgroundColor: checked ? "#EFF6FF" : "#ffffff",
                        color: checked ? "#1E40AF" : "#374151",
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  function renderClauseControls() {
    return (
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="flex flex-col gap-1">
          <span style={{ fontSize: "10px", color: "#6B7280" }}>Term type</span>
          <div className="relative">
            <select
              value={state.clauseType}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  clauseType: event.target.value as SupportedClauseType,
                  scope: isGlobalOnlyType(
                    event.target.value as SupportedClauseType,
                  )
                    ? "Global"
                    : current.scope,
                }))
              }
              className="w-full appearance-none outline-none cursor-pointer"
              style={inputStyle}
            >
              {SUPPORTED_CLAUSE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {clauseLabel(option)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "#9CA3AF" }}
            />
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: "10px", color: "#6B7280" }}>Scope</span>
          <div className="relative">
            <select
              value={state.scope}
              disabled={isGlobalOnlyType(state.clauseType)}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  scope: event.target.value as ClauseScope,
                }))
              }
              className="w-full appearance-none outline-none cursor-pointer disabled:cursor-not-allowed"
              style={{
                ...inputStyle,
                backgroundColor: isGlobalOnlyType(state.clauseType)
                  ? "#F9FAFB"
                  : "#ffffff",
              }}
            >
              <option value="Global">Global</option>
              <option value="Loading">Loading</option>
              <option value="Discharge">Discharge</option>
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "#9CA3AF" }}
            />
          </div>
        </label>
      </div>
    );
  }

  const loadingResolution = {
    laytime: resolveClause(clauses, "laytime_rate", "Loading"),
    demurrage: resolveClause(clauses, "demurrage_rate", "Loading"),
    despatch: resolveClause(clauses, "despatch", "Loading"),
    shex: resolveClause(clauses, "shex_shinc", "Loading"),
    weather: resolveClause(clauses, "weather_working", "Loading"),
    wibon: resolveClause(clauses, "wibon", "Loading"),
    wipon: resolveClause(clauses, "wipon", "Loading"),
    wifpon: resolveClause(clauses, "wifpon", "Loading"),
  };

  const dischargeResolution = {
    laytime: resolveClause(clauses, "laytime_rate", "Discharge"),
    demurrage: resolveClause(clauses, "demurrage_rate", "Discharge"),
    despatch: resolveClause(clauses, "despatch", "Discharge"),
    shex: resolveClause(clauses, "shex_shinc", "Discharge"),
    weather: resolveClause(clauses, "weather_working", "Discharge"),
    wibon: resolveClause(clauses, "wibon", "Discharge"),
    wipon: resolveClause(clauses, "wipon", "Discharge"),
    wifpon: resolveClause(clauses, "wifpon", "Discharge"),
  };

  const norSchedule = resolveClause(
    clauses,
    "nor_commencement_schedule",
    "Global",
  );
  const atutc = resolveClause(clauses, "atutc", "Global");
  const reversible = resolveClause(clauses, "reversible_laytime", "Global");

  return (
    <div
      className="rounded-xl border p-[16px_18px]"
      style={{
        borderColor: "#E5E7EB",
        borderWidth: "0.5px",
        backgroundColor: "#ffffff",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p
            style={{
              fontSize: "10px",
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "4px",
            }}
          >
            Charter Party Terms
          </p>
          <p style={{ fontSize: "12px", color: "#6B7280", lineHeight: 1.45 }}>
            Global voyage terms are read-only here. Clause-backed terms for
            Loading, Discharge, NOR, ATUTC, reversible laytime, and port
            conditions can be edited using the real backend endpoints.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openNewClause("laytime_rate")}
          disabled={!charterParty || loading}
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 transition-colors cursor-pointer disabled:cursor-not-allowed"
          style={{
            fontSize: "11px",
            color: !charterParty || loading ? "#9CA3AF" : "#374151",
            borderColor: "#E5E7EB",
            borderWidth: "0.5px",
            backgroundColor: "#ffffff",
          }}
        >
          <Plus size={11} />
          Add term
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: "12px", color: "#6B7280" }}>
          Loading charter party terms...
        </p>
      ) : error ? (
        <p style={{ fontSize: "12px", color: "#B45309", lineHeight: 1.4 }}>
          Unable to load charter party terms: {error}
        </p>
      ) : !charterParty ? (
        <p style={{ fontSize: "12px", color: "#6B7280", lineHeight: 1.4 }}>
          No charter party is attached to this voyage yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border p-3" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
            <label className="flex flex-col gap-1 max-w-sm">
              <span style={{ fontSize: "11px", color: "#374151", fontWeight: 600 }}>Laytime applies to</span>
              <select
                value={operationScope}
                disabled={scopeSaving}
                onChange={(event) => {
                  const value = event.target.value as LaytimeOperationScope | "";
                  if (value) void saveOperationScope(value);
                }}
                className="w-full appearance-none outline-none cursor-pointer"
                style={inputStyle}
              >
                <option value="">Select contractual scope...</option>
                <option value="Loading">Loading only</option>
                <option value="Discharge">Discharge only</option>
                <option value="LoadingAndDischarge">Loading and Discharge</option>
              </select>
            </label>
            <p className="mt-1.5" style={{ fontSize: "10px", color: "#6B7280", lineHeight: 1.4 }}>
              Non-reversible final settlement requires an explicit scope. Loading and Discharge results remain independent.
            </p>
            {scopeError && <p className="mt-1" style={{ fontSize: "11px", color: "#B45309" }}>{scopeError}</p>}
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }}>
            <label className="flex flex-col gap-1 max-w-sm">
              <span style={{ fontSize: "11px", color: "#374151", fontWeight: 600 }}>Settlement currency</span>
              <div className="flex gap-2">
                <input
                  value={currencyInput}
                  disabled={currencySaving}
                  maxLength={3}
                  list="settlement-currency-codes"
                  placeholder="e.g. USD"
                  onChange={(event) => setCurrencyInput(event.target.value.toUpperCase())}
                  className="w-full outline-none"
                  style={inputStyle}
                />
                <button
                  type="button"
                  disabled={currencySaving}
                  onClick={() => void saveSettlementCurrency()}
                  className="rounded-lg border px-3 disabled:cursor-not-allowed"
                  style={{ borderColor: "#D1D5DB", backgroundColor: "#FFFFFF", fontSize: "11px", color: "#374151" }}
                >
                  Save
                </button>
              </div>
              <datalist id="settlement-currency-codes">
                {['USD', 'EUR', 'GBP', 'AUD', 'SGD', 'JPY', 'CNY', 'HKD', 'CAD', 'AED'].map((code) => <option key={code} value={code} />)}
              </datalist>
            </label>
            <p className="mt-1.5" style={{ fontSize: "10px", color: "#6B7280", lineHeight: 1.4 }}>
              ISO 4217 currency for all Laytime rates and amounts. Changes apply only to new calculation versions; recalculate to produce a new commercial result.
            </p>
            {currencyError && <p className="mt-1" style={{ fontSize: "11px", color: "#B45309" }}>{currencyError}</p>}
          </div>
          {editorOpen && (
            <div
              className="rounded-lg border p-3"
              style={{
                borderColor: "#E5E7EB",
                borderWidth: "0.5px",
                backgroundColor: "#F9FAFB",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#111827",
                  }}
                >
                  {state.clauseId ? "Edit term" : "New term"}
                </span>
              </div>

              {renderClauseControls()}

              <div className="mb-3">{renderEditorFields()}</div>

              {saveError && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "#B45309",
                    marginBottom: "8px",
                  }}
                >
                  {saveError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-md border px-3 py-1.5 text-xs cursor-pointer"
                  style={{
                    color: "#374151",
                    borderColor: "#E5E7EB",
                    borderWidth: "0.5px",
                    backgroundColor: "#ffffff",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void saveClause()}
                  disabled={saving}
                  className="rounded-md px-3 py-1.5 text-xs cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    color: "#ffffff",
                    backgroundColor: saving ? "#93C5FD" : "#1A4ED8",
                    border: "none",
                  }}
                >
                  {saving ? "Saving..." : "Save term"}
                </button>
              </div>
            </div>
          )}

          {hasNoticeAndSchedule && (
            <div
              className="flex items-start gap-2.5 rounded-lg p-[10px_12px]"
              style={{
                backgroundColor: "#FFFBEB",
                border: "0.5px solid #FDE68A",
                borderLeft: "2.5px solid #F59E0B",
              }}
            >
              <AlertTriangle
                size={13}
                style={{
                  color: "#B45309",
                  flexShrink: 0,
                  marginTop: "1px",
                }}
              />
              <p
                style={{ fontSize: "11px", color: "#7B341E", lineHeight: 1.4 }}
              >
                Conflicting NOR commencement terms. Both an explicit notice
                period and an office schedule are configured. The calculation
                will reject this configuration until one is removed.
              </p>
            </div>
          )}

          <SectionCard
            title="Global contract terms"
            note="These baseline terms are persisted on the voyage at creation time and are currently read-only in the UI."
          >
            {[
              {
                label: "Laytime allowed",
                value: formatHours(globalBase?.laytimeAllowed ?? null),
              },
              {
                label: "Demurrage rate",
                value: formatMoney(
                  globalBase?.demurrageRate ?? null,
                  charterParty.settlementCurrency,
                ),
              },
              {
                label: "Despatch rate",
                value: globalBase?.dispatchRate
                  ? formatMoney(
                      globalBase.dispatchRate,
                      charterParty.settlementCurrency,
                    )
                  : "Half demurrage fallback",
              },
              {
                label: "Laytime counting basis",
                value: formatCountingBasis(
                  globalBase?.timeCountingBasis ?? null,
                ),
              },
              {
                label: "Notice period",
                value: globalBase?.norNoticePeriod
                  ? formatNoticePeriod(globalBase.norNoticePeriod)
                  : "—",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-start justify-between gap-3 py-2"
                style={{ borderBottom: "0.5px solid #F3F4F6" }}
              >
                <div>
                  <p style={{ fontSize: "12px", color: "#6B7280" }}>
                    {row.label}
                  </p>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#111827",
                      fontWeight: 500,
                    }}
                  >
                    {row.value}
                  </p>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard
            title="Loading terms"
            note="Loading clauses may override the global baseline. If no loading-specific clause exists, the global term is shown as the fallback."
          >
            {renderOperationRows({
              scope: "Loading",
              laytime: loadingResolution.laytime,
              demurrage: loadingResolution.demurrage,
              despatch: loadingResolution.despatch,
              shex: loadingResolution.shex,
              weather: loadingResolution.weather,
              wibon: loadingResolution.wibon,
              wipon: loadingResolution.wipon,
              wifpon: loadingResolution.wifpon,
              onAdd: openNewClause,
            })}
          </SectionCard>

          <SectionCard
            title="Discharge terms"
            note="Discharge clauses may override the global baseline. If no discharge-specific clause exists, the global term is shown as the fallback."
          >
            {renderOperationRows({
              scope: "Discharge",
              laytime: dischargeResolution.laytime,
              demurrage: dischargeResolution.demurrage,
              despatch: dischargeResolution.despatch,
              shex: dischargeResolution.shex,
              weather: dischargeResolution.weather,
              wibon: dischargeResolution.wibon,
              wipon: dischargeResolution.wipon,
              wifpon: dischargeResolution.wifpon,
              onAdd: openNewClause,
            })}
          </SectionCard>

          <SectionCard
            title="NOR and other clauses"
            note="These terms are clause-backed and can be edited when persisted in the charter party."
          >
            {renderClauseCardRow({
              label: "NOR commencement schedule",
              value: norSchedule.clause
                ? formatNorSchedule(norSchedule.clause)
                : "Not set",
              sourceLabel:
                norSchedule.source === "global"
                  ? "Persisted clause"
                  : norSchedule.source === "missing"
                    ? "Not set"
                    : "Persisted clause",
              actionLabel: norSchedule.clause ? "Edit" : "Add",
              onAction: () =>
                openNewClause(
                  "nor_commencement_schedule",
                  "Global",
                  norSchedule.clause,
                ),
            })}
            {renderClauseCardRow({
              label: "ATUTC",
              value: formatYesNo(readEnabled(atutc.clause)),
              sourceLabel:
                atutc.source === "missing" ? "Not set" : "Persisted clause",
              actionLabel: atutc.clause ? "Edit" : "Add",
              onAction: () => openNewClause("atutc", "Global", atutc.clause),
            })}
            {renderClauseCardRow({
              label: "Reversible laytime",
              value: formatYesNo(readEnabled(reversible.clause)),
              sourceLabel:
                reversible.source === "missing"
                  ? "Not set"
                  : "Persisted clause",
              actionLabel: reversible.clause ? "Edit" : "Add",
              onAction: () =>
                openNewClause(
                  "reversible_laytime",
                  "Global",
                  reversible.clause,
                ),
            })}
          </SectionCard>
        </div>
      )}
    </div>
  );

  function renderClauseCardRow({
    label,
    value,
    sourceLabel,
    actionLabel,
    onAction,
  }: {
    label: string;
    value: string;
    sourceLabel?: string;
    actionLabel?: string;
    onAction?: () => void;
  }) {
    return termRow({
      label,
      value,
      sourceLabel,
      actionLabel,
      onAction,
    });
  }

  function renderOperationRows({
    scope,
    laytime,
    demurrage,
    despatch,
    shex,
    weather,
    wibon,
    wipon,
    wifpon,
    onAdd,
  }: {
    scope: ClauseOperation;
    laytime: ClauseResolution;
    demurrage: ClauseResolution;
    despatch: ClauseResolution;
    shex: ClauseResolution;
    weather: ClauseResolution;
    wibon: ClauseResolution;
    wipon: ClauseResolution;
    wifpon: ClauseResolution;
    onAdd: (
      clauseType: SupportedClauseType,
      scope?: ClauseScope,
      clause?: CpClause | null,
    ) => void;
  }) {
    const laytimeFallback =
      globalBase?.laytimeAllowed !== null &&
      globalBase?.laytimeAllowed !== undefined
        ? formatHours(globalBase.laytimeAllowed)
        : "—";
    const noticeFallback = globalBase?.norNoticePeriod
      ? formatNoticePeriod(globalBase.norNoticePeriod)
      : "—";
    const demurrageFallback =
      globalBase?.demurrageRate !== null &&
      globalBase?.demurrageRate !== undefined
        ? formatMoney(globalBase.demurrageRate, charterParty?.settlementCurrency)
        : "—";
    const despatchFallback =
      globalBase?.dispatchRate !== null &&
      globalBase?.dispatchRate !== undefined
        ? formatMoney(globalBase.dispatchRate, charterParty?.settlementCurrency)
        : "Half demurrage fallback";
    const countingBasisFallback = globalBase?.timeCountingBasis
      ? formatCountingBasis(globalBase.timeCountingBasis)
      : "—";

    const rows = [
      {
        clauseType: "laytime_rate" as const,
        label: "Laytime allowed",
        value: resolveLaytimeValue(laytime.clause, laytimeFallback),
        sourceLabel: sourceLabelFor(laytime, scope, laytimeFallback !== "—"),
      },
      {
        clauseType: "laytime_rate" as const,
        label: "Notice period",
        value: resolveLaytimeNoticeValue(laytime.clause, noticeFallback),
        sourceLabel: sourceLabelFor(laytime, scope, noticeFallback !== "—"),
      },
      {
        clauseType: "shex_shinc" as const,
        label: "Laytime counting basis",
        value: resolveLaytimeBasisValue(shex.clause, countingBasisFallback),
        sourceLabel: sourceLabelFor(shex, scope, countingBasisFallback !== "—"),
      },
      {
        clauseType: "demurrage_rate" as const,
        label: "Demurrage rate",
        value: resolveDemurrageValue(
          demurrage.clause,
          demurrageFallback,
          charterParty?.settlementCurrency,
        ),
        sourceLabel: sourceLabelFor(
          demurrage,
          scope,
          demurrageFallback !== "—",
        ),
      },
      {
        clauseType: "despatch" as const,
        label: "Despatch rate",
        value: resolveDespatchRate(
          despatch.clause,
          globalBase?.demurrageRate ?? null,
          despatchFallback,
          charterParty?.settlementCurrency,
        ),
        sourceLabel: sourceLabelFor(despatch, scope, despatchFallback !== "—"),
      },
      {
        clauseType: "despatch" as const,
        label: "Despatch time basis",
        value: resolveDespatchBasis(despatch.clause),
        sourceLabel: sourceLabelFor(despatch, scope, true),
      },
      {
        clauseType: "weather_working" as const,
        label: "Weather working",
        value: resolveToggleValue(weather.clause),
        sourceLabel: sourceLabelFor(weather, scope),
      },
      {
        clauseType: "wibon" as const,
        label: "WIBON",
        value: resolveToggleValue(wibon.clause),
        sourceLabel: sourceLabelFor(wibon, scope),
      },
      {
        clauseType: "wipon" as const,
        label: "WIPON",
        value: resolveToggleValue(wipon.clause),
        sourceLabel: sourceLabelFor(wipon, scope),
      },
      {
        clauseType: "wifpon" as const,
        label: "WIFPON",
        value: resolveToggleValue(wifpon.clause),
        sourceLabel: sourceLabelFor(wifpon, scope),
      },
    ];

    return (
      <div className="flex flex-col">
        {rows.map((row) => {
          const resolution =
            row.clauseType === "laytime_rate"
              ? laytime
              : row.clauseType === "shex_shinc"
                ? shex
                : row.clauseType === "demurrage_rate"
                  ? demurrage
                  : row.clauseType === "despatch"
                    ? despatch
                    : row.clauseType === "weather_working"
                      ? weather
                      : row.clauseType === "wibon"
                        ? wibon
                        : row.clauseType === "wipon"
                          ? wipon
                          : wifpon;

          const actionLabel =
            resolution.source === "operation"
              ? "Edit"
              : isOperationScopedType(row.clauseType)
                ? "Add override"
                : "Add";

          return (
            <div
              key={row.label}
              className="flex items-start justify-between gap-3 py-2"
              style={{ borderBottom: "0.5px solid #F3F4F6" }}
            >
              <div className="min-w-0">
                <p style={{ fontSize: "12px", color: "#6B7280" }}>
                  {row.label}
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#111827",
                    fontWeight: 500,
                  }}
                >
                  {row.value}
                </p>
                {row.sourceLabel && (
                  <p
                    style={{
                      fontSize: "10px",
                      color: "#9CA3AF",
                      marginTop: "1px",
                    }}
                  >
                    {row.sourceLabel}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  onAdd(
                    row.clauseType,
                    resolution.source === "operation"
                      ? clauseScope(resolution.clause?.parameters ?? null)
                      : scope,
                    resolution.clause,
                  )
                }
                className="rounded-md border px-2 py-1 text-xs cursor-pointer flex-shrink-0"
                style={{
                  color: "#374151",
                  borderColor: "#E5E7EB",
                  borderWidth: "0.5px",
                  backgroundColor: "#ffffff",
                }}
              >
                {actionLabel}
              </button>
            </div>
          );
        })}
      </div>
    );
  }
}

function sourceLabelFor(
  resolution: ClauseResolution,
  scope: ClauseOperation,
  hasFallback?: boolean,
) {
  if (resolution.source === "missing") {
    return hasFallback ? "Inherited from global terms" : "Not set";
  }

  if (resolution.source === "global") {
    return `Inherited from global terms`;
  }

  return `${scope} specific`;
}

function resolveLaytimeValue(clause: CpClause | null, fallback?: string) {
  const hours = clause?.parameters?.hours;
  if (hours !== undefined && hours !== null && hours !== "") {
    return `${hours} hours`;
  }

  return fallback ?? "—";
}

function resolveLaytimeNoticeValue(clause: CpClause | null, fallback?: string) {
  const hours = clause?.parameters?.noticeHours;
  if (hours !== undefined && hours !== null && hours !== "") {
    return `${hours} hours`;
  }

  return fallback ?? "—";
}

function resolveLaytimeBasisValue(
  clause: CpClause | null,
  fallback?: string | null,
) {
  const basis = clause?.parameters?.shex;
  if (typeof basis === "boolean") {
    return basis ? "SHEX" : "SHINC";
  }

  return fallback ? formatCountingBasis(fallback) : "—";
}

function resolveDemurrageValue(
  clause: CpClause | null,
  fallback?: string,
  currency?: string | null,
) {
  const rate = clause?.parameters?.rate;
  if (rate !== undefined && rate !== null && rate !== "") {
    return formatMoney(rate, currency);
  }

  return fallback ?? "—";
}

function resolveDespatchRate(
  clause: CpClause | null,
  demurrageFallback?: string | null,
  fallback?: string,
  currency?: string | null,
) {
  const rate = clause?.parameters?.rate;
  const multiplier = clause?.parameters?.multiplier;

  if (rate !== undefined && rate !== null && rate !== "") {
    return formatMoney(rate, currency);
  }

  if (multiplier !== undefined && multiplier !== null && multiplier !== "") {
    return `${multiplier} x demurrage`;
  }

  if (fallback && fallback !== "—") {
    return "Half demurrage fallback";
  }

  if (demurrageFallback) {
    return "Half demurrage fallback";
  }

  return "—";
}

function resolveDespatchBasis(clause: CpClause | null) {
  const basis = clause?.parameters?.timeBasis;
  if (basis === "working_time_saved") {
    return formatBasis("working_time_saved");
  }

  if (basis === "all_time_saved") {
    return formatBasis("all_time_saved");
  }

  return "All time saved";
}

function resolveToggleValue(clause: CpClause | null) {
  const enabled = clause?.parameters?.enabled;
  if (typeof enabled === "boolean") {
    return formatYesNo(enabled);
  }

  return "—";
}

function formatNorSchedule(clause: CpClause) {
  const parameters = clause.parameters ?? {};
  return [
    `Cutoff reference: ${parameters.cutoffReference === "tenderTime" ? "NOR tender time" : parameters.cutoffReference === "acceptedTime" ? "NOR acceptance time" : "Legacy effective NOR time"}`,
    `Cutoff: ${String(parameters.tenderCutoffTime ?? "—")}`,
    `If reference time is before cutoff: ${String(parameters.sameDayCommencementTime ?? "—")} same day`,
    `After cutoff: ${String(parameters.nextWorkingDayCommencementTime ?? "—")} next working day`,
    `Working days: ${formatWorkingDays(parseWorkingDays(parameters.workingDays))}`,
    `Time zone: ${String(parameters.timeZone ?? "—")}`,
  ].join(" | ");
}

function readEnabled(clause: CpClause | null) {
  const enabled = clause?.parameters?.enabled;

  if (typeof enabled === "boolean") {
    return enabled;
  }

  return null;
}

const inputStyle: React.CSSProperties = {
  height: "34px",
  border: "0.5px solid #E5E7EB",
  borderRadius: "8px",
  padding: "0 10px",
  fontSize: "12px",
  color: "#111827",
  backgroundColor: "#ffffff",
  transition: "border-color 0.15s",
};
