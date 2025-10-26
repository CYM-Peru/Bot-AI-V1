import { CustomSchedule, DateException, TimeWindow, Weekday } from "./types";

export interface ZonedDayParts {
  isoDate: string;
  weekday: Weekday;
  minutes: number;
  year: number;
  month: number;
  day: number;
}

const WEEKDAY_LABEL_TO_INDEX: Record<string, Weekday> = {
  Sun: 7,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const WEEKDAY_INDEX_TO_LABEL: Record<Weekday, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export function parseHHmm(value: string): { hours: number; minutes: number } | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
  const hours = Number.parseInt(trimmed.slice(0, 2), 10);
  const minutes = Number.parseInt(trimmed.slice(3, 5), 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function minutesFromHHmm(value: string): number | null {
  const parsed = parseHHmm(value);
  if (!parsed) return null;
  return parsed.hours * 60 + parsed.minutes;
}

function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function getZonedParts(date: Date, timeZone: string): ZonedDayParts | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    });
    const parts = formatter.formatToParts(date);
    const lookup: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== "literal") {
        lookup[part.type] = part.value;
      }
    }
    const weekdayLabel = lookup.weekday;
    const weekday = WEEKDAY_LABEL_TO_INDEX[weekdayLabel as keyof typeof WEEKDAY_LABEL_TO_INDEX];
    if (!weekday) return null;
    const year = Number.parseInt(lookup.year, 10);
    const month = Number.parseInt(lookup.month, 10);
    const day = Number.parseInt(lookup.day, 10);
    const hour = Number.parseInt(lookup.hour, 10);
    const minute = Number.parseInt(lookup.minute, 10);
    if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
      return null;
    }
    return {
      isoDate: toIsoDate(year, month, day),
      weekday,
      minutes: hour * 60 + minute,
      year,
      month,
      day,
    };
  } catch (error) {
    console.error("Failed to compute zoned parts", error);
    return null;
  }
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + amount);
  return next;
}

function normalizeWindow(window: TimeWindow): TimeWindow {
  const startMinutes = minutesFromHHmm(window.start);
  const endMinutes = minutesFromHHmm(window.end);
  if (startMinutes != null && endMinutes != null && startMinutes > endMinutes && !window.overnight) {
    return { ...window, overnight: true };
  }
  return window;
}

function findException(exceptions: DateException[] | undefined, isoDate: string): DateException | undefined {
  if (!exceptions || exceptions.length === 0) return undefined;
  return exceptions.find((exception) => exception.date === isoDate);
}

function windowsForDay(parts: ZonedDayParts, schedule: CustomSchedule): TimeWindow[] {
  const exception = findException(schedule.exceptions, parts.isoDate);
  if (exception) {
    if (exception.closed) {
      return [];
    }
    if (exception.start && exception.end) {
      return [
        {
          weekdays: [parts.weekday],
          start: exception.start,
          end: exception.end,
          overnight:
            exception.start && exception.end
              ? minutesFromHHmm(exception.start)! > minutesFromHHmm(exception.end)!
              : undefined,
        },
      ];
    }
  }
  return schedule.windows.filter((window) => window.weekdays.includes(parts.weekday)).map(normalizeWindow);
}

export function isInWindow(now: Date, schedule: CustomSchedule): boolean {
  if (!schedule.timezone || schedule.windows.length === 0) return false;
  const currentParts = getZonedParts(now, schedule.timezone);
  if (!currentParts) return false;
  const currentMinutes = currentParts.minutes;
  const todayWindows = windowsForDay(currentParts, schedule).map(normalizeWindow);
  for (const window of todayWindows) {
    const start = minutesFromHHmm(window.start);
    const end = minutesFromHHmm(window.end);
    if (start == null || end == null) continue;
    if (window.overnight) {
      if (currentMinutes >= start) {
        return true;
      }
    } else if (currentMinutes >= start && currentMinutes < end) {
      return true;
    }
  }

  const previousParts = getZonedParts(addDays(now, -1), schedule.timezone);
  if (!previousParts) return false;
  const previousWindows = windowsForDay(previousParts, schedule).map(normalizeWindow);
  for (const window of previousWindows) {
    if (!window.overnight) continue;
    const end = minutesFromHHmm(window.end);
    if (end == null) continue;
    if (currentMinutes < end) {
      return true;
    }
  }

  return false;
}

export interface NextOpeningInfo {
  isoDate: string;
  weekday: Weekday;
  start: string;
  end: string;
  overnight?: boolean;
}

export function nextOpening(now: Date, schedule: CustomSchedule): NextOpeningInfo | null {
  if (!schedule.timezone || schedule.windows.length === 0) return null;
  const currentParts = getZonedParts(now, schedule.timezone);
  if (!currentParts) return null;
  const currentMinutes = currentParts.minutes;
  const maxDays = 30;
  for (let offset = 0; offset <= maxDays; offset += 1) {
    const parts = offset === 0 ? currentParts : getZonedParts(addDays(now, offset), schedule.timezone);
    if (!parts) continue;
    const windows = windowsForDay(parts, schedule).map(normalizeWindow);
    for (const window of windows) {
      const start = minutesFromHHmm(window.start);
      const end = minutesFromHHmm(window.end);
      if (start == null || end == null) continue;
      if (offset === 0 && currentMinutes >= start) {
        continue;
      }
      return {
        isoDate: parts.isoDate,
        weekday: parts.weekday,
        start: window.start,
        end: window.end,
        overnight: window.overnight,
      };
    }
  }
  return null;
}

export function describeWeekday(weekday: Weekday): string {
  return WEEKDAY_INDEX_TO_LABEL[weekday] ?? "";
}

export function validateCustomSchedule(schedule: CustomSchedule | undefined): string[] {
  const errors: string[] = [];
  if (!schedule) {
    return ["Configura un horario personalizado."];
  }
  if (!schedule.timezone) {
    errors.push("Selecciona una zona horaria");
  }
  if (!schedule.windows || schedule.windows.length === 0) {
    errors.push("Agrega al menos una ventana horaria");
  }
  schedule.windows.forEach((window, index) => {
    const start = minutesFromHHmm(window.start);
    const end = minutesFromHHmm(window.end);
    if (start == null) {
      errors.push(`Ventana ${index + 1}: hora de inicio inválida`);
    }
    if (end == null) {
      errors.push(`Ventana ${index + 1}: hora de fin inválida`);
    }
    if (start != null && end != null && start >= end && !window.overnight) {
      errors.push(`Ventana ${index + 1}: el inicio debe ser menor que el fin (o marca overnight)`);
    }
    if (!window.weekdays || window.weekdays.length === 0) {
      errors.push(`Ventana ${index + 1}: selecciona al menos un día`);
    }
  });
  return errors;
}

export function formatNextOpening(info: NextOpeningInfo | null): string | null {
  if (!info) return null;
  const label = describeWeekday(info.weekday);
  return `${label} · ${info.start}`;
}
