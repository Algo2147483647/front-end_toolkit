// 定义全局变量存储数据
let mathHistoryData = [];

// 默认颜色
const defaultColor = "#757575";

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

  // 渲染时间轴
  renderTimeline();

  // 设置事件监听器
  setupEventListeners();
});

// 渲染时间轴
function renderTimeline(filter = "all") {
  const timeline = document.querySelector('.timeline');

  // 清除现有事件（除了时间线和时代标签）
  const existingEvents = timeline.querySelectorAll('.timeline-event, .timeline-marker');
  existingEvents.forEach(el => el.remove());

  // 计算同一时间点的事件数量，用于避免重叠
  const yearGroups = {};

  // 过滤事件
  const filteredEvents = mathHistoryData ?
          mathHistoryData.filter(event => {
            if (filter === "all") return true;
            return true; // 由于删除了category，暂时不过滤
          }) : [];

  // 为每个事件计算位置
  filteredEvents.forEach((event, index) => {
    // 简单计算事件位置（基于时间）
    const minYear = Math.min(...filteredEvents.map(e => parseInt(e.time[0])));
    const maxYear = Math.max(...filteredEvents.map(e => parseInt(e.time[0])));
    const year = parseInt(event.time[0]);
    
    // 计算在时间轴上的位置百分比
    const position = maxYear === minYear ? 50 : ((year - minYear) / (maxYear - minYear)) * 100;
    event.position = position;
    event.side = index % 2 === 0 ? 'left' : 'right'; // 简单分配左右侧
  });

  // 为每个事件创建DOM元素
  filteredEvents.forEach((event, index) => {
    const year = parseInt(event.time[0]);

    // 创建时间标记
    const marker = document.createElement('div');
    marker.className = 'timeline-marker';
    marker.style.top = `${event.position}%`;
    marker.setAttribute('data-year', year);
    timeline.appendChild(marker);

    // 创建事件卡片
    const eventElement = document.createElement('div');
    eventElement.className = `timeline-event ${event.side}`;
    eventElement.style.top = `${event.position}%`;
    eventElement.setAttribute('data-key', event.key);

    const color = defaultColor;
    eventElement.style.borderTop = `4px solid ${color}`;

    // 构建年份显示（处理公元前）
    let yearDisplay = year < 0 ? `${Math.abs(year)} BC` : `${year} AD`;

    // 事件内容
    eventElement.innerHTML = `
                  <div class="event-year" style="color: ${color}">${yearDisplay}</div>
                  <div class="event-title">${event.data.event}</div>
                  ${event.data.persons ? `<div class="event-persons">${Array.isArray(event.data.persons) ? event.data.persons.join(', ') : event.data.persons}</div>` : ''}
                  ${event.data.paper ? `<div class="event-paper">${event.data.paper}</div>` : ''}
              `;

    timeline.appendChild(eventElement);

    // 添加点击事件显示详情
    eventElement.addEventListener('click', () => showEventDetails(event));
  });
}

// 显示事件详情
function showEventDetails(event) {
  // 创建详情弹窗或在页面中显示详情
  console.log('Event details:', event);
  alert(`事件: ${event.data.event}\n时间: ${event.time[0]}\n人物: ${event.data.persons || 'N/A'}\n资料: ${event.data.paper || 'N/A'}`);
}

// 设置事件监听器
function setupEventListeners() {
  // 这里可以添加过滤器、搜索功能等事件监听器
  console.log('Event listeners set up');
}