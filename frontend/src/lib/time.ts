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
