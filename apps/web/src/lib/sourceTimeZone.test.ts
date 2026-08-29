import { describe, expect, it } from "vitest";
import { resolveLocalDateTimeInTimeZone } from "./sourceTimeZone";

describe("source timezone conversion", () => {
  it("keeps Brisbane civil time independent of browser timezone and DST", () => {
    const start = resolveLocalDateTimeInTimeZone(
      "2026-10-02T14:30",
      "Australia/Brisbane",
    );
    const end = resolveLocalDateTimeInTimeZone(
      "2026-10-06T14:30",
      "Australia/Brisbane",
    );
    expect((Date.parse(end) - Date.parse(start)) / 3600000).toBe(96);
  });
  it("applies real Sydney DST rules", () => {
    const start = resolveLocalDateTimeInTimeZone(
      "2026-10-02T14:30",
      "Australia/Sydney",
    );
    const end = resolveLocalDateTimeInTimeZone(
      "2026-10-06T14:30",
      "Australia/Sydney",
    );
    expect((Date.parse(end) - Date.parse(start)) / 3600000).toBe(95);
  });
  it("resolves operation timezones independently", () => {
    expect(
      resolveLocalDateTimeInTimeZone("2026-10-02T14:30", "Asia/Singapore"),
    ).toBe("2026-10-02T06:30:00.000Z");
    expect(
      resolveLocalDateTimeInTimeZone("2026-10-02T14:30", "Australia/Brisbane"),
    ).toBe("2026-10-02T04:30:00.000Z");
  });
  it("resolves Perth local time to the correct UTC instant", () => {
    expect(
      resolveLocalDateTimeInTimeZone("2026-10-10T08:00", "Australia/Perth"),
    ).toBe("2026-10-10T00:00:00.000Z");
    expect(
      resolveLocalDateTimeInTimeZone("2026-10-10T08:25", "Australia/Perth"),
    ).toBe("2026-10-10T00:25:00.000Z");
  });
  it("does not depend on the process timezone when resolving source-local time", () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = "America/Los_Angeles";
      expect(
        resolveLocalDateTimeInTimeZone("2026-10-10T08:25", "Australia/Perth"),
      ).toBe("2026-10-10T00:25:00.000Z");
      process.env.TZ = "Europe/London";
      expect(
        resolveLocalDateTimeInTimeZone("2026-10-10T08:25", "Australia/Perth"),
      ).toBe("2026-10-10T00:25:00.000Z");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
  it("rejects invalid identifiers", () => {
    expect(() =>
      resolveLocalDateTimeInTimeZone("2026-10-02T14:30", "Not/AZone"),
    ).toThrow(/IANA/);
  });
});
