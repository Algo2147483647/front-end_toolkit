// 定义全局变量存储数据
let mathHistoryData = [];
let svgElement;
let timelineData = [];

// 从example.json加载数据
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

// 初始化页面
document.addEventListener('DOMContentLoaded', async function() {
  // 加载数据
  mathHistoryData = await loadMathHistoryData();

  // 按时间排序
  mathHistoryData.sort((a, b) => parseInt(a.time[0]) - parseInt(b.time[0]));

  // 初始化SVG
  svgElement = document.getElementById('timeline-svg');
  
  // 渲染时间轴
  renderTimeline();
  
  // 设置事件监听器
  setupEventListeners();
});

// 渲染SVG时间轴
function renderTimeline() {
  // 清空SVG
  svgElement.innerHTML = '';
  
  // 获取年份范围
  const years = mathHistoryData.map(event => parseInt(event.time[0]));
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  
  // 设置SVG尺寸和边距
  const width = 1200;
  const height = 800;
  const margin = { top: 50, right: 50, bottom: 100, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  // 计算年份到位置的映射
  const yearScale = (year) => {
    return margin.left + ((year - minYear) / (maxYear - minYear)) * innerWidth;
  };
  
  // 绘制时间轴线
  const timelineLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  timelineLine.setAttribute('x1', margin.left);
  timelineLine.setAttribute('y1', height / 2);
  timelineLine.setAttribute('x2', width - margin.right);
  timelineLine.setAttribute('y2', height / 2);
  timelineLine.setAttribute('class', 'timeline-line');
  svgElement.appendChild(timelineLine);
  
  // 添加年份刻度
  const yearInterval = Math.ceil((maxYear - minYear) / 20); // 最多显示20个刻度
  for (let year = Math.ceil(minYear / yearInterval) * yearInterval; year <= maxYear; year += yearInterval) {
    const x = yearScale(year);
    
    // 刻度线
    const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tickLine.setAttribute('x1', x);
    tickLine.setAttribute('y1', height / 2 - 10);
    tickLine.setAttribute('x2', x);
    tickLine.setAttribute('y2', height / 2 + 10);
    tickLine.setAttribute('stroke', '#7986cb');
    tickLine.setAttribute('stroke-width', 1);
    svgElement.appendChild(tickLine);
    
    // 年份标签
    const yearLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yearLabel.setAttribute('x', x);
    yearLabel.setAttribute('y', height / 2 + 25);
    yearLabel.setAttribute('text-anchor', 'middle');
    yearLabel.setAttribute('font-size', '10');
    yearLabel.setAttribute('fill', '#555');
    
    let yearDisplay = year < 0 ? `${Math.abs(year)} BC` : `${year} AD`;
    yearLabel.textContent = yearDisplay;
    svgElement.appendChild(yearLabel);
  }
  
  // 计算事件位置（左右交替）
  timelineData = mathHistoryData.map((event, index) => {
    const year = parseInt(event.time[0]);
    const x = yearScale(year);
    const side = index % 2 === 0 ? 'top' : 'bottom';
    const y = side === 'top' ? height / 2 - 80 : height / 2 + 40;
    
    return {
      ...event,
      x,
      y,
      side
    };
  });
  
  // 绘制每个事件
  timelineData.forEach(event => {
    // 绘制事件连接线
    const connector = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    connector.setAttribute('x1', event.x);
    connector.setAttribute('y1', height / 2);
    connector.setAttribute('x2', event.x);
    connector.setAttribute('y2', event.y + (event.side === 'top' ? 40 : 0));
    connector.setAttribute('stroke', '#3949ab');
    connector.setAttribute('stroke-width', 1);
    connector.setAttribute('stroke-dasharray', '4,2');
    svgElement.appendChild(connector);
    
    // 绘制事件圆点
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    marker.setAttribute('cx', event.x);
    marker.setAttribute('cy', event.side === 'top' ? height / 2 - 10 : height / 2 + 10);
    marker.setAttribute('r', 6);
    marker.setAttribute('class', 'timeline-marker');
    svgElement.appendChild(marker);
    
    // 绘制事件卡片
    const cardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    cardGroup.setAttribute('class', 'event-card');
    cardGroup.addEventListener('click', () => showEventDetails(event));
    
    // 卡片背景
    const cardBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    cardBg.setAttribute('x', event.x - 80);
    cardBg.setAttribute('y', event.y);
    cardBg.setAttribute('width', 160);
    cardBg.setAttribute('height', 80);
    cardBg.setAttribute('rx', 8);
    cardBg.setAttribute('ry', 8);
    cardBg.setAttribute('fill', 'white');
    cardBg.setAttribute('stroke', '#e0e0e0');
    cardBg.setAttribute('stroke-width', 1);
    cardGroup.appendChild(cardBg);
    
    // 年份标签
    const yearLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yearLabel.setAttribute('x', event.x);
    yearLabel.setAttribute('y', event.y + 15);
    yearLabel.setAttribute('text-anchor', 'middle');
    yearLabel.setAttribute('class', 'event-year');
    
    let yearDisplay = parseInt(event.time[0]) < 0 ? `${Math.abs(parseInt(event.time[0]))} BC` : `${parseInt(event.time[0])} AD`;
    yearLabel.textContent = yearDisplay;
    cardGroup.appendChild(yearLabel);
    
    // 事件标题
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', event.x);
    title.setAttribute('y', event.y + 35);
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('class', 'event-title');
    title.textContent = truncateText(event.data.event || 'N/A', 18);
    cardGroup.appendChild(title);
    
    // 人物信息
    if (event.data.persons) {
      const persons = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      persons.setAttribute('x', event.x);
      persons.setAttribute('y', event.y + 50);
      persons.setAttribute('text-anchor', 'middle');
      persons.setAttribute('class', 'event-persons');
      persons.textContent = truncateText(Array.isArray(event.data.persons) ? event.data.persons.join(', ') : event.data.persons, 20);
      cardGroup.appendChild(persons);
    }
    
    // 论文/资料信息
    if (event.data.paper) {
      const paper = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      paper.setAttribute('x', event.x);
      paper.setAttribute('y', event.y + 65);
      paper.setAttribute('text-anchor', 'middle');
      paper.setAttribute('class', 'event-paper');
      paper.textContent = truncateText(event.data.paper, 25);
      cardGroup.appendChild(paper);
    }
    
    svgElement.appendChild(cardGroup);
  });
}

// 截断文本以适应空间
function truncateText(text, maxLength) {
  if (!text) return '';
  text = text.toString();
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// 显示事件详情
function showEventDetails(event) {
  let details = `事件: ${event.data.event || 'N/A'}\n`;
  details += `时间: ${event.time[0]}\n`;
  if (event.data.persons) {
    details += `人物: ${Array.isArray(event.data.persons) ? event.data.persons.join(', ') : event.data.persons}\n`;
  }
  if (event.data.paper) {
    details += `资料: ${event.data.paper}\n`;
  }
  alert(details);
}

// 设置事件监听器
function setupEventListeners() {
  // 下载SVG按钮
  document.getElementById('download-btn').addEventListener('click', downloadSVG);
  
  // 缩放功能
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

// 下载SVG文件
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