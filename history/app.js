// Define global variables to store data
let mathHistoryData = [];
let svgElement;
let timelineData = [];

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
  
  // Calculate event positions (to the right of the timeline)
  timelineData = mathHistoryData.map((event, index) => {
    const year = parseInt(event.time[0]);
    const y = yearScale(year);
    const x = margin.left + 40; // To the right of the timeline
    
    return {
      ...event,
      x,
      y
    };
  });
  
  // Draw each event
  timelineData.forEach(event => {
    // Only draw events within the visible range
    if (event.y >= margin.top && event.y <= height - margin.bottom) {
      // Draw event connector line
      const connector = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      connector.setAttribute('x1', margin.left);
      connector.setAttribute('y1', event.y);
      connector.setAttribute('x2', event.x - 10);
      connector.setAttribute('y2', event.y);
      connector.setAttribute('stroke', '#3949ab');
      connector.setAttribute('stroke-width', 1);
      connector.setAttribute('stroke-dasharray', '4,2');
      svgElement.appendChild(connector);
      
      // Draw event dot
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      marker.setAttribute('cx', margin.left);
      marker.setAttribute('cy', event.y);
      marker.setAttribute('r', 6);
      marker.setAttribute('class', 'timeline-marker');
      svgElement.appendChild(marker);
      
      // Draw event card
      const cardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      cardGroup.setAttribute('class', 'event-card');
      cardGroup.addEventListener('click', () => showEventDetails(event));
      
      // Card background
      const cardBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      cardBg.setAttribute('x', event.x);
      cardBg.setAttribute('y', event.y - 30);
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
      title.setAttribute('x', event.x + 100);
      title.setAttribute('y', event.y - 15);
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('class', 'event-title');
      title.textContent = truncateText(event.data.event || 'N/A', 25);
      cardGroup.appendChild(title);
      
      // Year label - use plus/minus signs
      const yearLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      yearLabel.setAttribute('x', event.x + 100);
      yearLabel.setAttribute('y', event.y + 5);
      yearLabel.setAttribute('text-anchor', 'middle');
      yearLabel.setAttribute('class', 'event-year');
      
      let yearDisplay = parseInt(event.time[0]) < 0 ? `-${Math.abs(parseInt(event.time[0]))}` : `+${parseInt(event.time[0])}`;
      yearLabel.textContent = yearDisplay;
      cardGroup.appendChild(yearLabel);
      
      // Person information
      if (event.data.persons) {
        const persons = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        persons.setAttribute('x', event.x + 100);
        persons.setAttribute('y', event.y + 20);
        persons.setAttribute('text-anchor', 'middle');
        persons.setAttribute('class', 'event-persons');
        persons.textContent = truncateText(Array.isArray(event.data.persons) ? event.data.persons.join(', ') : event.data.persons, 25);
        cardGroup.appendChild(persons);
      }
      
      svgElement.appendChild(cardGroup);
    }
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
  details += `Time: ${event.time[0]}\n`;
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