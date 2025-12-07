(function(){
    // Defer initialization until DOM is ready so elements exist when the script runs.
    function initWhenReady() {
        try {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            } else {
                init();
            }
        } catch (e) {
            console.error('Globe init failed:', e);
        }
    }

    function init() {
        // Simple orthographic globe renderer with meridians/parallels and a red marker for current location.
        const canvas = document.getElementById('globe-canvas');
        if (!canvas) {
            console.warn('Globe: canvas not found');
            return;
        }
        const ctx = canvas.getContext('2d');

        console.log('Globe: initializing');

        let DPR = window.devicePixelRatio || 1;
        let width = 600, height = 600;
        let R = 280; // will be updated on resize
        let rotation = 0; // radians, central meridian
        let rotating = true;
        const rotationSpeed = 0.0025; // rad per frame

        let lat = 0, lon = 0; // degrees for current location
        let hasLocation = false;

        function resize() {
            const rect = canvas.getBoundingClientRect();
            width = rect.width || canvas.width / DPR || 600;
            height = rect.height || canvas.height / DPR || 600;
            DPR = window.devicePixelRatio || 1;
            canvas.width = Math.floor(width * DPR);
            canvas.height = Math.floor(height * DPR);
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            R = Math.min(width, height) * 0.45;
        }

        function clear() {
            ctx.clearRect(0, 0, width, height);
        }

        function project(phiDeg, lambdaDeg, rot) {
            // phi = latitude, lambda = longitude in degrees
            const phi = phiDeg * Math.PI/180;
            const lambda = lambdaDeg * Math.PI/180;
            const rl = lambda - rot; // rotated longitude
            const x = R * Math.cos(phi) * Math.sin(rl);
            const y = R * Math.sin(phi);
            const z = R * Math.cos(phi) * Math.cos(rl);
            return {x: x, y: y, z: z};
        }

        function drawSphere() {
            const cx = width/2;
            const cy = height/2;

            // Globe background
            const grad = ctx.createRadialGradient(cx - R*0.4, cy - R*0.4, R*0.2, cx, cy, R);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.6, '#dfeeff');
            grad.addColorStop(1, '#bfcff7');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI*2);
            ctx.fill();

            // subtle edge shading
            const edgeGrad = ctx.createRadialGradient(cx, cy, R*0.6, cx, cy, R);
            edgeGrad.addColorStop(0.9, 'rgba(255,255,255,0)');
            edgeGrad.addColorStop(1, 'rgba(30,40,60,0.07)');
            ctx.fillStyle = edgeGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI*2);
            ctx.fill();

            // Draw graticule: meridians and parallels
            ctx.lineWidth = 0.9;
            ctx.strokeStyle = 'rgba(50,60,90,0.25)';

            // Meridians
            const meridians = 24;
            for (let m=0;m<meridians;m++){
                const lambda = (m/meridians)*360 - 180;
                drawLongitude(lambda, rotation, 'rgba(60,80,120,0.18)');
            }

            // Parallels
            const parallels = 13; // from -60 to 60 roughly
            for (let p=0;p<parallels;p++){
                const phi = (p/(parallels-1))*180 - 90;
                drawLatitude(phi, rotation, 'rgba(60,80,120,0.18)');
            }

            // Equator and prime meridian stronger
            drawLatitude(0, rotation, 'rgba(40,60,120,0.45)', 1.4);
            drawLongitude(0, rotation, 'rgba(40,60,120,0.45)', 1.4);

            // location marker and lines
            if (hasLocation) {
                drawLongitude(lon, rotation, 'rgba(220,40,40,0.85)', 1.5);
                drawLatitude(lat, rotation, 'rgba(220,40,40,0.85)', 1.5);

                const p = project(lat, lon, rotation);
                const visible = p.z > 0.15 * R; // some tolerance
                if (visible) {
                    const sx = width/2 + p.x;
                    const sy = height/2 - p.y;
                    // shadow
                    ctx.beginPath();
                    ctx.fillStyle = 'rgba(0,0,0,0.12)';
                    ctx.arc(sx+3, sy+4, 6, 0, Math.PI*2);
                    ctx.fill();
                    // red dot
                    ctx.beginPath();
                    ctx.fillStyle = '#ff4040';
                    ctx.arc(sx, sy, 5.5, 0, Math.PI*2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff2';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }

            // subtle outline
            ctx.beginPath();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(40,50,80,0.12)';
            ctx.arc(cx, cy, R, 0, Math.PI*2);
            ctx.stroke();
        }

        function drawLongitude(lambdaDeg, rot, stroke, lw=0.9) {
            const cx = width/2;
            const cy = height/2;
            ctx.beginPath();
            let first = true;
            for (let phi = -90; phi <= 90; phi += 2) {
                const p = project(phi, lambdaDeg, rot);
                if (p.z <= 0) { first = true; continue; }
                const sx = cx + p.x;
                const sy = cy - p.y;
                if (first) { ctx.moveTo(sx, sy); first = false; } else { ctx.lineTo(sx, sy); }
            }
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lw;
            ctx.stroke();
        }

        function drawLatitude(phiDeg, rot, stroke, lw=0.9) {
            const cx = width/2;
            const cy = height/2;
            ctx.beginPath();
            let first = true;
            for (let lambda = -180; lambda <= 180; lambda += 2) {
                const p = project(phiDeg, lambda, rot);
                if (p.z <= 0) { first = true; continue; }
                const sx = cx + p.x;
                const sy = cy - p.y;
                if (first) { ctx.moveTo(sx, sy); first = false; } else { ctx.lineTo(sx, sy); }
            }
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lw;
            ctx.stroke();
        }

        function update() {
            clear();
            if (rotating) rotation += rotationSpeed;
            drawSphere();
            requestAnimationFrame(update);
        }

        // Try to obtain user location
        function setLocation(fromLat, fromLon) {
            lat = fromLat;
            lon = fromLon;
            hasLocation = true;
            const latEl = document.getElementById('lat-value');
            const lonEl = document.getElementById('lon-value');
            if (latEl) latEl.textContent = lat.toFixed(2);
            if (lonEl) lonEl.textContent = lon.toFixed(2);
        }

        function handleGeoSuccess(pos) {
            const p = pos.coords;
            setLocation(p.latitude, p.longitude);
        }
        function handleGeoError(err) {
            // fallback: example coordinates (Greenwich)
            setLocation(51.4779, -0.0015);
        }

        // center globe so that given longitude is at center
        function centerOnLongitude(targetLon) {
            // rotation is in radians equal to central meridian
            rotation = targetLon * Math.PI/180;
        }

        // wire UI
        function wireUI() {
            const toggle = document.getElementById('globe-rotate-toggle');
            const centerBtn = document.getElementById('globe-center-location');
            if (toggle) {
                toggle.addEventListener('click', () => {
                    rotating = !rotating;
                    toggle.textContent = rotating ? 'Pause' : 'Play';
                });
            }
            if (centerBtn) {
                centerBtn.addEventListener('click', () => {
                    if (hasLocation) centerOnLongitude(lon);
                });
            }

            // If globe view is hidden/shown we should trigger a resize so canvas stays crisp
            const obsTarget = document.getElementById('globe-view');
            if (obsTarget && window.ResizeObserver) {
                const obs = new ResizeObserver(() => { resize(); });
                obs.observe(obsTarget);
            }

            // Also observe window resize
            window.addEventListener('resize', resize);
        }

        // init
        resize();
        wireUI();
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(handleGeoSuccess, handleGeoError, {maximumAge: 600000, timeout: 8000});
        } else {
            handleGeoError();
        }

        requestAnimationFrame(update);
    }

    initWhenReady();
})();
