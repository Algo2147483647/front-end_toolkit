// Clock and calendar toggle functionality
class TimeApp {
    constructor() {
        this.clockBtn = document.getElementById('clock-btn');
        this.calendarBtn = document.getElementById('calendar-btn');
        this.clockView = document.getElementById('clock-view');
        this.calendarView = document.getElementById('calendar-view');
        this.toggleSlider = document.querySelector('.toggle-slider');
        this.sizeSlider = document.getElementById('size-slider');
        
        this.bindEvents();
        this.init();
    }

    bindEvents() {
        this.clockBtn.addEventListener('click', () => this.showClock());
        this.calendarBtn.addEventListener('click', () => this.showCalendar());
        this.sizeSlider.addEventListener('input', () => this.onSizeChange());
    }

    showClock() {
        this.clockBtn.classList.add('active');
        this.calendarBtn.classList.remove('active');
        this.toggleSlider.style.transform = 'translateX(0)';

        this.clockView.classList.remove('hidden');
        this.calendarView.classList.remove('active');

        setTimeout(() => {
            this.clockView.classList.add('fade-in');
        }, 50);
    }

    showCalendar() {
        this.calendarBtn.classList.add('active');
        this.clockBtn.classList.remove('active');
        this.toggleSlider.style.transform = 'translateX(100%)';

        this.clockView.classList.add('hidden');
        this.clockView.classList.remove('fade-in');
        this.calendarView.classList.add('active');
    }

    onSizeChange() {
        updateClockSize();
    }

    init() {
        // Initialize clock size
        updateClockSize();
        
        // Initialize calendar
        this.calendar = new Calendar();
        
        // Initial drawing
        drawClock();
        updateDigitalClock();

        // Set timer to update every second
        setInterval(() => {
            drawClock();
            updateDigitalClock();
        }, 1000);
    }
}

// Initialize after page load
document.addEventListener('DOMContentLoaded', () => {
    window.timeApp = new TimeApp();
});