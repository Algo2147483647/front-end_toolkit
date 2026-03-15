function renderTimeline() {
  clearSVG();

  if (!historyData.length) {
    updateTimelineSummary('No timeline data available.');
    return;
  }

  const { minYear, maxYear, height, margin, innerHeight } = calculateDimensions();
  const yearScale = createYearScale(minYear, maxYear, margin, innerHeight);

  timelineData = processEvents(yearScale);
  alignParentChildRelationships(timelineData);
  calculateHorizontalPositions(timelineData);
  const roots = assignBranchMetadata(timelineData);
  const stageMetrics = calculateStageMetrics(timelineData, margin, height);

  svgElement.setAttribute('width', stageMetrics.stageWidth);
  svgElement.setAttribute('height', stageMetrics.stageHeight);
  svgElement.setAttribute('viewBox', `0 0 ${stageMetrics.stageWidth} ${stageMetrics.stageHeight}`);

  svgElement.appendChild(buildSvgDefs());
  drawStageBackdrop(stageMetrics);
  drawVerticalTimeline(stageMetrics);
  addYearTicks(minYear, maxYear, yearScale, stageMetrics);
  drawDagEdges(timelineData, stageMetrics);

  const { timeRanges, singlePoints } = separateEvents(timelineData);
  drawTimeRanges(timeRanges, stageMetrics);
  drawSinglePoints(singlePoints, stageMetrics);

  window.TIMELINE_STATE.eventMap = new Map(timelineData.map(event => [event.key, event]));
  window.TIMELINE_STATE.baseSummary = buildTimelineSummary(timelineData, roots, minYear, maxYear);
  updateTimelineSummary(window.TIMELINE_STATE.baseSummary);
  ApplyHoverState(window.TIMELINE_STATE.hoveredKey || null);
}

function drawVerticalTimeline(stageMetrics) {
  const axis = createSvgElement('line', {
    class: 'timeline-axis__main',
    x1: stageMetrics.axisX,
    y1: stageMetrics.margin.top - 18,
    x2: stageMetrics.axisX,
    y2: stageMetrics.stageHeight - stageMetrics.margin.bottom + 18,
  });

  svgElement.appendChild(axis);
}

function createYearScale(minYear, maxYear, margin, innerHeight) {
  return year => {
    if (maxYear === minYear) {
      return margin.top + innerHeight / 2;
    }

    return margin.top + ((year - minYear) / (maxYear - minYear)) * innerHeight;
  };
}

function addYearTicks(minYear, maxYear, yearScale, stageMetrics) {
  const interval = getAdaptiveYearInterval(maxYear - minYear);
  let firstYear = Math.ceil(minYear / interval) * interval;
  if (firstYear > maxYear) {
    firstYear = Math.floor(minYear / interval) * interval;
  }

  for (let year = firstYear; year <= maxYear; year += interval) {
    const y = yearScale(year);
    const isMajor = year === 0 || year === firstYear || year + interval > maxYear;

    const guide = createSvgElement('line', {
      class: `timeline-stage__year-guide${isMajor ? ' timeline-stage__year-guide--major' : ''}`,
      x1: stageMetrics.axisX + 24,
      y1: y,
      x2: stageMetrics.stageWidth - stageMetrics.margin.right,
      y2: y,
    });
    svgElement.appendChild(guide);

    const tick = createSvgElement('line', {
      class: 'timeline-axis__tick',
      x1: stageMetrics.axisX - 8,
      y1: y,
      x2: stageMetrics.axisX + 8,
      y2: y,
    });
    svgElement.appendChild(tick);

    const label = createSvgElement('text', {
      class: 'timeline-axis__year',
      x: stageMetrics.axisX - 18,
      y: y + 4,
      'text-anchor': 'end',
    });
    label.textContent = formatYearLabel(year);
    svgElement.appendChild(label);
  }
}

function buildTimelineSummary(events, roots, minYear, maxYear) {
  const rangeCount = events.filter(event => event.isTimeRange).length;
  const pointCount = events.length - rangeCount;
  const sourceLabel = window.TIMELINE_STATE.sourceLabel || 'timeline data';

  return `${sourceLabel}: ${events.length} events across ${roots.length} root branches, spanning ${formatYearLabel(minYear)} to ${formatYearLabel(maxYear)}. ${rangeCount} ranges and ${pointCount} milestone points are visible in this atlas.`;
}
