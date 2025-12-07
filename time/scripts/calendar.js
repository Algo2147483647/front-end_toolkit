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
        this.calendarGrid.innerHTML = '';
        if (this.calendarWeekdays) this.calendarWeekdays.innerHTML = '';

        // 添加星期标题到独立的标题容器
        this.weekdays.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'weekday';
            dayElement.textContent = day;
            if (this.calendarWeekdays) this.calendarWeekdays.appendChild(dayElement);
            else this.calendarGrid.appendChild(dayElement);
        });

        // 渲染从1970年到2030年的所有月份
        this.renderAllMonths();
    }

    // 渲染所有月份
    renderAllMonths() {
        const startYear = 1970;
        const endYear = 2030;
        
        // 清空网格
        this.calendarGrid.innerHTML = '';
        
        // 重新添加星期标题（如果需要的话）
        if (!this.calendarWeekdays) {
            this.weekdays.forEach(day => {
                const dayElement = document.createElement('div');
                dayElement.className = 'weekday';
                dayElement.textContent = day;
                this.calendarGrid.appendChild(dayElement);
            });
        }
        
        // 渲染所有月份
        for (let year = startYear; year <= endYear; year++) {
            for (let month = 0; month < 12; month++) {
                this.renderMonth(year, month);
            }
        }
        
        // 滚动到当前月份
        this.scrollToCurrentMonth();
    }

    // 渲染指定年月
    renderMonth(year, month) {
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
            // 添加数据属性标识月份
            day.dataset.month = month;
            day.dataset.year = year;
            this.calendarGrid.appendChild(day);
        }

        // 添加当前月的所有日期
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day';
            day.textContent = i;
            
            // 添加数据属性以便识别日期和月份
            day.dataset.date = `${year}-${month+1}-${i}`;
            day.dataset.month = month;
            day.dataset.year = year;

            // 标记今天
            if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
                day.classList.add('today');
            }

            this.calendarGrid.appendChild(day);
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
            // 添加数据属性标识月份
            day.dataset.month = month;
            day.dataset.year = year;
            this.calendarGrid.appendChild(day);
        }
    }

    // 滚动到当前月份
    scrollToCurrentMonth() {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        
        // 计算当前月份前面有多少个月
        const totalMonthsBefore = (currentYear - 1970) * 12 + currentMonth;
        
        // 每个月占据6行，每行高度大约是 (calendarGrid高度 / 行数)
        const rowHeight = 80; // 大概的高度
        const scrollToPosition = totalMonthsBefore * 6 * rowHeight;
        
        // 滚动到指定位置
        this.calendarGrid.scrollTop = scrollToPosition;
        
        // 更新标题和样式
        setTimeout(() => {
            this.updateCurrentMonthTitleAndStyles();
        }, 100);
    }

    // 处理滚动事件
    handleScroll() {
        // 使用防抖优化性能
        this.debounceUpdateTitleAndStyles();
    }

    // 防抖函数用于优化性能
    debounceUpdateTitleAndStyles() {
        clearTimeout(this.titleUpdateTimer);
        this.titleUpdateTimer = setTimeout(() => {
            this.updateCurrentMonthTitleAndStyles();
        }, 50);
    }

    // 更新当前显示的月份标题和日期样式
    updateCurrentMonthTitleAndStyles() {
        const gridHeight = this.calendarGrid.clientHeight;
        const scrollTop = this.calendarGrid.scrollTop;
        
        // 统计可见区域内各个月份的天数
        const monthCounts = new Map();
        const days = this.calendarGrid.querySelectorAll('.calendar-day');
        
        days.forEach(day => {
            const rect = day.getBoundingClientRect();
            const gridRect = this.calendarGrid.getBoundingClientRect();
            const relativeTop = rect.top - gridRect.top + scrollTop;
            
            // 检查日期是否在可见区域内
            if (relativeTop >= scrollTop && relativeTop <= scrollTop + gridHeight) {
                const month = parseInt(day.dataset.month);
                if (!isNaN(month)) {
                    monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
                }
            }
        });
        
        // 找到天数最多的月份作为主月份
        let primaryMonth = this.currentMonth;
        let maxCount = 0;
        
        monthCounts.forEach((count, month) => {
            if (count > maxCount) {
                maxCount = count;
                primaryMonth = month;
            }
        });
        
        // 更新标题
        this.calendarMonthYear.textContent = `${this.monthNames[primaryMonth]} ${new Date().getFullYear()}`;
        
        // 更新日期样式
        days.forEach(day => {
            const month = parseInt(day.dataset.month);
            if (month === primaryMonth) {
                day.style.color = '#000'; // 当前主月份日期置黑
            } else {
                day.style.color = '#999'; // 其他月份日期置灰
            }
            
            // 今天特殊处理 - 保持原有的背景色和文字色
            if (day.classList.contains('today')) {
                day.style.color = ''; // 移除自定义颜色，使用CSS定义的样式
            }
            
            // 其他月份的日期保持原来的灰色（通过CSS）
            if (day.classList.contains('other-month')) {
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
        this.resetCalendar();
    }

    // 下一个月
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
        // 直接滚动到今天的日期
        const todayElement = this.calendarGrid.querySelector('.calendar-day.today');
        if (todayElement) {
            todayElement.scrollIntoView({behavior: 'smooth', block: 'center'});
            
            // 添加视觉反馈
            todayElement.style.backgroundColor = '#ffeb3b';
            todayElement.style.transform = 'scale(1.1)';
            todayElement.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                todayElement.style.backgroundColor = '';
                todayElement.style.transform = '';
            }, 1000);
        }
    }

    // 重置日历
    resetCalendar() {
        this.initCalendar();
    }
}