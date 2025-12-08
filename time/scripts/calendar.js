// Calendar functionality

// Helper to get current Date adjusted by `window.APP_TIMEZONE_OFFSET_MINUTES` when set
function getNowInTZ() {
    const now = new Date();
    const tz = window.APP_TIMEZONE_OFFSET_MINUTES;
    if (typeof tz === 'number') {
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        return new Date(utc + tz * 60000);
    }
    return now;
}

class Calendar {
    constructor() {
        this.currentDate = getNowInTZ();
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
        // Align totalStartDate to the Sunday at or before Jan 1 of startYear
        const rawStart = new Date(this.startYear, 0, 1);
        const startOffset = rawStart.getDay(); // 0=Sun..6=Sat
        this.totalStartDate = new Date(rawStart);
        this.totalStartDate.setDate(rawStart.getDate() - startOffset);

        // Align totalEndDate to the Saturday at or after Jan 1 of (endYear+1)
        const rawEnd = new Date(this.endYear + 1, 0, 1);
        const endOffset = (6 - rawEnd.getDay() + 7) % 7; // days to next Saturday
        this.totalEndDate = new Date(rawEnd);
        this.totalEndDate.setDate(rawEnd.getDate() + endOffset + 1); // exclusive past the last Saturday

        // runtime state for virtualization
        this.firstVisibleRow = 0; // row index (week index) currently at top
        const msPerWeek = 1000 * 60 * 60 * 24 * 7;
        this.totalWeeks = Math.ceil((this.totalEndDate - this.totalStartDate) / msPerWeek);
        
        this.initElements();
        this.bindEvents();
        this.init(); // 调用新的初始化方法

        // Listen for timezone changes and reinitialize the calendar view
        window.addEventListener('timezoneChanged', () => this.handleTimezoneChange());
    }

    initElements() {
        this.calendarMonthYear = document.getElementById('calendar-month-year');
        this.calendarGrid = document.getElementById('calendar-grid');
        this.calendarWeekdays = document.getElementById('calendar-weekdays');
        this.prevMonthBtn = document.getElementById('prev-month');
        this.nextMonthBtn = document.getElementById('next-month');
        this.todayBtn = document.getElementById('today-btn');
        // 添加选中的日期跟踪
        this.selectedDate = null;
    }

    bindEvents() {
        this.prevMonthBtn.addEventListener('click', () => this.previousMonth());
        this.nextMonthBtn.addEventListener('click', () => this.nextMonth());
        this.todayBtn.addEventListener('click', () => this.goToToday());
        
        // 添加滚动事件监听器
        this.calendarGrid.addEventListener('scroll', () => this.handleScroll());
        
        // 添加日期点击事件委托
        this.calendarGrid.addEventListener('click', (e) => {
            const dayElement = e.target.closest('.calendar-day');
            if (dayElement) {
                this.selectDate(dayElement);
            }
        });
    }

    // 新增初始化方法：计算初始索引为当月第一天所在的星期一
    init() {
        // 计算当月第一天
        const firstOfMonth = new Date(this.currentYear, this.currentMonth, 1);
        
        // 计算当月第一天的星期一
        const dayOfWeek = firstOfMonth.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        const diffToMonday = (dayOfWeek + 6) % 7; // 计算到星期一需要减去的天数
        
        // 当月第一天的星期一作为初始索引日期
        const initialMonday = new Date(firstOfMonth);
        initialMonday.setDate(firstOfMonth.getDate() - diffToMonday);
        
        // 计算初始索引（相对于totalStartDate的周数）
        const weeksFromStart = Math.floor((initialMonday - this.totalStartDate) / (1000 * 60 * 60 * 24 * 7));
        this.firstVisibleRow = weeksFromStart;
        
        // 初始化日历网格
        this.initCalendar();
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

        // 设置初始滚动位置
        const initialScrollTop = this.firstVisibleRow * this.rowHeight;
        
        // set container virtual height
        const contentHeight = this.totalWeeks * this.rowHeight;
        this.topSpacer.style.height = initialScrollTop + 'px';
        this.bottomSpacer.style.height = (contentHeight - initialScrollTop) + 'px';

        // apply initial scroll after a tick so dimensions exist
        setTimeout(() => {
            this.calendarGrid.scrollTop = initialScrollTop;
            this.handleScroll();
        }, 0);
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

        const today = getNowInTZ();

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

                // 如果这是选中的日期，添加selected类
                if (this.selectedDate && 
                    cellDate.getFullYear() === this.selectedDate.getFullYear() &&
                    cellDate.getMonth() === this.selectedDate.getMonth() &&
                    cellDate.getDate() === this.selectedDate.getDate()) {
                    day.classList.add('selected');
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

    // 处理日期选择
    selectDate(dayElement) {
        // 移除之前选中日期的selected类
        const previouslySelected = this.daysContainer.querySelector('.calendar-day.selected');
        if (previouslySelected) {
            previouslySelected.classList.remove('selected');
        }

        // 添加selected类到新选中的日期
        dayElement.classList.add('selected');
        
        // 更新选中的日期
        const dateParts = dayElement.dataset.date.split('-');
        this.selectedDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        
        // 更新标题显示距离今天多少天
        this.updateDaysFromToday();
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

            // 确保选中日期的文字颜色是白色
            if (day.classList.contains('selected')) {
                day.style.color = 'white';
            }

            if (day.classList.contains('today')) {
                day.style.color = '';
            }
        });
        
        // 如果有选中的日期，更新天数差显示
        if (this.selectedDate) {
            this.updateDaysFromToday();
        }
    }

    // 更新距离今天多少天的显示
    updateDaysFromToday() {
        if (!this.selectedDate) return;
        
        const today = getNowInTZ();
        today.setHours(0, 0, 0, 0);
        
        const selectedDate = new Date(this.selectedDate);
        selectedDate.setHours(0, 0, 0, 0);
        
        const timeDiff = selectedDate.getTime() - today.getTime();
        const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));
        
        let daysText = '';
        if (daysDiff === 0) {
            daysText = '(今天)';
        } else if (daysDiff > 0) {
            daysText = `(${daysDiff}天后)`;
        } else {
            daysText = `(${Math.abs(daysDiff)}天前)`;
        }
        
        // 在标题后添加天数差信息
        const currentText = this.calendarMonthYear.textContent;
        // 检查是否已经存在天数信息，如果有则替换，否则添加
        if (currentText.includes('(')) {
            this.calendarMonthYear.textContent = currentText.replace(/\(.*\)/, daysText);
        } else {
            this.calendarMonthYear.textContent = `${currentText} ${daysText}`;
        }
    }
    
    // 清除距离今天多少天的显示
    clearDaysFromToday() {
        const currentText = this.calendarMonthYear.textContent;
        if (currentText.includes('(')) {
            this.calendarMonthYear.textContent = currentText.replace(/\s*\(.*\)/, '');
        }
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
        const today = getNowInTZ();
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
        
        // 清除选中日期的天数差显示
        this.clearDaysFromToday();
    }

    // Handle timezone change: update current date and reinit calendar
    handleTimezoneChange() {
        try {
            this.currentDate = getNowInTZ();
            this.currentYear = this.currentDate.getFullYear();
            this.currentMonth = this.currentDate.getMonth();
            // Recompute initial firstVisibleRow and reinitialize
            this.init();
        } catch (e) {
            console.warn('Calendar failed to handle timezone change', e);
        }
    }

}