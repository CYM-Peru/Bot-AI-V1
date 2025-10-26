import { describe, expect, it } from "vitest";
import {
  formatNextOpening,
  getZonedParts,
  isInWindow,
  nextOpening,
  parseHHmm,
  validateCustomSchedule,
} from "../flow/scheduler";
import type { CustomSchedule } from "../flow/types";

function createZonedDate(isoDate: string, time: string, timeZone: string): Date {
  const [year, month, day] = isoDate.split("-").map((value) => Number.parseInt(value, 10));
  const [hours, minutes] = time.split(":").map((value) => Number.parseInt(value, 10));
  const baseUtc = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const guess = new Date(baseUtc);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(guess);
  const offsetLabel = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-]?)(\d{1,2})(?::(\d{2}))?/i.exec(offsetLabel);
  const sign = match?.[1] === "-" ? -1 : 1;
  const hourOffset = match ? Number.parseInt(match[2] ?? "0", 10) : 0;
  const minuteOffset = match ? Number.parseInt(match[3] ?? "0", 10) : 0;
  const offsetMinutes = sign * (hourOffset * 60 + minuteOffset);
  const utcMillis = Date.UTC(year, month - 1, day, hours, minutes) - offsetMinutes * 60_000;
  return new Date(utcMillis);
}

describe("scheduler utilities", () => {
  const baseSchedule: CustomSchedule = {
    timezone: "America/Lima",
    windows: [
      { weekdays: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" },
      { weekdays: [6], start: "10:00", end: "14:00" },
    ],
    exceptions: [
      { date: "2024-12-25", closed: true },
      { date: "2024-12-31", start: "08:00", end: "12:00" },
    ],
  };

  it("parses HH:mm strings", () => {
    expect(parseHHmm("09:30")).toEqual({ hours: 9, minutes: 30 });
    expect(parseHHmm("24:00")).toBeNull();
    expect(parseHHmm("abc")).toBeNull();
  });

  it("detects active windows including overnight spans", () => {
    const inside = createZonedDate("2024-06-03", "10:00", baseSchedule.timezone);
    expect(isInWindow(inside, baseSchedule)).toBe(true);
    const outside = createZonedDate("2024-06-03", "20:30", baseSchedule.timezone);
    expect(isInWindow(outside, baseSchedule)).toBe(false);

    const overnightSchedule: CustomSchedule = {
      timezone: "America/Lima",
      windows: [{ weekdays: [5], start: "22:00", end: "06:00", overnight: true }],
    };
    const overnightStart = createZonedDate("2024-06-07", "23:00", overnightSchedule.timezone);
    expect(isInWindow(overnightStart, overnightSchedule)).toBe(true);
    const overnightAfterMidnight = createZonedDate("2024-06-08", "02:30", overnightSchedule.timezone);
    expect(isInWindow(overnightAfterMidnight, overnightSchedule)).toBe(true);
  });

  it("respects closed exceptions", () => {
    const closedDay = createZonedDate("2024-12-25", "10:00", baseSchedule.timezone);
    expect(isInWindow(closedDay, baseSchedule)).toBe(false);
  });

  it("finds next opening slot", () => {
    const moment = createZonedDate("2024-06-03", "19:00", baseSchedule.timezone);
    const next = nextOpening(moment, baseSchedule);
    expect(next).not.toBeNull();
    expect(next?.isoDate).toBe("2024-06-04");
    expect(next?.start).toBe("09:00");
    expect(formatNextOpening(next)).toContain("09:00");
  });

  it("validates schedules and reports issues", () => {
    const errors = validateCustomSchedule({ timezone: "", windows: [] });
    expect(errors).toEqual([
      "Selecciona una zona horaria",
      "Agrega al menos una ventana horaria",
    ]);

    const invalidWindowErrors = validateCustomSchedule({
      timezone: "America/Lima",
      windows: [{ weekdays: [], start: "10:00", end: "09:00" }],
    });
    expect(invalidWindowErrors.some((error) => error.includes("inicio"))).toBe(true);
    expect(invalidWindowErrors.some((error) => error.includes("selecciona"))).toBe(true);
  });

  it("exposes zoned parts helper for inspection", () => {
    const sample = createZonedDate("2024-06-03", "11:15", baseSchedule.timezone);
    const parts = getZonedParts(sample, baseSchedule.timezone);
    expect(parts?.isoDate).toBe("2024-06-03");
    expect(parts?.minutes).toBe(11 * 60 + 15);
  });
});
