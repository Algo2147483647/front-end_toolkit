import type {
  TimelineEvent,
  TimelineNodeInput,
  TimelinePalette,
  TimelineSpaceInput,
  TimelineSpaceNormalized,
  TimelineSpaceType,
  TimelineSpaceValueInput,
  TimelineTimeInput,
  TimelineTimeNormalized,
  TimelineTimeType,
  TimelineTimeValue,
  TimelineTimeValueInput,
} from './types';

const TIME_TYPE_SET = new Set<TimelineTimeType>(['year', 'year_month', 'date', 'datetime', 'text']);
const SPACE_TYPE_SET = new Set<TimelineSpaceType>(['latitude_and_longitude', 'named_place', 'bounding_box', 'polygon', 'multi_location']);

export function normalizeTimelinePayload(data: unknown): TimelineNodeInput[] {
  if (Array.isArray(data)) {
    return data as TimelineNodeInput[];
  }

  if (data && typeof data === 'object' && Array.isArray((data as { nodes?: unknown[] }).nodes)) {
    return (data as { nodes: TimelineNodeInput[] }).nodes;
  }

  if (data && typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>).reduce<TimelineNodeInput[]>((items, [key, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return items;
      }

      items.push({
        ...(value as Omit<TimelineNodeInput, 'key'>),
        key,
      });

      return items;
    }, []);
  }

  return [];
}

function asNonEmptyString(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = Number(String(value ?? '').trim());
  return Number.isFinite(normalized) ? normalized : undefined;
}

function normalizeTimelineValue(value: unknown): TimelineTimeValue {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? '').trim();
  if (!text) {
    return 0;
  }

  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const numberValue = Number(text);
    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return text;
}

export function areTimelineValuesEqual(a: TimelineTimeValue, b: TimelineTimeValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b;
  }

  return String(a).trim() === String(b).trim();
}

export function normalizeTimeInput(time: TimelineTimeValueInput | undefined): TimelineTimeNormalized {
  if (Array.isArray(time)) {
    const start = normalizeTimelineValue(time[0]);
    const end = normalizeTimelineValue(time[time.length - 1] ?? start);
    return {
      type: 'year',
      start,
      end,
    };
  }

  if (time && typeof time === 'object') {
    const timeObject = time as TimelineTimeInput;
    const rawType = asNonEmptyString(timeObject.type)?.toLowerCase() || 'year';
    const type = TIME_TYPE_SET.has(rawType as TimelineTimeType) ? (rawType as TimelineTimeType) : 'year';
    const start = normalizeTimelineValue(timeObject.start);
    const end = normalizeTimelineValue(timeObject.end ?? start);

    return {
      type,
      start,
      end,
    };
  }

  return {
    type: 'year',
    start: 0,
    end: 0,
  };
}

function normalizeSpaceCoordinates(value: unknown): [number, number][] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const coordinates = value
    .map(item => {
      if (!Array.isArray(item) || item.length < 2) {
        return null;
      }

      const lng = asNumber(item[0]);
      const lat = asNumber(item[1]);
      if (lng === undefined || lat === undefined) {
        return null;
      }

      return [lng, lat] as [number, number];
    })
    .filter((item): item is [number, number] => item !== null);

  return coordinates.length ? coordinates : undefined;
}

export function normalizeSpaceInput(space: TimelineSpaceValueInput | undefined, depth = 0): TimelineSpaceNormalized {
  if (Array.isArray(space)) {
    const namedPlaces = space
      .map(item => asNonEmptyString(item))
      .filter((item): item is string => Boolean(item));

    if (namedPlaces.length <= 1) {
      return {
        type: 'named_place',
        named_place: namedPlaces[0] || 'Unknown location',
      };
    }

    return {
      type: 'multi_location',
      locations: namedPlaces.map(namedPlace => ({
        type: 'named_place',
        named_place: namedPlace,
      })),
    };
  }

  if (space && typeof space === 'object') {
    const spaceObject = space as TimelineSpaceInput;
    const rawType = asNonEmptyString(spaceObject.type)?.toLowerCase();
    const inferredType =
      (rawType && SPACE_TYPE_SET.has(rawType as TimelineSpaceType) && (rawType as TimelineSpaceType)) ||
      (asNumber(spaceObject.latitude) !== undefined && asNumber(spaceObject.longitude) !== undefined
        ? 'latitude_and_longitude'
        : Array.isArray(spaceObject.locations)
          ? 'multi_location'
          : asNumber(spaceObject.north) !== undefined &&
              asNumber(spaceObject.south) !== undefined &&
              asNumber(spaceObject.east) !== undefined &&
              asNumber(spaceObject.west) !== undefined
            ? 'bounding_box'
            : Array.isArray(spaceObject.coordinates)
              ? 'polygon'
              : 'named_place');

    const namedPlace =
      asNonEmptyString(spaceObject.named_place) ||
      asNonEmptyString(spaceObject.location) ||
      asNonEmptyString(spaceObject.site) ||
      asNonEmptyString(spaceObject.city) ||
      asNonEmptyString(spaceObject.country) ||
      undefined;

    if (inferredType === 'latitude_and_longitude') {
      return {
        type: 'latitude_and_longitude',
        named_place: namedPlace,
        latitude: asNumber(spaceObject.latitude),
        longitude: asNumber(spaceObject.longitude),
        altitude: asNumber(spaceObject.altitude),
        radius_km: asNumber(spaceObject.radius_km),
      };
    }

    if (inferredType === 'bounding_box') {
      return {
        type: 'bounding_box',
        named_place: namedPlace,
        north: asNumber(spaceObject.north),
        south: asNumber(spaceObject.south),
        east: asNumber(spaceObject.east),
        west: asNumber(spaceObject.west),
      };
    }

    if (inferredType === 'polygon') {
      return {
        type: 'polygon',
        named_place: namedPlace,
        coordinates: normalizeSpaceCoordinates(spaceObject.coordinates),
      };
    }

    if (inferredType === 'multi_location') {
      const rawLocations = Array.isArray(spaceObject.locations) ? spaceObject.locations : [];
      const locations =
        depth < 4
          ? rawLocations
              .map(item => {
                if (typeof item === 'string') {
                  return normalizeSpaceInput([item], depth + 1);
                }
                if (item && typeof item === 'object') {
                  return normalizeSpaceInput(item as TimelineSpaceInput, depth + 1);
                }
                return null;
              })
              .filter((item): item is TimelineSpaceNormalized => item !== null)
          : [];

      if (!locations.length && namedPlace) {
        return {
          type: 'named_place',
          named_place: namedPlace,
        };
      }

      return {
        type: 'multi_location',
        named_place: namedPlace,
        locations,
      };
    }

    return {
      type: 'named_place',
      named_place: namedPlace || 'Unknown location',
      country: asNonEmptyString(spaceObject.country) || undefined,
      admin1: asNonEmptyString(spaceObject.admin1) || undefined,
      admin2: asNonEmptyString(spaceObject.admin2) || undefined,
      city: asNonEmptyString(spaceObject.city) || undefined,
      site: asNonEmptyString(spaceObject.site) || undefined,
    };
  }

  return {
    type: 'named_place',
    named_place: 'Unknown location',
  };
}

export function getTimelineBounds(time: TimelineTimeValueInput | undefined): { start: TimelineTimeValue; end: TimelineTimeValue } {
  const normalized = normalizeTimeInput(time);
  return {
    start: normalized.start,
    end: normalized.end,
  };
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

export function formatTimeRange(time: TimelineTimeValueInput | undefined): string {
  const normalized = normalizeTimeInput(time);
  if (areTimelineValuesEqual(normalized.start, normalized.end)) {
    return String(normalized.start);
  }

  return `${normalized.start} - ${normalized.end}`;
}

function formatSingleSpaceLabel(space: TimelineSpaceNormalized): string {
  if (space.type === 'named_place') {
    const labels = [space.named_place, space.site, space.city, space.admin2, space.admin1, space.country]
      .map(item => asNonEmptyString(item))
      .filter((item): item is string => Boolean(item));
    const uniqueLabels = [...new Set(labels)];
    return uniqueLabels[0] || 'Unknown location';
  }

  if (space.type === 'latitude_and_longitude') {
    if (space.named_place) {
      return space.named_place;
    }
    if (space.latitude !== undefined && space.longitude !== undefined) {
      return `${space.latitude.toFixed(3)}, ${space.longitude.toFixed(3)}`;
    }
    return 'Unknown location';
  }

  if (space.type === 'bounding_box') {
    return space.named_place || 'Bounding area';
  }

  if (space.type === 'polygon') {
    return space.named_place || 'Polygon area';
  }

  if (!space.locations?.length) {
    return space.named_place || 'Unknown location';
  }

  const labels = space.locations.map(location => formatSingleSpaceLabel(location)).filter(Boolean);
  const uniqueLabels = [...new Set(labels)];
  if (space.named_place) {
    return space.named_place;
  }
  if (uniqueLabels.length <= 3) {
    return uniqueLabels.join(', ');
  }
  return `${uniqueLabels.slice(0, 3).join(', ')} +${uniqueLabels.length - 3}`;
}

export function formatEventLocation(space: TimelineSpaceValueInput | undefined): string {
  const normalized = normalizeSpaceInput(space);
  return formatSingleSpaceLabel(normalized);
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
    badge: `hsla(${hue}, ${Math.max(saturation - 14, 34)}%, 96%, 0.88)`,
  };
}

export function getEventPalette(event: TimelineEvent): TimelinePalette {
  const branchIndex = Number.isFinite(event.primaryBranchIndex) ? event.primaryBranchIndex : 0;
  const sharedCount = event.branchRoots.length || 1;
  return getBranchColor(branchIndex, sharedCount);
}
