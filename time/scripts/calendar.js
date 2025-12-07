// 日历功能
class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.currentYear = this.currentDate.getFullYear();
        this.currentMonth = this.currentDate.getMonth();
        this.weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        this.monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
                          '七月', '八月', '九月', '十月', '十一月', '十二月'];
        
        this.initElements();
        this.bindEvents();
        this.initCalendar();
    }

    initElements() {
        this.calendarMonthYear = document.getElementById('calendar-month-year');
        this.calendarGrid = document.getElementById('calendar-grid');
        this.prevMonthBtn = document.getElementById('prev-month');
        this.nextMonthBtn = document.getElementById('next-month');
        this.todayBtn = document.getElementById('today-btn');
    }

    bindEvents() {
        this.prevMonthBtn.addEventListener('click', () => this.previousMonth());
        this.nextMonthBtn.addEventListener('click', () => this.nextMonth());
        this.todayBtn.addEventListener('click', () => this.goToToday());
    }

    // 初始化日历
    initCalendar() {
        // 添加星期标题
        this.calendarGrid.innerHTML = '';
        this.weekdays.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'weekday';
            dayElement.textContent = day;
            this.calendarGrid.appendChild(dayElement);
        });

        this.renderCalendar(this.currentYear, this.currentMonth);
    }

    // 渲染日历
    renderCalendar(year, month) {
        // 移除之前的日子（保留星期标题）
        const days = document.querySelectorAll('.calendar-day');
        days.forEach(day => day.remove());

        // 更新标题
        this.calendarMonthYear.textContent = `${year}年 ${this.monthNames[month]}`;

        // 获取当月第一天和最后一天
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const firstDayOfWeek = firstDay.getDay();

        // 添加上个月的最后几天
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const day = document.createElement('div');
            day.className = 'calendar-day other-month';
            day.textContent = prevMonthLastDay - i;
            this.calendarGrid.appendChild(day);
        }

        // 添加当月所有日子
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day';
            day.textContent = i;

            // 标记今天
            if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
                day.classList.add('today');
            }

            this.calendarGrid.appendChild(day);
        }

        // 添加下个月的前几天
        const totalCells = 42; // 6行 * 7天
        const cellsAdded = firstDayOfWeek + daysInMonth;
        const remainingCells = totalCells - cellsAdded;

        for (let i = 1; i <= remainingCells; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day other-month';
            day.textContent = i;
            this.calendarGrid.appendChild(day);
        }
    }

    // 日历导航
    previousMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.renderCalendar(this.currentYear, this.currentMonth);
    }

    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.renderCalendar(this.currentYear, this.currentMonth);
    }

    goToToday() {
        const today = new Date();
        this.currentYear = today.getFullYear();
        this.currentMonth = today.getMonth();
        this.renderCalendar(this.currentYear, this.currentMonth);
    }
}