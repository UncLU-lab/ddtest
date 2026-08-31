/**
 * Event types supported by the current manual SOF timeline and laytime
 * engine. Fixture imports intentionally accept this finite contract rather
 * than arbitrary event_type strings.
 */
export const SOF_GLOBAL_EVENT_TYPES = [
  'NOR_TENDERED',
  'VESSEL_READY_IN_ALL_RESPECTS',
  'FREE_PRATIQUE_GRANTED',
  'RAIN_STOPPAGE',
  'RAIN_COMMENCED',
  'WEATHER_STOPPAGE',
  'RAIN_STOPPED',
  'WEATHER_CLEARED',
  'BREAKDOWN',
  'STOPPAGE_START',
  'WORK_STOPPED',
  'BREAKDOWN_REPAIRED',
  'STOPPAGE_END',
  'WORK_RESUMED',
  'CARGO_STARTED',
  'CARGO_COMPLETED',
  'COMPLETION_OF_CARGO',
  'HOSES_DISCONNECTED',
] as const;

export const SOF_COMPLETION_EVENT_TYPES = [
  'CARGO_COMPLETED',
  'LOADING_COMPLETED',
  'DISCHARGE_COMPLETED',
  'COMPLETION_OF_CARGO',
  'HOSES_DISCONNECTED',
] as const;

export const SUPPORTED_SOF_EVENT_TYPES = [
  ...SOF_GLOBAL_EVENT_TYPES,
  ...SOF_COMPLETION_EVENT_TYPES,
  'HATCHES_CLOSED',
  'CARGO_SECURED',
] as const;

export type SupportedSofEventType = (typeof SUPPORTED_SOF_EVENT_TYPES)[number];
