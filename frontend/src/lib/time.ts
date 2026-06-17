import { format } from 'date-fns';
import { useEffect, useState } from 'react';

const PKT_TZ = 'Asia/Karachi';
const CET_TZ = 'Europe/Copenhagen';

function formatInTz(iso: string, tz: string, withDate = true): string {
  try {
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions = withDate
      ? { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }
      : { timeStyle: 'short', timeZone: tz };
    return new Intl.DateTimeFormat('en-US', opts).format(d);
  } catch {
    return iso;
  }
}

export const formatPKT = (iso: string, withDate = true) =>
  `${formatInTz(iso, PKT_TZ, withDate)} PKT`;

export const formatCET = (iso: string, withDate = true) =>
  `${formatInTz(iso, CET_TZ, withDate)} CET`;

export const formatLocal = (iso: string, fmt = 'MMM d, yyyy — h:mm a') => {
  try {
    return format(new Date(iso), fmt);
  } catch {
    return iso;
  }
};

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  expired: boolean;
}

export function useCountdown(target: string | Date | null): Countdown {
  const compute = (): Countdown => {
    if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true };
    const t = typeof target === 'string' ? new Date(target) : target;
    const diff = t.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true };
    return {
      days: Math.floor(diff / 86_400_000),
      hours: Math.floor((diff % 86_400_000) / 3_600_000),
      minutes: Math.floor((diff % 3_600_000) / 60_000),
      seconds: Math.floor((diff % 60_000) / 1000),
      totalMs: diff,
      expired: false,
    };
  };

  const [c, setC] = useState<Countdown>(compute);

  useEffect(() => {
    setC(compute());
    const id = setInterval(() => setC(compute()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeof target === 'string' ? target : target?.toString()]);

  return c;
}

export const isJoinable = (scheduledAt: string, durationMin: number): boolean => {
  const start = new Date(scheduledAt).getTime();
  const end = start + durationMin * 60_000;
  const now = Date.now();
  return now >= start - 15 * 60_000 && now <= end;
};

// ── Timezone helpers ─────────────────────────────────────────────────────────
// The teacher operates from Pakistan; students set their own IANA zone in
// Settings so session times can be shown in "their" time and compared to the
// teacher's. NULL/unknown falls back to the browser's resolved zone.

export const TEACHER_TIMEZONE = PKT_TZ; // 'Asia/Karachi'

export const browserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || TEACHER_TIMEZONE;
  } catch {
    return TEACHER_TIMEZONE;
  }
};

// All IANA zones the runtime knows about, with a sane fallback for older
// engines that lack Intl.supportedValuesOf.
export const timezoneList = (): string[] => {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (fn) return fn('timeZone');
  } catch {
    /* fall through */
  }
  return [
    'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Singapore',
    'Asia/Tokyo', 'Asia/Shanghai', 'Europe/London', 'Europe/Copenhagen', 'Europe/Berlin',
    'Europe/Paris', 'Europe/Moscow', 'Africa/Cairo', 'America/New_York', 'America/Chicago',
    'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo', 'Australia/Sydney', 'Pacific/Auckland',
  ];
};

// "9:30 PM" in a given zone (optionally with the date).
export const formatInTimezone = (iso: string | Date, tz: string, withDate = false): string => {
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    const opts: Intl.DateTimeFormatOptions = withDate
      ? { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }
      : { timeStyle: 'short', timeZone: tz };
    return new Intl.DateTimeFormat('en-US', opts).format(d);
  } catch {
    return String(iso);
  }
};

// Short GMT offset label for a zone, e.g. "GMT+5". Computed from the actual
// formatted offset so DST is respected.
export const tzOffsetLabel = (tz: string, at: Date = new Date()): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(at);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
};

// Whole-hour-ish difference of `tz` relative to the teacher's zone, as a signed
// label like "+3h ahead" / "2h behind" / "Same time".
export const tzDeltaFromTeacher = (tz: string, at: Date = new Date()): string => {
  try {
    const minutesIn = (zone: string) => {
      const s = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
      const [h, m] = s.split(':').map(Number);
      return h * 60 + m;
    };
    let diff = minutesIn(tz) - minutesIn(TEACHER_TIMEZONE);
    // Normalise to (-12h, +12h] so wrap-around across midnight reads correctly.
    if (diff > 720) diff -= 1440;
    if (diff <= -720) diff += 1440;
    if (diff === 0) return 'Same time as teacher';
    const ahead = diff > 0;
    const abs = Math.abs(diff);
    const h = Math.floor(abs / 60);
    const min = abs % 60;
    const parts = [h ? `${h}h` : '', min ? `${min}m` : ''].filter(Boolean).join(' ');
    return `${parts} ${ahead ? 'ahead of' : 'behind'} teacher`;
  } catch {
    return '';
  }
};
