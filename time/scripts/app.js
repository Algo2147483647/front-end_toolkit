// Clock and calendar toggle functionality
class TimeApp {
    constructor() {
        this.clockBtn = document.getElementById('clock-btn');
        this.calendarBtn = document.getElementById('calendar-btn');
        this.globeBtn = document.getElementById('globe-btn');
        this.clockView = document.getElementById('clock-view');
        this.calendarView = document.getElementById('calendar-view');
        this.globeView = document.getElementById('globe-view');
        this.toggleSlider = document.querySelector('.toggle-slider');
        this.sizeSlider = document.getElementById('size-slider');
        this.secondHandMotion = document.getElementById('second-hand-motion');
        this.settingsToggle = document.getElementById('settings-toggle');
        this.settingsPanel = document.getElementById('settings-panel');
        
        this.bindEvents();
        this.init();
    }

    bindEvents() {
        this.clockBtn.addEventListener('click', () => this.showClock());
        this.calendarBtn.addEventListener('click', () => this.showCalendar());
        if (this.globeBtn) this.globeBtn.addEventListener('click', () => this.showGlobe());
        this.sizeSlider.addEventListener('input', () => this.onSizeChange());
        this.secondHandMotion.addEventListener('change', () => this.onMotionChange());
        this.settingsToggle.addEventListener('click', () => this.toggleSettings());
    }

    showClock() {
        this.clockBtn.classList.add('active');
        this.calendarBtn.classList.remove('active');
        if (this.globeBtn) this.globeBtn.classList.remove('active');
        this.toggleSlider.style.transform = 'translateX(0)';

        this.clockView.classList.remove('hidden');
        this.calendarView.classList.remove('active');
        if (this.globeView) { this.globeView.style.display = 'none'; this.globeView.classList.remove('active'); }

        setTimeout(() => {
            this.clockView.classList.add('fade-in');
        }, 50);
    }

    showCalendar() {
        this.calendarBtn.classList.add('active');
        this.clockBtn.classList.remove('active');
        if (this.globeBtn) this.globeBtn.classList.remove('active');
        this.toggleSlider.style.transform = 'translateX(100%)';

        this.clockView.classList.add('hidden');
        this.clockView.classList.remove('fade-in');
        this.calendarView.classList.add('active');
        if (this.globeView) { this.globeView.style.display = 'none'; this.globeView.classList.remove('active'); }
    }

    showGlobe() {
        if (!this.globeView) return;
        this.globeBtn.classList.add('active');
        this.clockBtn.classList.remove('active');
        this.calendarBtn.classList.remove('active');
        this.toggleSlider.style.transform = 'translateX(200%)';

        this.clockView.classList.add('hidden');
        this.clockView.classList.remove('fade-in');

        this.calendarView.classList.remove('active');

        this.globeView.style.display = 'block';
        // allow CSS animation to pick up
        setTimeout(() => this.globeView.classList.add('active'), 30);
    }

    onSizeChange() {
        updateClockSize();
    }

    onMotionChange() {
        // 重新绘制时钟以应用新的秒针运动方式
        drawClock();
    }

    toggleSettings() {
        this.settingsPanel.classList.toggle('active');
    }

    init() {
        // Initialize clock size
        updateClockSize();
        
        // Initialize calendar
        this.calendar = new Calendar();
        
        // Initial drawing
        drawClock();
        updateDigitalClock();

        // Set timer to update every frame for smooth second hand or every second for ticking
        this.startClock();
    }
    
    startClock() {
        const update = () => {
            drawClock();
            updateDigitalClock();
            
            const motionSelect = document.getElementById('second-hand-motion');
            if (motionSelect && motionSelect.value === 'smooth') {
                // 平滑模式下每帧更新一次
                requestAnimationFrame(update);
            } else {
                // 一秒一跳模式下每秒更新一次
                setTimeout(update, 1000);
            }
        };
        
        // 启动时钟更新循环
        update();
    }
}

// Initialize after page load
document.addEventListener('DOMContentLoaded', () => {
    window.timeApp = new TimeApp();
});