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
        this.calendarWeekdays = document.getElementById('calendar-weekdays');
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
        // 清空日历网格和星期标题容器
        this.calendarGrid.innerHTML = '';
        if (this.calendarWeekdays) this.calendarWeekdays.innerHTML = '';

        // 添加星期标题到独立的标题容器（避免随内容滚动）
        this.weekdays.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'weekday';
            dayElement.textContent = day;
            if (this.calendarWeekdays) this.calendarWeekdays.appendChild(dayElement);
            else this.calendarGrid.appendChild(dayElement);
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
        // 创建临时容器存储新月份的日期，并将其包裹到一个月份块中以便分隔
        const tempContainer = document.createDocumentFragment();
        const monthBlock = document.createElement('div');
        monthBlock.className = 'month-block';
        
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

        // 添加月份分隔标识到月份块末尾（用于定位）
        const monthSeparator = document.createElement('div');
        monthSeparator.className = 'month-separator';
        monthSeparator.dataset.year = year;
        monthSeparator.dataset.month = month;
        monthSeparator.style.display = 'none'; // 隐藏分隔符，仅用作标记
        tempContainer.appendChild(monthSeparator);

        // 将临时内容添加到月份块并插入到日历网格
        monthBlock.appendChild(tempContainer);
        this.calendarGrid.appendChild(monthBlock);
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
        const monthBlocks = this.calendarGrid.querySelectorAll('.month-block');
        if (monthBlocks.length > 0) {
            const firstBlock = monthBlocks[0];
            const firstSeparator = firstBlock.querySelector('.month-separator');
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
        const monthBlocks = this.calendarGrid.querySelectorAll('.month-block');
        if (monthBlocks.length > 0) {
            const lastBlock = monthBlocks[monthBlocks.length - 1];
            const lastSeparator = lastBlock.querySelector('.month-separator');
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
        // 创建月份块并填充日期（与 renderMonth 类似）
        const tempContainer = document.createDocumentFragment();
        const monthBlock = document.createElement('div');
        monthBlock.className = 'month-block';

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
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day';
            day.textContent = i;
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
        monthSeparator.style.display = 'none';
        tempContainer.appendChild(monthSeparator);

        monthBlock.appendChild(tempContainer);

        // 将新月份插入到第一个月份块之前，如果没有则追加
        const firstMonthBlock = this.calendarGrid.querySelector('.month-block');
        if (firstMonthBlock) this.calendarGrid.insertBefore(monthBlock, firstMonthBlock);
        else this.calendarGrid.appendChild(monthBlock);
    }

    // 更新当前显示的月份标题
    updateCurrentMonthTitle() {
        // 基于可见区域中心定位对应的月份块并更新标题
        const { scrollTop, clientHeight } = this.calendarGrid;
        const middleY = scrollTop + clientHeight / 2;
        const monthBlocks = this.calendarGrid.querySelectorAll('.month-block');
        for (let block of monthBlocks) {
            const top = block.offsetTop;
            const bottom = top + block.offsetHeight;
            if (middleY >= top && middleY <= bottom) {
                const sep = block.querySelector('.month-separator');
                if (sep) {
                    const year = parseInt(sep.dataset.year);
                    const month = parseInt(sep.dataset.month);
                    this.calendarMonthYear.textContent = `${this.monthNames[month]} ${year}`;
                }
                break;
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