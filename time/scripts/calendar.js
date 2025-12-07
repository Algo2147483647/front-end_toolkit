// Calendar functionality
class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.currentYear = this.currentDate.getFullYear();
        this.currentMonth = this.currentDate.getMonth();
        this.weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        this.monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        this.titleUpdateTimer = null;
        // Virtualization settings
        this.startYear = 1970;
        this.endYear = 2030;
        this.rowHeight = 70; // px per week-row (matches .calendar-day height)
        this.bufferRows = 3; // extra rows to render above/below viewport
        this.totalStartDate = new Date(this.startYear, 0, 1);
        this.totalEndDate = new Date(this.endYear + 1, 0, 1); // exclusive

        // runtime state for virtualization
        this.firstVisibleRow = 0; // row index (week index) currently at top
        this.totalWeeks = Math.ceil((this.totalEndDate - this.totalStartDate) / (1000 * 60 * 60 * 24 * 7));
        
        this.initElements();
        this.bindEvents();
        this.initCalendar();
    }

    initElements() {
        this.calendarMonthYear = document.getElementById('calendar-month-year');
        this.calendarGrid = document.getElementById('calendar-grid');
        this.calendarWeekdays = document.getElementById('calendar-weekdays');
        this.prevMonthBtn = document.getElementById('prev-month');
        this.nextMonthBtn = document.getElementById('next-month');
        this.todayBtn = document.getElementById('today-btn');
    }

    bindEvents() {
        this.prevMonthBtn.addEventListener('click', () => this.previousMonth());
        this.nextMonthBtn.addEventListener('click', () => this.nextMonth());
        this.todayBtn.addEventListener('click', () => this.goToToday());
        
        // 添加滚动事件监听器
        this.calendarGrid.addEventListener('scroll', () => this.handleScroll());
    }

    // 初始化日历
    initCalendar() {
        // clear grid and create virtualization structure: top spacer, visible container, bottom spacer
        this.calendarGrid.innerHTML = '';
        if (this.calendarWeekdays) this.calendarWeekdays.innerHTML = '';

        // weekday header (kept outside scrolling content if a separate container exists)
        this.weekdays.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'weekday';
            dayElement.textContent = day;
            if (this.calendarWeekdays) this.calendarWeekdays.appendChild(dayElement);
            else this.calendarGrid.appendChild(dayElement);
        });

        // create virtualization elements
        this.topSpacer = document.createElement('div');
        this.topSpacer.className = 'top-spacer';
        this.daysContainer = document.createElement('div');
        this.daysContainer.className = 'days-container';
        this.bottomSpacer = document.createElement('div');
        this.bottomSpacer.className = 'bottom-spacer';

        this.calendarGrid.appendChild(this.topSpacer);
        this.calendarGrid.appendChild(this.daysContainer);
        this.calendarGrid.appendChild(this.bottomSpacer);

        // Ensure spacers span full grid width and container's children participate in grid
        this.topSpacer.style.gridColumn = '1 / -1';
        this.topSpacer.style.width = '100%';
        this.topSpacer.style.display = 'block';

        this.bottomSpacer.style.gridColumn = '1 / -1';
        this.bottomSpacer.style.width = '100%';
        this.bottomSpacer.style.display = 'block';

        // Make daysContainer transparent to grid so its children (day cells) become grid items
        this.daysContainer.style.display = 'contents';

        // compute initial pointer: Monday of the first day of the current month
        const firstOfMonth = new Date(this.currentYear, this.currentMonth, 1);
        const dayOfWeek = firstOfMonth.getDay();
        const diffToMonday = (dayOfWeek + 6) % 7; // 0 if Monday, 1 if Tuesday, etc.
        this.initialPointerDate = new Date(firstOfMonth);
        this.initialPointerDate.setDate(firstOfMonth.getDate() - diffToMonday);

        // set initial scroll position to place initialPointerDate at the top
        const weeksBefore = Math.floor((this.initialPointerDate - this.totalStartDate) / (1000 * 60 * 60 * 24 * 7));
        const initialScrollTop = Math.max(0, weeksBefore * this.rowHeight);
        // set container virtual height
        const contentHeight = this.totalWeeks * this.rowHeight;
        this.topSpacer.style.height = '0px';
        this.bottomSpacer.style.height = (contentHeight - initialScrollTop) + 'px';

        // apply initial scroll after a tick so dimensions exist
        setTimeout(() => {
            this.calendarGrid.scrollTop = initialScrollTop;
            this.handleScroll();
        }, 0);
    }

    // 渲染所有月份
    renderAllMonths() {
        // No-op: replaced by virtualized rendering in `initCalendar` and `handleScroll`
    }

    // 渲染指定年月
    renderMonth(year, month) {
        // Legacy method kept for compatibility but not used in virtualization.
    }

    // Render a window of weeks starting at `firstWeekIndex` and rendering `numRows` rows (weeks)
    renderWindow(firstWeekIndex) {
        if (!this.daysContainer) return;

        const gridHeight = this.calendarGrid.clientHeight || (this.rowHeight * 6);
        const visibleRows = Math.ceil(gridHeight / this.rowHeight);
        const startRow = Math.max(0, firstWeekIndex - this.bufferRows);
        const endRow = Math.min(this.totalWeeks - 1, firstWeekIndex + visibleRows + this.bufferRows);
        const rowsToRender = endRow - startRow + 1;

        // clear days container
        this.daysContainer.innerHTML = '';

        const today = new Date();

        for (let r = 0; r < rowsToRender; r++) {
            const weekIndex = startRow + r;
            for (let d = 0; d < 7; d++) {
                const cellDate = new Date(this.totalStartDate);
                cellDate.setDate(this.totalStartDate.getDate() + weekIndex * 7 + d);

                const day = document.createElement('div');
                day.className = 'calendar-day';
                day.textContent = cellDate.getDate();

                day.dataset.date = `${cellDate.getFullYear()}-${cellDate.getMonth()+1}-${cellDate.getDate()}`;
                day.dataset.month = cellDate.getMonth();
                day.dataset.year = cellDate.getFullYear();

                if (cellDate.getFullYear() === today.getFullYear() && cellDate.getMonth() === today.getMonth() && cellDate.getDate() === today.getDate()) {
                    day.classList.add('today');
                }

                // mark other-month vs the primary month will be handled in updateCurrentMonthTitleAndStyles
                this.daysContainer.appendChild(day);
            }
        }

        // adjust spacers
        const topSpacerHeight = startRow * this.rowHeight;
        const renderedHeight = rowsToRender * this.rowHeight;
        const contentHeight = this.totalWeeks * this.rowHeight;
        this.topSpacer.style.height = topSpacerHeight + 'px';
        this.bottomSpacer.style.height = Math.max(0, contentHeight - topSpacerHeight - renderedHeight) + 'px';

        // update styles and title for the newly rendered window
        this.updateCurrentMonthTitleAndStyles();
    }

    // 滚动到当前月份
    scrollToCurrentMonth() {
        // compute week index for initialPointerDate
        const weeksBefore = Math.floor((this.initialPointerDate - this.totalStartDate) / (1000 * 60 * 60 * 24 * 7));
        this.calendarGrid.scrollTop = Math.max(0, weeksBefore * this.rowHeight);
        this.handleScroll();
    }

    // 处理滚动事件
    handleScroll() {
        // 使用防抖优化性能并虚拟渲染窗口
        clearTimeout(this.titleUpdateTimer);
        this.titleUpdateTimer = setTimeout(() => {
            const scrollTop = this.calendarGrid.scrollTop;
            const newFirstVisibleRow = Math.floor(scrollTop / this.rowHeight);
            if (newFirstVisibleRow !== this.firstVisibleRow) {
                this.firstVisibleRow = newFirstVisibleRow;
            }
            this.renderWindow(this.firstVisibleRow);
        }, 50);
    }

    // 防抖函数用于优化性能
    debounceUpdateTitleAndStyles() {
        // kept for compatibility, now handleScroll does debounced rendering and update
        this.handleScroll();
    }

    // 更新当前显示的月份标题和日期样式
    updateCurrentMonthTitleAndStyles() {
        // Count visible days per month-year in the currently rendered container
        const days = this.daysContainer ? Array.from(this.daysContainer.querySelectorAll('.calendar-day')) : Array.from(this.calendarGrid.querySelectorAll('.calendar-day'));
        const gridRect = this.calendarGrid.getBoundingClientRect();
        const monthCounts = new Map();

        days.forEach(day => {
            const rect = day.getBoundingClientRect();
            // consider visible if intersects grid viewport
            if (rect.bottom >= gridRect.top && rect.top <= gridRect.bottom) {
                const month = parseInt(day.dataset.month);
                const year = parseInt(day.dataset.year);
                if (!isNaN(month) && !isNaN(year)) {
                    const key = `${year}-${month}`;
                    monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
                }
            }
        });

        // find primary month-year
        let primaryKey = null;
        let maxCount = 0;
        monthCounts.forEach((count, key) => {
            if (count > maxCount) {
                maxCount = count;
                primaryKey = key;
            }
        });

        if (primaryKey) {
            const [y, m] = primaryKey.split('-').map(n => parseInt(n, 10));
            this.calendarMonthYear.textContent = `${this.monthNames[m]} ${y}`;
        }

        // update styles
        days.forEach(day => {
            const month = parseInt(day.dataset.month);
            const year = parseInt(day.dataset.year);
            const key = `${year}-${month}`;
            if (primaryKey && key === primaryKey) {
                day.style.color = '#000';
                day.classList.remove('other-month');
            } else {
                day.style.color = '#999';
                day.classList.add('other-month');
            }

            if (day.classList.contains('today')) {
                day.style.color = '';
            }
        });
    }

    // 上一个月
    previousMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        // update pointer to Monday of new month and scroll to it
        const firstOfMonth = new Date(this.currentYear, this.currentMonth, 1);
        const diffToMonday = (firstOfMonth.getDay() + 6) % 7;
        const ptr = new Date(firstOfMonth);
        ptr.setDate(firstOfMonth.getDate() - diffToMonday);
        const weeksBefore = Math.floor((ptr - this.totalStartDate) / (1000 * 60 * 60 * 24 * 7));
        this.calendarGrid.scrollTop = Math.max(0, weeksBefore * this.rowHeight);
        this.handleScroll();
    }

    // 下一个月
    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        const firstOfMonth = new Date(this.currentYear, this.currentMonth, 1);
        const diffToMonday = (firstOfMonth.getDay() + 6) % 7;
        const ptr = new Date(firstOfMonth);
        ptr.setDate(firstOfMonth.getDate() - diffToMonday);
        const weeksBefore = Math.floor((ptr - this.totalStartDate) / (1000 * 60 * 60 * 24 * 7));
        this.calendarGrid.scrollTop = Math.max(0, weeksBefore * this.rowHeight);
        this.handleScroll();
    }

    // 回到今天
    goToToday() {
        // 直接滚动到今天的日期
        const today = new Date();
        const weeksBefore = Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - this.totalStartDate) / (1000 * 60 * 60 * 24 * 7));
        this.calendarGrid.scrollTop = Math.max(0, weeksBefore * this.rowHeight);
        this.handleScroll();

        // add visual feedback once rendered
        setTimeout(() => {
            const todayElement = this.daysContainer.querySelector('.calendar-day.today');
            if (todayElement) {
                todayElement.style.backgroundColor = '#ffeb3b';
                todayElement.style.transform = 'scale(1.1)';
                todayElement.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    todayElement.style.backgroundColor = '';
                    todayElement.style.transform = '';
                }, 1000);
            }
        }, 200);
    }

    // 重置日历
    resetCalendar() {
        // reinitialize virtualization and scroll to current month
        this.initCalendar();
    }
}