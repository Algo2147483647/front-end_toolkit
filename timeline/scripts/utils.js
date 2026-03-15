function truncateText(text, maxLength) {
  if (!text) {
    return '';
  }

  const normalized = String(text).trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxLength - 1, 1))}...`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizeEventLabel(text) {
  return String(text || '')
    .split('\\')
    .pop()
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getEventTitle(event) {
  if (event && event.data && event.data.event) {
    return String(event.data.event).trim();
  }

  if (event && event.label) {
    return String(event.label).trim();
  }

  return sanitizeEventLabel(event && event.key ? event.key : 'Untitled event');
}

function formatTimeRange(time) {
  if (!time || !time.length) {
    return 'Unknown time';
  }

  if (time.length === 1 || time[0] === time[1]) {
    return String(time[0]);
  }

  return `${time[0]} - ${time[1]}`;
}

function formatEventLocation(space) {
  if (!space || !space.length) {
    return 'Unknown location';
  }

  return space.join(', ');
}

function parseTimelineYear(value, position = 'start') {
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
    return parseInt(yearMatch[0], 10);
  }

  return 0;
}

function formatYearLabel(year) {
  if (year < 0) {
    return `${Math.abs(year)} BCE`;
  }

  return String(year);
}

function getAdaptiveYearInterval(range) {
  const intervals = [10, 25, 50, 100, 200, 250, 500, 1000];
  const target = Math.max(range / 10, 1);
  return intervals.find(interval => interval >= target) || intervals[intervals.length - 1];
}

function getBranchColor(index, sharedCount = 1) {
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

function getEventPalette(event) {
  const branchIndex = event && Number.isFinite(event.primaryBranchIndex) ? event.primaryBranchIndex : 0;
  const sharedCount = event && event.branchRoots && event.branchRoots.length ? event.branchRoots.length : 1;
  return getBranchColor(branchIndex, sharedCount);
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);

  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, String(value));
    }
  });

  return element;
}
