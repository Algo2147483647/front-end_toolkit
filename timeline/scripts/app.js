let historyData = [];
let svgElement;
let timelineData = [];

window.horizontalScaleValue = 24;
window.verticalScaleValue = 20;
window.TIMELINE_STATE = {
  baseSummary: 'Loading timeline data...',
  eventMap: new Map(),
  hoveredKey: null,
  scale: 1,
  sourceLabel: 'physics.json',
};

async function loadData(source = 'physics.json') {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return await response.json();
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

function normalizeTimelinePayload(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.nodes)) {
    return data.nodes;
  }

  return [];
}

function downloadSVG() {
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
}

function updateTimelineSummary(message) {
  const summary = document.getElementById('timeline-summary');
  if (summary) {
    summary.textContent = message;
  }
}

function updateZoomDisplay() {
  const zoomValue = document.getElementById('zoom-value');
  if (zoomValue) {
    zoomValue.textContent = `${Math.round(window.TIMELINE_STATE.scale * 100)}%`;
  }
}

function buildEventCardRow(label, value) {
  return `
    <div class="event-card__row">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value)}</span>
    </div>
  `;
}

function showEventCard(event, x, y) {
  const eventCard = document.getElementById('event-card');
  const title = event.title || getEventTitle(event);
  const chips = [
    `<span class="event-chip">${escapeHtml(event.timeLabel || formatTimeRange(event.time))}</span>`,
    `<span class="event-chip">${escapeHtml(event.locationLabel || formatEventLocation(event.space))}</span>`,
  ];

  if (event.branchRoots && event.branchRoots.length > 1) {
    chips.push('<span class="event-chip">Shared branch</span>');
  }

  const rows = [];
  rows.push(buildEventCardRow('Event key', event.key || 'N/A'));
  rows.push(buildEventCardRow('Upstream', String(event.parents ? event.parents.length : 0)));
  rows.push(buildEventCardRow('Downstream', String(event.kids ? event.kids.length : 0)));

  Object.entries(event.data || {}).forEach(([key, value]) => {
    if (key === 'event') {
      return;
    }

    const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
    rows.push(buildEventCardRow(key, displayValue));
  });

  eventCard.innerHTML = `
    <p class="event-card__eyebrow">Timeline event</p>
    <h3>${escapeHtml(title)}</h3>
    <div class="event-card__meta">${chips.join('')}</div>
    <div class="event-card__body">${rows.join('')}</div>
  `;
  eventCard.style.display = 'block';
  eventCard.setAttribute('data-mouse-x', x);
  eventCard.setAttribute('data-mouse-y', y);

  updateEventCardPosition(x, y);
}

function hideEventCard() {
  const eventCard = document.getElementById('event-card');
  eventCard.style.display = 'none';
  eventCard.removeAttribute('data-mouse-x');
  eventCard.removeAttribute('data-mouse-y');
}

function updateEventCardPosition(x, y) {
  const eventCard = document.getElementById('event-card');
  if (eventCard.style.display === 'none') {
    return;
  }

  eventCard.setAttribute('data-mouse-x', x);
  eventCard.setAttribute('data-mouse-y', y);

  const cardWidth = eventCard.offsetWidth;
  const cardHeight = eventCard.offsetHeight;
  let adjustedX = x + 18;
  let adjustedY = y + 18;

  if (adjustedX + cardWidth > window.innerWidth - 8) {
    adjustedX = x - cardWidth - 18;
  }

  if (adjustedY + cardHeight > window.innerHeight - 8) {
    adjustedY = y - cardHeight - 18;
  }

  eventCard.style.left = `${Math.max(8, adjustedX)}px`;
  eventCard.style.top = `${Math.max(8, adjustedY)}px`;
}

function refreshEventCardAfterScroll() {
  const eventCard = document.getElementById('event-card');
  if (eventCard.style.display === 'none') {
    return;
  }

  const x = parseInt(eventCard.getAttribute('data-mouse-x') || '0', 10);
  const y = parseInt(eventCard.getAttribute('data-mouse-y') || '0', 10);
  if (x || y) {
    updateEventCardPosition(x, y);
  }
}

function applyZoom() {
  svgElement.style.transform = `scale(${window.TIMELINE_STATE.scale})`;
  updateZoomDisplay();
}

function setHistoryData(data, sourceLabel) {
  historyData = normalizeTimelinePayload(data);
  historyData.sort((a, b) => parseTimelineYear(a.time[0], 'start') - parseTimelineYear(b.time[0], 'start'));
  window.TIMELINE_STATE.sourceLabel = sourceLabel;
  renderTimeline();
  applyZoom();
}

async function loadTimelineFromPath(path) {
  const normalizedPath = (path || '').trim() || 'physics.json';
  updateTimelineSummary(`Loading ${normalizedPath}...`);

  try {
    const data = await loadData(normalizedPath);
    setHistoryData(data, normalizedPath);
  } catch (error) {
    updateTimelineSummary(`Unable to load ${normalizedPath}.`);
    console.error(error);
  }
}

async function loadTimelineFromFile(file) {
  if (!file) {
    return;
  }

  updateTimelineSummary(`Loading ${file.name}...`);

  try {
    const data = await readJsonFile(file);
    setHistoryData(data, file.name);
  } catch (error) {
    updateTimelineSummary(`Unable to read ${file.name}.`);
    console.error(error);
  }
}

function setupEventListeners() {
  const downloadButton = document.getElementById('download-btn');
  const zoomInButton = document.getElementById('zoom-in');
  const zoomOutButton = document.getElementById('zoom-out');
  const settingsButton = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const horizontalScaleSlider = document.getElementById('horizontal-scale');
  const verticalScaleSlider = document.getElementById('vertical-scale');
  const horizontalScaleValueDisplay = document.getElementById('horizontal-scale-value');
  const verticalScaleValueDisplay = document.getElementById('vertical-scale-value');
  const timelineContainer = document.getElementById('timeline-container');
  const jsonPathInput = document.getElementById('json-path');
  const loadPathButton = document.getElementById('load-path-btn');
  const jsonFileInput = document.getElementById('json-file');

  downloadButton.addEventListener('click', downloadSVG);
  zoomInButton.addEventListener('click', () => {
    window.TIMELINE_STATE.scale = Math.min(window.TIMELINE_STATE.scale * 1.18, 2.8);
    applyZoom();
  });
  zoomOutButton.addEventListener('click', () => {
    window.TIMELINE_STATE.scale = Math.max(window.TIMELINE_STATE.scale / 1.18, 0.56);
    applyZoom();
  });

  settingsButton.addEventListener('click', () => {
    settingsPanel.classList.toggle('settings-panel-visible');
  });

  loadPathButton.addEventListener('click', async () => {
    await loadTimelineFromPath(jsonPathInput.value);
  });
  jsonPathInput.addEventListener('keydown', async event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await loadTimelineFromPath(jsonPathInput.value);
    }
  });
  jsonFileInput.addEventListener('change', async event => {
    const [file] = event.target.files || [];
    await loadTimelineFromFile(file);
  });

  horizontalScaleValueDisplay.textContent = window.horizontalScaleValue;
  horizontalScaleSlider.value = window.horizontalScaleValue;
  horizontalScaleSlider.addEventListener('input', event => {
    window.horizontalScaleValue = parseInt(event.target.value, 10);
    horizontalScaleValueDisplay.textContent = window.horizontalScaleValue;
    renderTimeline();
    applyZoom();
  });

  verticalScaleValueDisplay.textContent = window.verticalScaleValue;
  verticalScaleSlider.value = window.verticalScaleValue;
  verticalScaleSlider.addEventListener('input', event => {
    window.verticalScaleValue = parseInt(event.target.value, 10);
    verticalScaleValueDisplay.textContent = window.verticalScaleValue;
    renderTimeline();
    applyZoom();
  });

  window.addEventListener('resize', refreshEventCardAfterScroll, { passive: true });
  timelineContainer.addEventListener('scroll', refreshEventCardAfterScroll, { passive: true });
}

document.addEventListener('DOMContentLoaded', async () => {
  svgElement = document.getElementById('timeline-svg');

  setupEventListeners();
  await loadTimelineFromPath('physics.json');
  applyZoom();
});
