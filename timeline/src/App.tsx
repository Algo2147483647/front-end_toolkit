import { type ChangeEvent, type KeyboardEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildTimelineModel, getPointGeometry, getRangeGeometry } from './timeline/layout';
import { collectConnectedState, getNodeStateClass } from './timeline/hover';
import type { TimelineEvent, TimelineNodeInput } from './timeline/types';
import { formatTimeRange, formatYearLabel, getEventPalette, getTimelineBounds, normalizeTimelinePayload, parseTimelineYear, truncateText } from './timeline/utils';

const DEFAULT_SOURCE = 'example.json';

type EventCardState = {
  event: TimelineEvent;
  cursorX: number;
  cursorY: number;
  left: number;
  top: number;
};

function calculateCardPosition(x: number, y: number, width: number, height: number): { left: number; top: number } {
  let adjustedX = x + 18;
  let adjustedY = y + 18;

  if (adjustedX + width > window.innerWidth - 8) {
    adjustedX = x - width - 18;
  }

  if (adjustedY + height > window.innerHeight - 8) {
    adjustedY = y - height - 18;
  }

  return {
    left: Math.max(8, adjustedX),
    top: Math.max(8, adjustedY),
  };
}

async function fetchTimeline(source: string): Promise<unknown> {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.json();
}

async function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

function formatMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(item => String(item)).join(', ');
  }

  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function App() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const eventCardRef = useRef<HTMLDivElement | null>(null);

  const [historyData, setHistoryData] = useState<TimelineNodeInput[]>([]);
  const [sourceLabel, setSourceLabel] = useState(DEFAULT_SOURCE);
  const [statusMessage, setStatusMessage] = useState('Loading timeline data...');
  const [jsonPath, setJsonPath] = useState(DEFAULT_SOURCE);

  const [horizontalScale, setHorizontalScale] = useState(24);
  const [verticalScalePercent, setVerticalScalePercent] = useState(100);
  const [scale, setScale] = useState(1);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [containerHeight, setContainerHeight] = useState(900);

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [eventCard, setEventCard] = useState<EventCardState | null>(null);

  const timelineYearRange = useMemo(() => {
    if (!historyData.length) {
      return 1;
    }

    let minYear = Number.POSITIVE_INFINITY;
    let maxYear = Number.NEGATIVE_INFINITY;

    historyData.forEach(item => {
      const bounds = getTimelineBounds(item.time);
      const start = parseTimelineYear(bounds.start, 'start');
      const end = parseTimelineYear(bounds.end, 'end');
      minYear = Math.min(minYear, start, end);
      maxYear = Math.max(maxYear, start, end);
    });

    return Math.max(maxYear - minYear, 1);
  }, [historyData]);

  const fitVerticalScale = useMemo(() => {
    const viewportHeight = Math.max(containerHeight, 320);
    const topbarOffset = 108;
    const availableInnerHeight = Math.max(viewportHeight - 168 - topbarOffset, 120);
    return availableInnerHeight / timelineYearRange;
  }, [containerHeight, timelineYearRange]);

  const verticalScale = useMemo(() => fitVerticalScale * (verticalScalePercent / 100), [fitVerticalScale, verticalScalePercent]);

  const model = useMemo(
    () =>
      buildTimelineModel(historyData, {
        horizontalScale,
        verticalScale,
        sourceLabel,
      }),
    [historyData, horizontalScale, verticalScale, sourceLabel],
  );

  const connectedState = useMemo(() => {
    if (!hoveredKey || !model) {
      return null;
    }

    return collectConnectedState(hoveredKey, model.eventMap);
  }, [hoveredKey, model]);

  const loadTimelineFromData = useCallback((data: unknown, nextSourceLabel: string) => {
    const normalized = normalizeTimelinePayload(data)
      .filter(item => item && typeof item.key === 'string')
      .sort((a, b) => {
        const aBounds = getTimelineBounds(a.time);
        const bBounds = getTimelineBounds(b.time);
        return parseTimelineYear(aBounds.start, 'start') - parseTimelineYear(bBounds.start, 'start');
      });

    setSourceLabel(nextSourceLabel);
    setHoveredKey(null);
    setEventCard(null);

    if (!normalized.length) {
      setHistoryData([]);
      setStatusMessage('No timeline data available.');
      return;
    }

    setHistoryData(normalized);
    setStatusMessage('');
  }, []);

  const loadTimelineFromPath = useCallback(
    async (path: string) => {
      const normalizedPath = path.trim() || DEFAULT_SOURCE;
      setStatusMessage(`Loading ${normalizedPath}...`);

      try {
        const data = await fetchTimeline(normalizedPath);
        loadTimelineFromData(data, normalizedPath);
      } catch (error) {
        setStatusMessage(`Unable to load ${normalizedPath}.`);
        console.error(error);
      }
    },
    [loadTimelineFromData],
  );

  const loadTimelineFromFile = useCallback(
    async (file: File) => {
      setStatusMessage(`Loading ${file.name}...`);

      try {
        const data = await readJsonFile(file);
        loadTimelineFromData(data, file.name);
      } catch (error) {
        setStatusMessage(`Unable to read ${file.name}.`);
        console.error(error);
      }
    },
    [loadTimelineFromData],
  );

  useEffect(() => {
    void loadTimelineFromPath(DEFAULT_SOURCE);
  }, [loadTimelineFromPath]);

  useEffect(() => {
    const container = timelineContainerRef.current;
    if (!container) {
      return;
    }

    const refreshHeight = () => {
      setContainerHeight(container.clientHeight);
    };

    refreshHeight();
    const observer = new ResizeObserver(refreshHeight);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const updateEventCardPosition = useCallback((x: number, y: number) => {
    setEventCard(prev => {
      if (!prev) {
        return prev;
      }

      const cardElement = eventCardRef.current;
      const width = cardElement?.offsetWidth || 320;
      const height = cardElement?.offsetHeight || 220;
      const { left, top } = calculateCardPosition(x, y, width, height);

      if (prev.cursorX === x && prev.cursorY === y && prev.left === left && prev.top === top) {
        return prev;
      }

      return {
        ...prev,
        cursorX: x,
        cursorY: y,
        left,
        top,
      };
    });
  }, []);

  useLayoutEffect(() => {
    if (!eventCard) {
      return;
    }

    const cardElement = eventCardRef.current;
    if (!cardElement) {
      return;
    }

    const { left, top } = calculateCardPosition(eventCard.cursorX, eventCard.cursorY, cardElement.offsetWidth, cardElement.offsetHeight);
    if (left !== eventCard.left || top !== eventCard.top) {
      setEventCard(prev => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          left,
          top,
        };
      });
    }
  }, [eventCard]);

  useEffect(() => {
    if (!eventCard) {
      return;
    }

    const refreshPosition = () => {
      setEventCard(prev => {
        if (!prev) {
          return prev;
        }

        const cardElement = eventCardRef.current;
        const width = cardElement?.offsetWidth || 320;
        const height = cardElement?.offsetHeight || 220;
        const { left, top } = calculateCardPosition(prev.cursorX, prev.cursorY, width, height);

        if (left === prev.left && top === prev.top) {
          return prev;
        }

        return {
          ...prev,
          left,
          top,
        };
      });
    };

    const container = timelineContainerRef.current;
    window.addEventListener('resize', refreshPosition, { passive: true });
    container?.addEventListener('scroll', refreshPosition, { passive: true });

    return () => {
      window.removeEventListener('resize', refreshPosition);
      container?.removeEventListener('scroll', refreshPosition);
    };
  }, [eventCard]);

  const handleEventMouseEnter = useCallback((event: TimelineEvent, x: number, y: number) => {
    const cardElement = eventCardRef.current;
    const width = cardElement?.offsetWidth || 320;
    const height = cardElement?.offsetHeight || 220;
    const { left, top } = calculateCardPosition(x, y, width, height);

    setHoveredKey(event.key);
    setEventCard({
      event,
      cursorX: x,
      cursorY: y,
      left,
      top,
    });
  }, []);

  const handleEventMouseLeave = useCallback(() => {
    setHoveredKey(null);
    setEventCard(null);
  }, []);

  const handleDownloadSvg = useCallback(() => {
    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');

    downloadLink.href = svgUrl;
    downloadLink.download = 'timeline-atlas.svg';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
  }, []);

  const handlePathEnter = useCallback(
    async (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      await loadTimelineFromPath(jsonPath);
    },
    [jsonPath, loadTimelineFromPath],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        await loadTimelineFromFile(file);
      }

      event.target.value = '';
    },
    [loadTimelineFromFile],
  );

  const connectedNodes = connectedState?.connectedNodes || null;
  const zoomValue = `${Math.round(scale * 100)}%`;
  const cardDataEntries = eventCard ? Object.entries(eventCard.event.data || {}).filter(([key]) => key !== 'event') : [];
  const sourceName = sourceLabel.split('/').pop() || sourceLabel;

  return (
    <>
      <div className="app-shell">
        <header className="topbar">
          <div>
            <h1>Timeline Atlas</h1>
          </div>
          <div className="topbar-meta">
            <div className="topbar-actions">
              <div className="zoom-pill">
                Zoom <span id="zoom-value">{zoomValue}</span>
              </div>
              <button id="settings-btn" className="settings-toggle-btn" type="button" onClick={() => setSettingsVisible(value => !value)}>
                {settingsVisible ? 'Hide Controls' : 'Show Controls'}
              </button>
            </div>
          </div>
        </header>

        <main className="workspace">
          <div id="timeline-container" ref={timelineContainerRef}>
            <svg
              id="timeline-svg"
              ref={svgRef}
              width={model?.stage.stageWidth ?? 1400}
              height={model?.stage.stageHeight ?? 900}
              viewBox={`0 0 ${model?.stage.stageWidth ?? 1400} ${model?.stage.stageHeight ?? 900}`}
              role="img"
              aria-label="Timeline graph"
              style={{ transform: `scale(${scale})` }}
            >
              <defs>
                <filter id="timeline-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation={12} />
                </filter>
              </defs>

              {model && (
                <>
                  <g>
                    <rect
                      className="timeline-stage__focus"
                      x={model.stage.contentLeft - 18}
                      y={model.stage.margin.top - 24}
                      width={model.stage.columnWidth * Math.max(model.stage.depthCount * 0.75, 3)}
                      height={model.stage.stageHeight - model.stage.margin.top - model.stage.margin.bottom + 48}
                      rx={26}
                      ry={26}
                      filter="url(#timeline-soft-glow)"
                    />

                    {model.stage.depthGuides.map((x, index) => (
                      <g key={`depth-${index}`}>
                        <line
                          className="timeline-stage__depth-line"
                          x1={x}
                          y1={model.stage.margin.top - 14}
                          x2={x}
                          y2={model.stage.stageHeight - model.stage.margin.bottom + 14}
                        />
                        {index < model.stage.depthGuides.length - 1 && (
                          <text className="timeline-stage__depth-label" x={x + model.stage.columnWidth / 2} y={model.stage.margin.top - 28} textAnchor="middle">
                            {index === 0 ? 'ROOT' : `DEPTH ${index}`}
                          </text>
                        )}
                      </g>
                    ))}
                  </g>

                  <line
                    className="timeline-axis__main"
                    x1={model.stage.axisX}
                    y1={model.stage.margin.top - 18}
                    x2={model.stage.axisX}
                    y2={model.stage.stageHeight - model.stage.margin.bottom + 18}
                  />

                  {model.yearTicks.map(tick => (
                    <g key={`year-${tick.year}`}>
                      <line
                        className={`timeline-stage__year-guide${tick.isMajor ? ' timeline-stage__year-guide--major' : ''}`}
                        x1={model.stage.axisX + 24}
                        y1={tick.y}
                        x2={model.stage.stageWidth - model.stage.margin.right}
                        y2={tick.y}
                      />
                      <line className="timeline-axis__tick" x1={model.stage.axisX - 8} y1={tick.y} x2={model.stage.axisX + 8} y2={tick.y} />
                      <text className="timeline-axis__year" x={model.stage.axisX - 18} y={tick.y + 4} textAnchor="end">
                        {formatYearLabel(tick.year)}
                      </text>
                    </g>
                  ))}

                  <g>
                    {model.timeRanges.map(event => {
                      const geometry = getRangeGeometry(event, model.stage);
                      const palette = getEventPalette(event);
                      const nodeClass = getNodeStateClass(event.key, hoveredKey, connectedNodes);
                      const className = `timeline-event timeline-event--range${event.parents.length === 0 ? ' is-root' : ''}${nodeClass ? ` ${nodeClass}` : ''}`;
                      const badgeWidth = Math.min(Math.max(event.branchRoots.length > 1 ? 78 : 62, event.timeLabel.length * 5 + 22), geometry.width - 18);
                      const titleLimit = Math.max(Math.floor((geometry.width - 24) / 6.2), 16);
                      const locationLimit = Math.max(Math.floor((geometry.width - 24) / 7), 14);

                      return (
                        <g
                          key={event.key}
                          className={className}
                          data-node-key={event.key}
                          onMouseEnter={domEvent => handleEventMouseEnter(event, domEvent.clientX, domEvent.clientY)}
                          onMouseLeave={handleEventMouseLeave}
                          onMouseMove={domEvent => updateEventCardPosition(domEvent.clientX, domEvent.clientY)}
                        >
                          <rect className="timeline-event__glow" x={geometry.x - 10} y={geometry.y - 8} width={geometry.width + 20} height={geometry.height + 16} rx={18} ry={18} fill={palette.glow} />
                          <rect
                            className="timeline-event__shape"
                            x={geometry.x}
                            y={geometry.y}
                            width={geometry.width}
                            height={geometry.height}
                            rx={16}
                            ry={16}
                            fill={palette.fill}
                            stroke={palette.stroke}
                            strokeWidth={1.4}
                          />
                          <rect
                            className="timeline-event__badge"
                            x={geometry.x + 10}
                            y={geometry.y + 10}
                            width={badgeWidth}
                            height={18}
                            rx={9}
                            ry={9}
                            fill={palette.badge}
                            stroke={palette.stroke}
                            strokeWidth={0.7}
                          />
                          <text className="timeline-event__badge-text" x={geometry.x + 16} y={geometry.y + 22.5}>
                            {event.branchRoots.length > 1 ? 'Shared branch' : truncateText(event.timeLabel, 14)}
                          </text>
                          <text className="timeline-event__eyebrow" x={geometry.x + 12} y={geometry.y + 42}>
                            {truncateText(event.locationLabel, locationLimit)}
                          </text>
                          <text className="timeline-event__title" x={geometry.x + 12} y={geometry.y + 60}>
                            {truncateText(event.title, titleLimit)}
                          </text>
                          {geometry.height > 88 && (
                            <text className="timeline-event__meta" x={geometry.x + 12} y={geometry.y + 78}>
                              {truncateText(`${event.parents.length} upstream / ${(event.kids || []).length} downstream`, Math.max(Math.floor((geometry.width - 24) / 6.8), 16))}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>

                  <g>
                    {model.singlePoints.map(event => {
                      const geometry = getPointGeometry(event, model.stage);
                      const palette = getEventPalette(event);
                      const nodeClass = getNodeStateClass(event.key, hoveredKey, connectedNodes);
                      const className = `timeline-event timeline-event--point${event.parents.length === 0 ? ' is-root' : ''}${nodeClass ? ` ${nodeClass}` : ''}`;
                      const titleWidth = Math.max(92, Math.min(250, event.title.length * 6.7 + 42));
                      const pillWidth = Math.min(titleWidth, model.stage.stageWidth - geometry.labelX - model.stage.margin.right / 2);

                      return (
                        <g
                          key={event.key}
                          className={className}
                          data-node-key={event.key}
                          onMouseEnter={domEvent => handleEventMouseEnter(event, domEvent.clientX, domEvent.clientY)}
                          onMouseLeave={handleEventMouseLeave}
                          onMouseMove={domEvent => updateEventCardPosition(domEvent.clientX, domEvent.clientY)}
                        >
                          <ellipse
                            className="timeline-event__glow"
                            cx={geometry.labelX + pillWidth / 2 - 8}
                            cy={geometry.dotY}
                            rx={pillWidth / 2 + 22}
                            ry={22}
                            fill={palette.glow}
                          />
                          <rect
                            className="timeline-event__pill"
                            x={geometry.labelX}
                            y={geometry.dotY - 18}
                            width={pillWidth}
                            height={36}
                            rx={18}
                            ry={18}
                            fill={palette.badge}
                            stroke={palette.stroke}
                            strokeWidth={1.2}
                          />
                          <circle className="timeline-event__dot" cx={geometry.dotX} cy={geometry.dotY} r={10} fill="#ffffff" stroke={palette.stroke} strokeWidth={1.4} />
                          <circle className="timeline-event__dot-core" cx={geometry.dotX} cy={geometry.dotY} r={4} fill={palette.accent} />
                          <text className="timeline-event__point-label" x={geometry.labelX + 14} y={geometry.dotY - 1}>
                            {truncateText(event.title, Math.max(Math.floor((pillWidth - 28) / 6.5), 12))}
                          </text>
                          <text className="timeline-event__point-meta" x={geometry.labelX + 14} y={geometry.dotY + 13}>
                            {truncateText(event.timeLabel, Math.max(Math.floor((pillWidth - 28) / 7), 12))}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </>
              )}
            </svg>
          </div>
        </main>
      </div>

      {eventCard && (
        <div
          ref={eventCardRef}
          id="event-card"
          className="event-card"
          style={{ display: 'block', left: `${eventCard.left}px`, top: `${eventCard.top}px` }}
        >
          <p className="event-card__eyebrow">Timeline event</p>
          <h3>{eventCard.event.title}</h3>
          <div className="event-card__meta">
            <span className="event-chip">{eventCard.event.timeLabel || formatTimeRange(eventCard.event.time)}</span>
            <span className="event-chip">{eventCard.event.locationLabel}</span>
            {eventCard.event.branchRoots.length > 1 && <span className="event-chip">Shared branch</span>}
          </div>
          <div className="event-card__body">
            <div className="event-card__row">
              <strong>Event key</strong>
              <span>{eventCard.event.key || 'N/A'}</span>
            </div>
            <div className="event-card__row">
              <strong>Upstream</strong>
              <span>{eventCard.event.parents.length}</span>
            </div>
            <div className="event-card__row">
              <strong>Downstream</strong>
              <span>{(eventCard.event.kids || []).length}</span>
            </div>
            {cardDataEntries.map(([key, value]) => (
              <div className="event-card__row" key={key}>
                <strong>{key}</strong>
                <span>{formatMetadataValue(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {settingsVisible && (
        <div className="control-card">
          <div className="control-card__status">
            <span className="control-card__status-label">Source</span>
            <span className="control-card__status-value" title={sourceLabel}>
              {sourceName}
            </span>
          </div>

          <div id="settings-panel" className="settings-panel settings-panel-visible">
            <section className="settings-section">
              <div className="settings-section__header">
                <div>
                  <p className="settings-section__title">Data source</p>
                  <p className="settings-section__subtitle">Load a hosted JSON path or open a local file.</p>
                </div>
              </div>
              <div className="setting-item">
                <label htmlFor="json-path">
                  <span>JSON path</span>
                  <span>Same-origin URL</span>
                </label>
                <div className="path-input-row">
                  <input
                    type="text"
                    id="json-path"
                    value={jsonPath}
                    onChange={event => setJsonPath(event.target.value)}
                    onKeyDown={handlePathEnter}
                    placeholder="example.json"
                  />
                  <button id="load-path-btn" className="ghost-btn" type="button" onClick={() => void loadTimelineFromPath(jsonPath)}>
                    Load
                  </button>
                </div>
              </div>

              <label className="file-input-label" htmlFor="json-file">
                <input type="file" id="json-file" accept=".json,application/json" onChange={handleFileChange} />
                <span className="file-input-text">Open a local JSON file</span>
              </label>
            </section>

            <section className="settings-section">
              <div className="settings-section__header">
                <div>
                  <p className="settings-section__title">Layout density</p>
                  <p className="settings-section__subtitle">Control branch width and year spacing.</p>
                </div>
              </div>

              <div className="setting-item">
                <label htmlFor="horizontal-scale">
                  <span>Branch width</span>
                  <span className="setting-value">
                    <span id="horizontal-scale-value">{horizontalScale}</span> px
                  </span>
                </label>
                <input
                  type="range"
                  id="horizontal-scale"
                  min={12}
                  max={56}
                  value={horizontalScale}
                  onChange={event => setHorizontalScale(parseInt(event.target.value, 10))}
                />
              </div>

              <div className="setting-item">
                <label htmlFor="vertical-scale">
                  <span>Year spacing</span>
                  <span className="setting-value">
                    <span id="vertical-scale-value">{verticalScalePercent}</span>%
                  </span>
                </label>
                <input
                  type="range"
                  id="vertical-scale"
                  min={100}
                  max={360}
                  value={verticalScalePercent}
                  onChange={event => setVerticalScalePercent(parseInt(event.target.value, 10))}
                />
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-section__header">
                <div>
                  <p className="settings-section__title">Viewport</p>
                  <p className="settings-section__subtitle">Zoom the stage or export the current SVG.</p>
                </div>
              </div>

              <div className="setting-buttons setting-buttons--triple">
                <button id="zoom-out" className="ghost-btn" type="button" onClick={() => setScale(value => Math.max(value / 1.18, 0.56))}>
                  Zoom Out
                </button>
                <button id="zoom-reset" className="ghost-btn" type="button" onClick={() => setScale(1)}>
                  Reset
                </button>
                <button id="zoom-in" className="ghost-btn" type="button" onClick={() => setScale(value => Math.min(value * 1.18, 2.8))}>
                  Zoom In
                </button>
              </div>

              <div className="setting-buttons">
                <button id="download-btn" className="primary-btn" type="button" onClick={handleDownloadSvg}>
                  Export SVG
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
