import { format, formatDistanceToNowStrict } from 'date-fns';

export const fmtSimTime = (ms: number | null): string => {
  if (ms === null) return '—';
  return format(ms, 'HH:mm');
};

export const fmtSimDate = (ms: number | null): string => {
  if (ms === null) return '—';
  return format(ms, 'd MMM HH:mm');
};

export const fmtAgo = (wallMs: number): string => {
  return formatDistanceToNowStrict(wallMs, { addSuffix: true });
};

// Parse "HH:mm" into minutes-since-midnight.
export const parseHM = (hm: string): number => {
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
};

// Is the current wall-clock time within [start, end] (handling wrap)?
export const isQuietNow = (start: string, end: string, now = new Date()): boolean => {
  const s = parseHM(start);
  const e = parseHM(end);
  const n = now.getHours() * 60 + now.getMinutes();
  if (s === e) return false;
  return s < e ? n >= s && n < e : n >= s || n < e;
};
