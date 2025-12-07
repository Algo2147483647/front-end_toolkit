// 绘制24小时圆盘时钟
function drawClock() {
    const clockFace = document.getElementById('clock-face');
    const ctx = clockFace.getContext('2d');
    const centerX = clockFace.width / 2;
    const centerY = clockFace.height / 2;
    const radius = clockFace.width / 2 - 10;

    // 清空画布
    ctx.clearRect(0, 0, clockFace.width, clockFace.height);

    // 绘制圆盘背景
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
        centerX, centerY, radius * 0.5,
        centerX, centerY, radius
    );
    gradient.addColorStop(0, 'rgba(25, 25, 60, 0.8)');
    gradient.addColorStop(1, 'rgba(10, 10, 30, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // 绘制外圆边框
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100, 100, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制24小时刻度
    for (let i = 0; i < 24; i++) {
        const angle = (i * Math.PI * 2) / 24;
        const startX = centerX + Math.sin(angle) * (radius - 15);
        const startY = centerY - Math.cos(angle) * (radius - 15);
        const endX = centerX + Math.sin(angle) * (radius - 5);
        const endY = centerY - Math.cos(angle) * (radius - 5);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = i % 6 === 0 ? 'rgba(150, 150, 255, 0.9)' : 'rgba(150, 150, 255, 0.6)';
        ctx.lineWidth = i % 6 === 0 ? 3 : 2;
        ctx.stroke();

        // 绘制小时数字（24小时制）
        const textX = centerX + Math.sin(angle) * (radius - 35);
        const textY = centerY - Math.cos(angle) * (radius - 35);

        ctx.font = i % 6 === 0 ? 'bold 18px Arial' : '16px Arial';
        ctx.fillStyle = i % 6 === 0 ? 'rgba(220, 220, 255, 0.9)' : 'rgba(200, 200, 255, 0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i === 0 ? '24' : i.toString(), textX, textY);
    }

    // 获取当前时间
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // 计算指针角度（24小时制）
    const hourAngle = (hours % 24 + minutes / 60) * Math.PI / 12 - Math.PI / 2;
    const minuteAngle = (minutes + seconds / 60) * Math.PI / 30 - Math.PI / 2;
    const secondAngle = seconds * Math.PI / 30 - Math.PI / 2;

    // 绘制时针
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(hourAngle) * radius * 0.5,
        centerY + Math.sin(hourAngle) * radius * 0.5
    );
    ctx.strokeStyle = '#4a6fff';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 绘制分针
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(minuteAngle) * radius * 0.7,
        centerY + Math.sin(minuteAngle) * radius * 0.7
    );
    ctx.strokeStyle = '#6d8eff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 绘制秒针
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(secondAngle) * radius * 0.8,
        centerY + Math.sin(secondAngle) * radius * 0.8
    );
    ctx.strokeStyle = '#ff4a4a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 绘制中心点
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4a4a';
    ctx.fill();
}

// 更新数字时钟
function updateDigitalClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    const hoursElement = document.getElementById('hours');
    const minutesElement = document.getElementById('minutes');
    const secondsElement = document.getElementById('seconds');

    hoursElement.textContent = hours;
    minutesElement.textContent = minutes;
    secondsElement.textContent = seconds;
}

// 时钟尺寸调整
function updateClockSize() {
    const sizeSlider = document.getElementById('size-slider');
    const clockFace = document.getElementById('clock-face');
    const digitalClock = document.getElementById('digital-clock');
    
    let clockSize = parseInt(sizeSlider.value);
    
    clockFace.width = clockSize;
    clockFace.height = clockSize;
    clockFace.style.width = `${clockSize}px`;
    clockFace.style.height = `${clockSize}px`;

    // 调整数字时钟位置
    const digitalClockHeight = 60;
    digitalClock.style.top = `${clockSize * 0.7}px`;

    drawClock();
}