// Draw the 24-hour geometric clock on canvas.
function drawClock() {
    const clockFace = document.getElementById('clock-face');
    const ctx = clockFace.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const devicePixelRatio = window.devicePixelRatio || 1;
    const centerX = clockFace.width / (2 * devicePixelRatio);
    const centerY = clockFace.height / (2 * devicePixelRatio);
    const radius = (clockFace.width / (2 * devicePixelRatio)) - 26;

    ctx.clearRect(0, 0, clockFace.width, clockFace.height);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    const dialGradient = ctx.createRadialGradient(
        centerX - radius * 0.22,
        centerY - radius * 0.24,
        radius * 0.18,
        centerX,
        centerY,
        radius
    );
    dialGradient.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    dialGradient.addColorStop(0.68, 'rgba(245, 245, 243, 0.96)');
    dialGradient.addColorStop(1, 'rgba(228, 231, 232, 0.96)');
    ctx.fillStyle = dialGradient;
    ctx.fill();

    const rimGradient = ctx.createLinearGradient(centerX, centerY - radius, centerX, centerY + radius);
    rimGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    rimGradient.addColorStop(1, 'rgba(188, 197, 203, 0.55)');
    ctx.strokeStyle = rimGradient;
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 0; i < 24; i++) {
        const angle = (i * Math.PI * 2) / 24;
        const innerRadius = radius * 0.46;
        const outerRadius = innerRadius + (i % 6 === 0 ? 12 : 8);

        const startX = centerX + Math.sin(angle) * innerRadius;
        const startY = centerY - Math.cos(angle) * innerRadius;
        const endX = centerX + Math.sin(angle) * outerRadius;
        const endY = centerY - Math.cos(angle) * outerRadius;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = i % 6 === 0 ? 'rgba(18, 28, 34, 0.82)' : 'rgba(18, 28, 34, 0.58)';
        ctx.lineWidth = i % 6 === 0 ? 3 : 1.8;
        ctx.stroke();

        const textRadius = outerRadius + 24;
        const textX = centerX + Math.sin(angle) * textRadius;
        const textY = centerY - Math.cos(angle) * textRadius;

        ctx.font = i % 6 === 0 ? '700 22px "Cormorant Garamond", serif' : '600 18px "Cormorant Garamond", serif';
        ctx.fillStyle = i % 6 === 0 ? 'rgba(21, 36, 44, 0.96)' : 'rgba(21, 36, 44, 0.82)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i === 0 ? '24' : i.toString(), textX, textY);
    }

    for (let i = 0; i < 60; i++) {
        const angle = (i * Math.PI * 2) / 60;
        const outerRadius = radius - 8;
        const innerRadius = outerRadius - (i % 5 === 0 ? 18 : 9);

        const startX = centerX + Math.sin(angle) * innerRadius;
        const startY = centerY - Math.cos(angle) * innerRadius;
        const endX = centerX + Math.sin(angle) * outerRadius;
        const endY = centerY - Math.cos(angle) * outerRadius;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = i % 5 === 0 ? 'rgba(21, 36, 44, 0.88)' : 'rgba(21, 36, 44, 0.58)';
        ctx.lineWidth = i % 5 === 0 ? 2.8 : 1.4;
        ctx.stroke();

        if (i % 5 === 0) {
            const textRadius = innerRadius - 34;
            const textX = centerX + Math.sin(angle) * textRadius;
            const textY = centerY - Math.cos(angle) * textRadius;

            ctx.font = '700 24px "Cormorant Garamond", serif';
            ctx.fillStyle = 'rgba(18, 28, 34, 0.95)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(i === 0 ? '60' : i.toString(), textX, textY);
        }
    }

    const now = getNowInTimezone();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const milliseconds = now.getMilliseconds();

    const hourAngle = (hours % 24 + minutes / 60) * Math.PI / 12 - Math.PI / 2;

    const motionSelect = document.getElementById('second-hand-motion');
    const smoothMotion = motionSelect && motionSelect.value === 'smooth';

    const minuteAngle = smoothMotion
        ? (minutes + (seconds + milliseconds / 1000) / 60) * Math.PI / 30 - Math.PI / 2
        : (minutes + seconds / 60) * Math.PI / 30 - Math.PI / 2;

    const secondAngle = smoothMotion
        ? (seconds + milliseconds / 1000) * Math.PI / 30 - Math.PI / 2
        : seconds * Math.PI / 30 - Math.PI / 2;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(hourAngle) * radius * 0.42,
        centerY + Math.sin(hourAngle) * radius * 0.42
    );
    ctx.strokeStyle = '#0f1820';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(minuteAngle) * radius * 0.84,
        centerY + Math.sin(minuteAngle) * radius * 0.84
    );
    ctx.strokeStyle = '#0f1820';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(secondAngle) * radius * 0.88,
        centerY + Math.sin(secondAngle) * radius * 0.88
    );
    ctx.strokeStyle = '#ff5f57';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5f57';
    ctx.fill();
}

function updateDigitalClock() {
    const now = getNowInTimezone();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    document.getElementById('hours').textContent = hours;
    document.getElementById('minutes').textContent = minutes;
    document.getElementById('seconds').textContent = seconds;
}

function updateClockSize() {
    const sizeSlider = document.getElementById('size-slider');
    const clockFace = document.getElementById('clock-face');
    const digitalClock = document.getElementById('digital-clock');
    const clockVisual = document.querySelector('.clock-visual');
    const clockContainer = document.querySelector('.clock-container');

    const desiredClockSize = parseInt(sizeSlider.value, 10);
    const maxViewportClockSize = Math.max(
        260,
        Math.min(window.innerWidth - 64, window.innerHeight - 220, 820)
    );
    const maxContainerClockSize = clockVisual
        ? Math.max(
            260,
            Math.min(clockVisual.clientWidth - 72, clockVisual.clientHeight - 140, maxViewportClockSize)
        )
        : maxViewportClockSize;
    const clockSize = Math.min(desiredClockSize, maxContainerClockSize);

    const devicePixelRatio = window.devicePixelRatio || 1;
    clockFace.width = clockSize * devicePixelRatio;
    clockFace.height = clockSize * devicePixelRatio;
    clockFace.style.width = `${clockSize}px`;
    clockFace.style.height = `${clockSize}px`;

    const ctx = clockFace.getContext('2d');
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    digitalClock.style.top = `${clockSize + 22}px`;
    if (clockContainer) {
        clockContainer.style.paddingBottom = `${Math.max(132, Math.round(clockSize * 0.18) + 72)}px`;
    }

    drawClock();
}

function getNowInTimezone() {
    const now = new Date();
    const tz = window.APP_TIMEZONE_OFFSET_MINUTES;
    if (typeof tz === 'number') {
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        return new Date(utc + tz * 60000);
    }
    return now;
}

window.addEventListener('timezoneChanged', () => {
    try {
        drawClock();
        updateDigitalClock();
    } catch (e) {
        console.warn('Clock refresh on timezone change failed', e);
    }
});

window.addEventListener('resize', () => {
    try {
        updateClockSize();
    } catch (e) {
        console.warn('Clock resize sync failed', e);
    }
});
