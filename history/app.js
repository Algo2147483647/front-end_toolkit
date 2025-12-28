// Define global variables to store data
let mathHistoryData = [];
let svgElement;
let timelineData = [];

// Function to generate random soft colors
function getRandomColor() {
  // Generate soft colors with limited hue range for better visual appearance
  const hue = Math.floor(Math.random() * 360);
  const saturation = 30 + Math.floor(Math.random() * 50); // 30-80% saturation for softness
  const lightness = 70 + Math.floor(Math.random() * 20); // 70-90% lightness for softness
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Load data from example.json
async function loadMathHistoryData() {
  try {
    const response = await fetch('example.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading math history data:', error);
    return [];
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  // 加载数据
  mathHistoryData = await loadMathHistoryData();

  // 按时间排序
  mathHistoryData.sort((a, b) => parseInt(a.time[0]) - parseInt(b.time[0]));

  // 初始化SVG
  svgElement = document.getElementById('timeline-svg');
  
  // Render timeline
  renderTimeline();
  
  // Set up event listeners
  setupEventListeners();
});

// Render SVG timeline
function renderTimeline() {
  // Clear SVG
  svgElement.innerHTML = '';
  
  // Get year range
  const years = mathHistoryData.map(event => parseInt(event.time[0]));
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  
  // Set SVG dimensions and margins - increase height to 5 times the original
  const width = 1200;
  const height = Math.max(2000, (maxYear - minYear) * 10); // 根据年份范围调整高度，至少4000px
  svgElement.setAttribute('height', height);
  
  const margin = { top: 50, right: 50, bottom: 50, left: 150 }; // Increase left margin to accommodate timeline
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  // Calculate year-to-position mapping - extend mapping to accommodate longer timeline
  const yearScale = (year) => {
    // Use linear mapping, extend timeline
    return margin.top + ((year - minYear) / (maxYear - minYear)) * innerHeight;
  };
  
  // Draw vertical timeline
  const timelineLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  timelineLine.setAttribute('x1', margin.left);
  timelineLine.setAttribute('y1', margin.top);
  timelineLine.setAttribute('x2', margin.left);
  timelineLine.setAttribute('y2', height - margin.bottom);
  timelineLine.setAttribute('class', 'timeline-line');
  svgElement.appendChild(timelineLine);
  
  // Add year ticks - mark every ten years
  const yearInterval = 10; // Fixed interval of 10 years
  // Calculate the first marked year to be a multiple of 10
  let firstYear = Math.ceil(minYear / 10) * 10;
  // If the first year is out of range, adjust to the first multiple of 10 within the range
  if (firstYear > maxYear) {
    firstYear = Math.floor(minYear / 10) * 10;
  }
  for (let year = firstYear; year <= maxYear; year += yearInterval) {
    const y = yearScale(year);
    
    // 只在可见范围内绘制刻度
    if (y >= margin.top && y <= height - margin.bottom) {
      // 刻度线
      const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tickLine.setAttribute('x1', margin.left - 5);
      tickLine.setAttribute('y1', y);
      tickLine.setAttribute('x2', margin.left + 5);
      tickLine.setAttribute('y2', y);
      tickLine.setAttribute('stroke', '#7986cb');
      tickLine.setAttribute('stroke-width', 1);
      svgElement.appendChild(tickLine);
      
      // Year label - use plus/minus signs instead of BC/AD
      const yearLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      yearLabel.setAttribute('x', margin.left - 10);
      yearLabel.setAttribute('y', y + 4);
      yearLabel.setAttribute('text-anchor', 'end');
      yearLabel.setAttribute('font-size', '10');
      yearLabel.setAttribute('fill', '#555');
      
      let yearDisplay = year < 0 ? `-${Math.abs(year)}` : `+${year}`;
      yearLabel.textContent = yearDisplay;
      svgElement.appendChild(yearLabel);
    }
  }
  
  // Process events to determine if they are single points or time ranges
  timelineData = mathHistoryData.map((event, index) => {
    const isTimeRange = event.time.length > 1; // If more than one time value, it's a time range
    const startTime = parseInt(event.time[0]);
    const endTime = isTimeRange ? parseInt(event.time[1]) : startTime;
    
    const startY = yearScale(startTime);
    const endY = yearScale(endTime);
    
    return {
      ...event,
      isTimeRange,
      startTime,
      endTime,
      startY,
      endY
    };
  });
  
  // Group events by year to handle overlapping events
  const eventsByYear = {};
  timelineData.forEach(event => {
    const year = event.startTime;
    if (!eventsByYear[year]) {
      eventsByYear[year] = [];
    }
    eventsByYear[year].push(event);
  });
  
  // Draw each event
  Object.entries(eventsByYear).forEach(([year, events]) => {
    events.forEach((event, idx) => {
      // Calculate position considering overlapping events
      const baseX = margin.left + 40;
      const offset = idx * 25; // Horizontal offset for overlapping events
      const x = baseX + offset;
      
      // Only draw events within the visible range
      if (event.startY >= margin.top && event.startY <= height - margin.bottom) {
        if (event.isTimeRange) {
          // For time ranges, draw a narrow rectangle
          const rectHeight = Math.abs(event.endY - event.startY);
          const rectY = Math.min(event.startY, event.endY);
          
          // Generate random color for time range rectangle
          const randomColor = getRandomColor();
          
          // Time range rectangle
          const rangeRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rangeRect.setAttribute('x', x - 8); // Narrow rectangle
          rangeRect.setAttribute('y', rectY);
          rangeRect.setAttribute('width', 16);
          rangeRect.setAttribute('height', rectHeight);
          rangeRect.setAttribute('fill', randomColor);
          rangeRect.setAttribute('stroke', '#3949ab');
          rangeRect.setAttribute('stroke-width', 1);

          rangeRect.setAttribute('class', 'timeline-range');
          svgElement.appendChild(rangeRect);
          
          // Event card
          const cardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          cardGroup.setAttribute('class', 'event-card');
          cardGroup.addEventListener('click', () => showEventDetails(event));
          
          // Card background
          const cardBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          cardBg.setAttribute('x', x + 20);
          cardBg.setAttribute('y', event.startY - 30);
          cardBg.setAttribute('width', 200);
          cardBg.setAttribute('height', 60);
          cardBg.setAttribute('rx', 8);
          cardBg.setAttribute('ry', 8);
          cardBg.setAttribute('fill', 'white');
          cardBg.setAttribute('stroke', '#e0e0e0');
          cardBg.setAttribute('stroke-width', 1);
          cardGroup.appendChild(cardBg);
          
          // Event title
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          title.setAttribute('x', x + 120);
          title.setAttribute('y', event.startY - 15);
          title.setAttribute('text-anchor', 'middle');
          title.setAttribute('class', 'event-title');
          title.textContent = truncateText(event.data.event || 'N/A', 25);
          cardGroup.appendChild(title);
          
          // Year range label
          const yearLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          yearLabel.setAttribute('x', x + 120);
          yearLabel.setAttribute('y', event.startY + 5);
          yearLabel.setAttribute('text-anchor', 'middle');
          yearLabel.setAttribute('class', 'event-year');
          
          let yearDisplay = `${event.startTime < 0 ? `-${Math.abs(event.startTime)}` : `+${event.startTime}`} - ${event.endTime < 0 ? `-${Math.abs(event.endTime)}` : `+${event.endTime}`}`;
          yearLabel.textContent = yearDisplay;
          cardGroup.appendChild(yearLabel);
          
          // Person information
          if (event.data.persons) {
            const persons = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            persons.setAttribute('x', x + 120);
            persons.setAttribute('y', event.startY + 20);
            persons.setAttribute('text-anchor', 'middle');
            persons.setAttribute('class', 'event-persons');
            persons.textContent = truncateText(Array.isArray(event.data.persons) ? event.data.persons.join(', ') : event.data.persons, 25);
            cardGroup.appendChild(persons);
          }
          
          svgElement.appendChild(cardGroup);
        } else {
          // For single points, draw a circle
          // Draw event connector line
          const connector = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          connector.setAttribute('x1', margin.left);
          connector.setAttribute('y1', event.startY);
          connector.setAttribute('x2', x - 10);
          connector.setAttribute('y2', event.startY);
          connector.setAttribute('stroke', '#3949ab');
          connector.setAttribute('stroke-width', 1);
          connector.setAttribute('stroke-dasharray', '4,2');
          svgElement.appendChild(connector);
          
          // Draw event dot
          const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          marker.setAttribute('cx', x);
          marker.setAttribute('cy', event.startY);
          marker.setAttribute('r', 6);
          marker.setAttribute('class', 'timeline-marker');
          svgElement.appendChild(marker);
          
          // Event card
          const cardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          cardGroup.setAttribute('class', 'event-card');
          cardGroup.addEventListener('click', () => showEventDetails(event));
          
          // Card background
          const cardBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          cardBg.setAttribute('x', x + 20);
          cardBg.setAttribute('y', event.startY - 30);
          cardBg.setAttribute('width', 200);
          cardBg.setAttribute('height', 60);
          cardBg.setAttribute('rx', 8);
          cardBg.setAttribute('ry', 8);
          cardBg.setAttribute('fill', 'white');
          cardBg.setAttribute('stroke', '#e0e0e0');
          cardBg.setAttribute('stroke-width', 1);
          cardGroup.appendChild(cardBg);
          
          // Event title
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          title.setAttribute('x', x + 120);
          title.setAttribute('y', event.startY - 15);
          title.setAttribute('text-anchor', 'middle');
          title.setAttribute('class', 'event-title');
          title.textContent = truncateText(event.data.event || 'N/A', 25);
          cardGroup.appendChild(title);
          
          // Year label - use plus/minus signs
          const yearLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          yearLabel.setAttribute('x', x + 120);
          yearLabel.setAttribute('y', event.startY + 5);
          yearLabel.setAttribute('text-anchor', 'middle');
          yearLabel.setAttribute('class', 'event-year');
          
          let yearDisplay = event.startTime < 0 ? `-${Math.abs(event.startTime)}` : `+${event.startTime}`;
          yearLabel.textContent = yearDisplay;
          cardGroup.appendChild(yearLabel);
          
          // Person information
          if (event.data.persons) {
            const persons = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            persons.setAttribute('x', x + 120);
            persons.setAttribute('y', event.startY + 20);
            persons.setAttribute('text-anchor', 'middle');
            persons.setAttribute('class', 'event-persons');
            persons.textContent = truncateText(Array.isArray(event.data.persons) ? event.data.persons.join(', ') : event.data.persons, 25);
            cardGroup.appendChild(persons);
          }
          
          svgElement.appendChild(cardGroup);
        }
      }
    });
  });
}

// Truncate text to fit space
function truncateText(text, maxLength) {
  if (!text) return '';
  text = text.toString();
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Show event details
function showEventDetails(event) {
  let details = `Event: ${event.data.event || 'N/A'}\n`;
  details += `Time: ${event.time.join(' - ')}\n`;
  if (event.data.persons) {
    details += `People: ${Array.isArray(event.data.persons) ? event.data.persons.join(', ') : event.data.persons}\n`;
  }
  if (event.data.paper) {
    details += `Reference: ${event.data.paper}\n`;
  }
  alert(details);
}

// Set up event listeners
function setupEventListeners() {
  // Download SVG button
  document.getElementById('download-btn').addEventListener('click', downloadSVG);
  
  // Zoom functionality
  let scale = 1;
  document.getElementById('zoom-in').addEventListener('click', () => {
    scale = Math.min(scale * 1.2, 3);
    svgElement.style.transform = `scale(${scale})`;
  });
  
  document.getElementById('zoom-out').addEventListener('click', () => {
    scale = Math.max(scale / 1.2, 0.5);
    svgElement.style.transform = `scale(${scale})`;
  });
}

// Download SVG file
function downloadSVG() {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], {type: 'image/svg+xml'});
  const svgUrl = URL.createObjectURL(svgBlob);
  
  const downloadLink = document.createElement('a');
  downloadLink.href = svgUrl;
  downloadLink.download = 'math-history-timeline.svg';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}