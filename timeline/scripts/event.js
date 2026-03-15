function getRoots(events) {
  const roots = [];

  events.forEach(event => {
    if (!event.parents || event.parents.length === 0 || event.parents[0] === '') {
      roots.push(event);
    }
  });

  roots.sort((a, b) => a.startTime - b.startTime);
  return roots;
}

function alignParentChildRelationships(events) {
  events.forEach(event => {
    if (!Array.isArray(event.parents)) {
      event.parents = [];
    }

    if (!Array.isArray(event.kids)) {
      event.kids = [];
    }

    const parents = [];
    event.parents.forEach(parentKey => {
      if (!parentKey || parentKey.trim() === '') {
        return;
      }

      parents.push(parentKey);
      const parentEvent = events.find(item => item.key === parentKey);
      if (!parentEvent) {
        return;
      }

      if (!Array.isArray(parentEvent.kids)) {
        parentEvent.kids = [];
      }

      if (!parentEvent.kids.includes(event.key)) {
        parentEvent.kids.push(event.key);
      }
    });
    event.parents = parents;

    const kids = [];
    event.kids.forEach(kidKey => {
      if (!kidKey || kidKey.trim() === '') {
        return;
      }

      kids.push(kidKey);
      const kidEvent = events.find(item => item.key === kidKey);
      if (!kidEvent) {
        return;
      }

      if (!Array.isArray(kidEvent.parents)) {
        kidEvent.parents = [];
      }

      if (!kidEvent.parents.includes(event.key)) {
        kidEvent.parents.push(event.key);
      }
    });
    event.kids = kids;
  });
}

function findParentEvent(parentKey, allEvents) {
  return allEvents.find(event => event.key === parentKey);
}

function calculateDimensions() {
  const years = historyData.flatMap(event => {
    const start = parseTimelineYear(event.time && event.time[0], 'start');
    const end = parseTimelineYear(event.time && event.time[event.time.length - 1], 'end');
    return [start, end];
  });

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const margin = { top: 84, right: 120, bottom: 84, left: 190 };
  const innerHeight = Math.max((maxYear - minYear) * window.verticalScaleValue, 760);
  const height = innerHeight + margin.top + margin.bottom;
  svgElement.setAttribute('height', height);

  return { minYear, maxYear, height, margin, innerHeight };
}

function processEvents(yearScale) {
  return historyData.map(event => {
    const isTimeRange = event.time.length > 1;
    const startTime = parseTimelineYear(event.time[0], 'start');
    const endTime = isTimeRange ? parseTimelineYear(event.time[1], 'end') : startTime;
    const startY = yearScale(startTime);
    const endY = yearScale(endTime);

    return {
      ...event,
      isTimeRange,
      startTime,
      endTime,
      startY,
      endY,
      title: getEventTitle(event),
      timeLabel: formatTimeRange(event.time),
      locationLabel: formatEventLocation(event.space),
    };
  });
}

function separateEvents(events) {
  const timeRanges = events.filter(event => event.isTimeRange);
  const singlePoints = events.filter(event => !event.isTimeRange);
  return { timeRanges, singlePoints };
}

function assignBranchMetadata(events) {
  const eventMap = new Map();
  events.forEach(event => {
    event.branchRoots = [];
    eventMap.set(event.key, event);
  });

  const roots = getRoots(events);

  roots.forEach((root, rootIndex) => {
    const stack = [root.key];
    const visited = new Set();

    while (stack.length) {
      const key = stack.pop();
      if (!key || visited.has(key)) {
        continue;
      }

      visited.add(key);
      const event = eventMap.get(key);
      if (!event) {
        continue;
      }

      if (!event.branchRoots.includes(root.key)) {
        event.branchRoots.push(root.key);
      }

      if (!Number.isFinite(event.primaryBranchIndex)) {
        event.primaryBranchIndex = rootIndex;
      }

      (event.kids || []).forEach(kidKey => {
        stack.push(kidKey);
      });
    }
  });

  events.forEach(event => {
    if (!Number.isFinite(event.primaryBranchIndex)) {
      event.primaryBranchIndex = 0;
    }

    event.isSharedBranch = event.branchRoots.length > 1;
  });

  return roots;
}

function calculateStageMetrics(events, margin, height) {
  const gridUnits = events.reduce((maxUnits, event) => {
    return Math.max(maxUnits, event.x + event.width);
  }, 0);

  const depthCount = Math.max(gridUnits, 1);
  const columnWidth = window.horizontalScaleValue;
  const axisX = margin.left;
  const contentLeft = axisX + 40;
  const contentRight = 280;
  const stageWidth = Math.max(1320, contentLeft + depthCount * columnWidth + contentRight + margin.right);
  const stageHeight = height;
  const depthGuides = Array.from({ length: depthCount + 1 }, (_, index) => {
    return contentLeft + index * columnWidth;
  });

  return {
    axisX,
    columnWidth,
    contentLeft,
    depthCount,
    depthGuides,
    stageWidth,
    stageHeight,
    margin,
  };
}
