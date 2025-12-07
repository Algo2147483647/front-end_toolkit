// Calendar functionality
class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.currentYear = this.currentDate.getFullYear();
        this.currentMonth = this.currentDate.getMonth();
        this.weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        this.monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        
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
        
        // 添加滚动事件监听器实现无限滚动
        this.calendarGrid.addEventListener('scroll', () => this.handleScroll());
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

        // 渲染初始月份及前后几个月
        this.renderSurroundingMonths(this.currentYear, this.currentMonth);
    }

    // 渲染指定年月及前后月份
    renderSurroundingMonths(year, month) {
        // 渲染前一个月
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
        }
        this.renderMonth(prevYear, prevMonth);

        // 渲染当前月份
        this.renderMonth(year, month);

        // 渲染下一个月
        let nextYear = year;
        let nextMonth = month + 1;
        if (nextMonth > 11) {
            nextMonth = 0;
            nextYear++;
        }
        this.renderMonth(nextYear, nextMonth);
    }

    // 渲染指定年月
    renderMonth(year, month) {
        // 创建临时容器存储新月份的日期
        const tempContainer = document.createDocumentFragment();
        
        // 获取该月的第一天和最后一天
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
            tempContainer.appendChild(day);
        }

        // 添加当前月的所有日期
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day';
            day.textContent = i;
            
            // 添加数据属性以便识别日期
            day.dataset.date = `${year}-${month+1}-${i}`;

            // 标记今天
            if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
                day.classList.add('today');
            }

            tempContainer.appendChild(day);
        }

        // 计算需要填充的剩余单元格
        const totalCells = 42; // 6行 * 7天
        const cellsAdded = firstDayOfWeek + daysInMonth;
        const remainingCells = totalCells - cellsAdded;

        // 添加下个月的前几天
        for (let i = 1; i <= remainingCells; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day other-month';
            day.textContent = i;
            tempContainer.appendChild(day);
        }

        // 添加月份分隔标识
        const monthSeparator = document.createElement('div');
        monthSeparator.className = 'month-separator';
        monthSeparator.dataset.year = year;
        monthSeparator.dataset.month = month;
        monthSeparator.style.display = 'none'; // 隐藏分隔符，仅用作标记
        tempContainer.appendChild(monthSeparator);

        // 添加到日历网格
        this.calendarGrid.appendChild(tempContainer);
    }

    // 处理滚动事件，实现无限滚动
    handleScroll() {
        const { scrollTop, scrollHeight, clientHeight } = this.calendarGrid;
        
        // 当接近顶部时，加载更多过去的月份
        if (scrollTop < 100) {
            this.loadMorePastMonths();
        }
        
        // 当接近底部时，加载更多未来的月份
        if (scrollHeight - clientHeight - scrollTop < 100) {
            this.loadMoreFutureMonths();
        }
        
        // 更新当前显示的月份标题
        this.updateCurrentMonthTitle();
    }

    // 加载更多过去的月份
    loadMorePastMonths() {
        // 获取最早渲染的月份
        const separators = this.calendarGrid.querySelectorAll('.month-separator');
        if (separators.length > 0) {
            const firstSeparator = separators[0];
            let year = parseInt(firstSeparator.dataset.year);
            let month = parseInt(firstSeparator.dataset.month);
            
            // 计算上一个月
            month--;
            if (month < 0) {
                month = 11;
                year--;
            }
            
            // 检查是否已经渲染过该月份
            const isRendered = Array.from(separators).some(separator => 
                parseInt(separator.dataset.year) === year && 
                parseInt(separator.dataset.month) === month
            );
            
            if (!isRendered) {
                // 在现有内容前插入新月份
                this.insertMonthBefore(year, month);
            }
        }
    }

    // 加载更多未来的月份
    loadMoreFutureMonths() {
        // 获取最晚渲染的月份
        const separators = this.calendarGrid.querySelectorAll('.month-separator');
        if (separators.length > 0) {
            const lastSeparator = separators[separators.length - 1];
            let year = parseInt(lastSeparator.dataset.year);
            let month = parseInt(lastSeparator.dataset.month);
            
            // 计算下一个月
            month++;
            if (month > 11) {
                month = 0;
                year++;
            }
            
            // 检查是否已经渲染过该月份
            const isRendered = Array.from(separators).some(separator => 
                parseInt(separator.dataset.year) === year && 
                parseInt(separator.dataset.month) === month
            );
            
            if (!isRendered) {
                // 追加新月份
                this.renderMonth(year, month);
            }
        }
    }

    // 在现有内容前插入月份
    insertMonthBefore(year, month) {
        // 创建临时容器存储新月份的日期
        const tempContainer = document.createDocumentFragment();
        
        // 获取该月的第一天和最后一天
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
            tempContainer.appendChild(day);
        }

        // 添加当前月的所有日期
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day';
            day.textContent = i;
            
            // 添加数据属性以便识别日期
            day.dataset.date = `${year}-${month+1}-${i}`;

            tempContainer.appendChild(day);
        }

        // 计算需要填充的剩余单元格
        const totalCells = 42; // 6行 * 7天
        const cellsAdded = firstDayOfWeek + daysInMonth;
        const remainingCells = totalCells - cellsAdded;

        // 添加下个月的前几天
        for (let i = 1; i <= remainingCells; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day other-month';
            day.textContent = i;
            tempContainer.appendChild(day);
        }

        // 添加月份分隔标识
        const monthSeparator = document.createElement('div');
        monthSeparator.className = 'month-separator';
        monthSeparator.dataset.year = year;
        monthSeparator.dataset.month = month;
        monthSeparator.style.display = 'none'; // 隐藏分隔符，仅用作标记
        tempContainer.appendChild(monthSeparator);

        // 插入到星期标题之后的第一个位置
        const weekdays = document.querySelectorAll('.weekday');
        const firstWeekday = weekdays[0];
        firstWeekday.after(tempContainer);
    }

    // 更新当前显示的月份标题
    updateCurrentMonthTitle() {
        // 获取可见区域中心的日期元素
        const calendarDays = this.calendarGrid.querySelectorAll('.calendar-day:not(.other-month)');
        if (calendarDays.length > 0) {
            // 找到可见区域中间的日期元素
            const middleIndex = Math.floor(calendarDays.length / 2);
            const middleDay = calendarDays[middleIndex];
            
            // 如果找到了中间的日期元素，更新标题
            if (middleDay) {
                // 从数据属性中获取日期信息
                const dateAttr = middleDay.dataset.date;
                if (dateAttr) {
                    const [year, month] = dateAttr.split('-').map(Number);
                    this.calendarMonthYear.textContent = `${this.monthNames[month-1]} ${year}`;
                }
            }
        }
    }

    // 上一个月（通过按钮）
    previousMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.resetCalendar();
    }

    // 下一个月（通过按钮）
    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.resetCalendar();
    }

    // 回到今天
    goToToday() {
        const today = new Date();
        this.currentYear = today.getFullYear();
        this.currentMonth = today.getMonth();
        this.resetCalendar();
    }

    // 重置日历（用于按钮导航）
    resetCalendar() {
        // 重新初始化日历
        this.initCalendar();
        
        // 滚动到顶部
        this.calendarGrid.scrollTop = 0;
    }
}