import type { TimelineEvent, TimelineNodeInput, TimelinePalette, TimelineTimeValue } from './types';

export function normalizeTimelinePayload(data: unknown): TimelineNodeInput[] {
  if (Array.isArray(data)) {
    return data as TimelineNodeInput[];
  }

  if (data && typeof data === 'object' && Array.isArray((data as { nodes?: unknown[] }).nodes)) {
    return (data as { nodes: TimelineNodeInput[] }).nodes;
  }

  return [];
}

export function truncateText(text: string, maxLength: number): string {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxLength - 1, 1))}...`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizeEventLabel(text: string): string {
  return String(text || '')
    .split('\\')
    .pop()!
    .split('/')
    .pop()!
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getEventTitle(event: TimelineNodeInput): string {
  if (event.data && typeof event.data.event === 'string') {
    return String(event.data.event).trim();
  }

  if (event.label) {
    return String(event.label).trim();
  }

  return sanitizeEventLabel(event.key || 'Untitled event');
}

export function formatTimeRange(time: TimelineTimeValue[]): string {
  if (!time.length) {
    return 'Unknown time';
  }

  if (time.length === 1 || time[0] === time[1]) {
    return String(time[0]);
  }

  return `${time[0]} - ${time[1]}`;
}

export function formatEventLocation(space: string[]): string {
  if (!space.length) {
    return 'Unknown location';
  }

  return space.join(', ');
}

export function parseTimelineYear(value: TimelineTimeValue | undefined, position: 'start' | 'end' = 'start'): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value || '').trim();
  if (!raw) {
    return 0;
  }

  const normalized = raw.toLowerCase();
  const isBce = /\b(bce|bc)\b/.test(normalized);
  const centuryMatch = normalized.match(/(\d+)(st|nd|rd|th)\s+century/);
  if (centuryMatch) {
    const century = parseInt(centuryMatch[1], 10);
    if (isBce) {
      return position === 'end' ? -((century - 1) * 100) : -(century * 100);
    }

    return position === 'end' ? century * 100 : (century - 1) * 100;
  }

  const decadeMatch = normalized.match(/(-?\d{2,4})s\b/);
  if (decadeMatch) {
    const decade = parseInt(decadeMatch[1], 10);
    return position === 'end' ? decade + 9 : decade;
  }

  const yearMatch = normalized.match(/-?\d+/);
  if (yearMatch) {
    const parsed = parseInt(yearMatch[0], 10);
    return isBce && parsed > 0 ? -parsed : parsed;
  }

  return 0;
}

export function formatYearLabel(year: number): string {
  if (year < 0) {
    return `${Math.abs(year)} BCE`;
  }

  return String(year);
}

export function getAdaptiveYearInterval(range: number): number {
  const intervals = [10, 25, 50, 100, 200, 250, 500, 1000];
  const target = Math.max(range / 10, 1);
  return intervals.find(interval => interval >= target) || intervals[intervals.length - 1];
}

export function getBranchColor(index: number, sharedCount = 1): TimelinePalette {
  const hue = (index * 67 + 18) % 360;
  const saturation = sharedCount > 1 ? 74 : 68;

  return {
    fill: `hsla(${hue}, ${saturation}%, 84%, 0.9)`,
    stroke: `hsla(${hue}, ${saturation + 4}%, 42%, 0.7)`,
    accent: `hsla(${hue}, ${saturation + 8}%, 36%, 0.92)`,
    glow: `hsla(${hue}, ${Math.max(saturation - 8, 42)}%, 58%, 0.16)`,
    connector: `hsla(${hue}, ${Math.max(saturation - 10, 34)}%, 52%, 0.42)`,
    badge: `hsla(${hue}, ${Math.max(saturation - 14, 34)}%, 96%, 0.88)`,
  };
}

export function getEventPalette(event: TimelineEvent): TimelinePalette {
  const branchIndex = Number.isFinite(event.primaryBranchIndex) ? event.primaryBranchIndex : 0;
  const sharedCount = event.branchRoots.length || 1;
  return getBranchColor(branchIndex, sharedCount);
}