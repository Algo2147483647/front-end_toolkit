// 获取DOM元素
const clockFace = document.querySelector('.clock-face');
const hourHand = document.querySelector('.hour-hand');
const minuteHand = document.querySelector('.minute-hand');
const secondHand = document.querySelector('.second-hand');
const digitalClock = document.getElementById('digital-clock');
const dateElement = document.getElementById('date');
const dayElement = document.getElementById('day');
const calendarContainer = document.getElementById('calendar-container');
const clockContainer = document.getElementById('clock-container');
const clockButton = document.getElementById('clock-btn');
const calendarButton = document.getElementById('calendar-btn');
const prevMonthButton = document.getElementById('prev-month');
const nextMonthButton = document.getElementById('next-month');
const monthYearElement = document.getElementById('month-year');
const weekdaysElement = document.getElementById('weekdays');
const daysElement = document.getElementById('days');

// 当前日期状态
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();

// 星期和月份名称
const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

// 创建时钟刻度
function createClockMarkers() {
    for (let i = 1; i <= 24; i++) {
        const marker = document.createElement('div');
        marker.className = 'marker';
        marker.style.position = 'absolute';
        marker.style.top = '50%';
        marker.style.left = '50%';
        marker.style.width = i % 6 === 0 ? '4px' : i % 3 === 0 ? '2px' : '1px';
        marker.style.height = i % 6 === 0 ? '12px' : '8px';
        marker.style.background = 'white';
        marker.style.transformOrigin = '50% 0';
        marker.style.transform = `translateX(-50%) rotate(${i * 15}deg)`;
        marker.style.borderRadius = '2px';
        clockFace.appendChild(marker);
    }
    
    // 添加数字标识
    for (let i = 0; i < 12; i++) {
        const number = document.createElement('div');
        number.className = 'number';
        number.style.position = 'absolute';
        number.style.top = '50%';
        number.style.left = '50%';
        number.style.transform = `translate(-50%, -50%) rotate(${i * 30}deg)`;
        number.style.transformOrigin = '50% 130px';
        number.style.textAlign = 'center';
        number.style.width = '20px';
        number.style.height = '20px';
        number.style.color = 'white';
        number.style.fontWeight = 'bold';
        number.style.fontSize = '14px';
        number.textContent = i === 0 ? '24' : i * 2;
        clockFace.appendChild(number);
    }
}

// 更新模拟时钟显示
function updateAnalogClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const milliseconds = now.getMilliseconds();
    
    // 计算角度（24小时制）
    const hourDeg = (hours % 24) * 15 + minutes * 0.25; // 每小时15度
    const minuteDeg = minutes * 6 + seconds * 0.1; // 每分钟6度
    const secondDeg = seconds * 6 + milliseconds * 0.006; // 每秒6度
    
    // 应用旋转
    hourHand.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
    minuteHand.style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
    secondHand.style.transform = `translateX(-50%) rotate(${secondDeg}deg)`;
}

// 更新数字时钟显示
function updateDigitalClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    digitalClock.textContent = `${hours}:${minutes}:${seconds}`;
}

// 更新日期显示
function updateDateDisplay() {
    const now = new Date();
    
    // 只在日期改变时更新日期和星期
    if (now.getDate() !== currentDate.getDate()) {
        currentDate = now;
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const day = weekdays[now.getDay()];
        
        dateElement.textContent = `${year}年${month}月${date}日`;
        dayElement.textContent = `星期${day}`;
    }
}

// 更新时钟显示（模拟+数字）
function updateClock() {
    updateAnalogClock();
    updateDigitalClock();
    updateDateDisplay();
}

// 渲染日历
function renderCalendar() {
    // 设置当前月份和年份显示
    monthYearElement.textContent = `${currentYear}年 ${months[currentMonth]}`;
    
    // 清空现有日期
    daysElement.innerHTML = '';
    
    // 获取当月第一天和最后一天
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    // 获取上个月的最后一天
    const prevLastDay = new Date(currentYear, currentMonth, 0).getDate();
    
    // 获取当月第一天是星期几（0=星期日）
    const firstDayIndex = firstDay.getDay();
    
    // 获取当月总天数
    const daysInMonth = lastDay.getDate();
    
    // 添加上个月的日期
    for (let i = firstDayIndex; i > 0; i--) {
        const dayElement = document.createElement('div');
        dayElement.classList.add('day-cell', 'other-month');
        dayElement.textContent = prevLastDay - i + 1;
        daysElement.appendChild(dayElement);
    }
    
    // 添加当月日期
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const dayElement = document.createElement('div');
        dayElement.classList.add('day-cell');
        dayElement.textContent = i;
        
        // 标记今天
        if (
            i === today.getDate() &&
            currentMonth === today.getMonth() &&
            currentYear === today.getFullYear()
        ) {
            dayElement.classList.add('today');
        }
        
        daysElement.appendChild(dayElement);
    }
    
    // 计算需要多少个下个月的日期来填满网格
    const totalCells = 42; // 6行7列
    const remainingCells = totalCells - (firstDayIndex + daysInMonth);
    
    // 添加下个月的日期
    for (let i = 1; i <= remainingCells; i++) {
        const dayElement = document.createElement('div');
        dayElement.classList.add('day-cell', 'other-month');
        dayElement.textContent = i;
        daysElement.appendChild(dayElement);
    }
}

// 切换到时钟视图
function showClock() {
    clockContainer.classList.remove('hidden');
    calendarContainer.classList.remove('visible');
    clockButton.classList.add('active');
    calendarButton.classList.remove('active');
}

// 切换到日历视图
function showCalendar() {
    clockContainer.classList.add('hidden');
    calendarContainer.classList.add('visible');
    clockButton.classList.remove('active');
    calendarButton.classList.add('active');
    renderCalendar();
}

// 上一个月
function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
}

// 下一个月
function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
}

// 初始化页面
function init() {
    // 创建时钟刻度
    createClockMarkers();
    
    // 设置星期标题
    weekdays.forEach(day => {
        const dayElement = document.createElement('div');
        dayElement.textContent = day;
        weekdaysElement.appendChild(dayElement);
    });
    
    // 更新时钟
    updateClock();
    setInterval(updateClock, 1000);
    
    // 绑定事件监听器
    clockButton.addEventListener('click', showClock);
    calendarButton.addEventListener('click', showCalendar);
    prevMonthButton.addEventListener('click', prevMonth);
    nextMonthButton.addEventListener('click', nextMonth);
    
    // 初始化日期显示
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const date = currentDate.getDate();
    const day = weekdays[currentDate.getDay()];
    
    dateElement.textContent = `${year}年${month}月${date}日`;
    dayElement.textContent = `星期${day}`;
    
    // 默认显示时钟
    showClock();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);