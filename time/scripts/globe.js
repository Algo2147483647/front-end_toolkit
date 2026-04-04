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
        let R = 320; // will be updated on resize; default larger
        // 3D rotations (radians)
        let rotX = 0; // pitch
        let rotY = 0; // yaw
        let rotZ = 0; // roll
        let rotating = true;
        let rotationSpeed = 0.0025; // rad per frame (applies to yaw)
        const baseRotationSpeed = 0.0025; // Base speed value for calculations

        // Earth's axial tilt in radians (approximately 23.5 degrees)
        const earthAxialTilt = 23.5 * Math.PI / 180;
        rotZ = earthAxialTilt; // Set initial tilt to Earth's axial tilt

        // Show/hide terminator line
        let showTerminator = true;

        // Centering animation state
        let targetRotY = null;
        let prevRotating = null;
        let centerAnimating = false;

        let lat = 0, lon = 0; // degrees for current location
        let hasLocation = false;
        let isDragging = false;
        let lastPointer = null;
        let lightingCanvas = null;
        let lightingCtx = null;
        let lightingImageData = null;

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
            R = Math.min(width, height) * 0.485;
        }

        function getResponsiveCanvasSize(requestedSize) {
            const container = canvas.closest('.globe-container');
            const overlay = container ? container.querySelector('.globe-overlay') : null;
            const overlayHeight = overlay ? overlay.offsetHeight : 0;
            const maxViewportSize = Math.max(
                320,
                Math.min(window.innerWidth - 64, window.innerHeight - 180, 1200)
            );
            const maxContainerSize = container
                ? Math.max(
                    320,
                    Math.min(container.clientWidth - 72, container.clientHeight - overlayHeight - 72, maxViewportSize)
                )
                : maxViewportSize;
            return Math.min(requestedSize, maxContainerSize);
        }

        function applyCanvasSize(requestedSize) {
            const size = getResponsiveCanvasSize(requestedSize);
            canvas.style.width = size + 'px';
            canvas.style.height = size + 'px';
        }

        function applyOrientation(x, y, z) {
            const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
            const y1 = y * cosX - z * sinX;
            const z1 = y * sinX + z * cosX;
            const x1 = x;

            const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
            const x2 = x1 * cosY + z1 * sinY;
            const z2 = -x1 * sinY + z1 * cosY;
            const y2 = y1;

            const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
            const x3 = x2 * cosZ - y2 * sinZ;
            const y3 = x2 * sinZ + y2 * cosZ;
            const z3 = z2;

            return { x: x3, y: y3, z: z3 };
        }

        function clear() {
            ctx.clearRect(0, 0, width, height);
        }

        function sphericalToCartesian(phiDeg, lambdaDeg) {
            const phi = phiDeg * Math.PI / 180;
            const lambda = lambdaDeg * Math.PI / 180;
            return {
                x: Math.cos(phi) * Math.cos(lambda),
                y: Math.sin(phi),
                z: Math.cos(phi) * Math.sin(lambda)
            };
        }

        function project3D(phiDeg, lambdaDeg) {
            const base = sphericalToCartesian(phiDeg, lambdaDeg);
            const oriented = applyOrientation(base.x, base.y, base.z);
            return { x: oriented.x * R, y: oriented.y * R, z: oriented.z * R };
        }

        // --- Quaternion helpers ---
        function quatFromAxisAngle(ax, ay, az, angle) {
            const half = angle / 2;
            const s = Math.sin(half);
            const len = Math.hypot(ax, ay, az) || 1;
            return { w: Math.cos(half), x: (ax/len) * s, y: (ay/len) * s, z: (az/len) * s };
        }

        function quatMultiply(a, b) {
            return {
                w: a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
                x: a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
                y: a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
                z: a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w
            };
        }

        function quatConjugate(q) {
            return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
        }

        function rotateVecByQuat(q, v) {
            // v' = q * v_quat * q_conj
            const vq = { w: 0, x: v.x, y: v.y, z: v.z };
            const t = quatMultiply(q, vq);
            const r = quatMultiply(t, quatConjugate(q));
            return { x: r.x, y: r.y, z: r.z };
        }

        function quatFromEulerXYZ(rx, ry, rz) {
            // Build quaternion equivalent to Rz * Ry * Rx (apply Rx, then Ry, then Rz)
            const qx = quatFromAxisAngle(1,0,0, rx);
            const qy = quatFromAxisAngle(0,1,0, ry);
            const qz = quatFromAxisAngle(0,0,1, rz);
            return quatMultiply(qz, quatMultiply(qy, qx));
        }

        function quatToEulerXYZ(q) {
            // Convert quaternion to Euler angles with rotation order X then Y then Z
            // (intrinsic rotations). Returns [rx, ry, rz].
            const w = q.w, x = q.x, y = q.y, z = q.z;

            // X (pitch)
            const sinX = 2*(w*x + y*z);
            const cosX = 1 - 2*(x*x + y*y);
            const rx = Math.atan2(sinX, cosX);

            // Y (yaw)
            let sinY = 2*(w*y - z*x);
            sinY = Math.max(-1, Math.min(1, sinY));
            const ry = Math.asin(sinY);

            // Z (roll)
            const sinZ = 2*(w*z + x*y);
            const cosZ = 1 - 2*(y*y + z*z);
            const rz = Math.atan2(sinZ, cosZ);

            return [rx, ry, rz];
        }

        // Normalize angle to range [-PI, PI]
        function normalizeAngle(a) {
            const TWO_PI = Math.PI * 2;
            let v = a;
            while (v <= -Math.PI) v += TWO_PI;
            while (v > Math.PI) v -= TWO_PI;
            return v;
        }

        // Calculate the solar declination angle for a given date (in radians)
        function calculateSolarDeclination(date) {
            const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
            // Approximate formula for solar declination
            return 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (dayOfYear - 81) / 365);
        }

        // Calculate the hour angle for a given longitude and time (in radians)
        function calculateHourAngle(date, longitude) {
            // UTC time
            const utcHours = date.getUTCHours();
            const utcMinutes = date.getUTCMinutes();
            const utcSeconds = date.getUTCSeconds();
            
            // Total hours in decimal
            const totalHours = utcHours + utcMinutes / 60 + utcSeconds / 3600;
            
            // Hour angle calculation (in degrees)
            // Formula: HA = (UTC_hours - 12) * 15 + longitude
            const hourAngleDeg = (totalHours - 12) * 15 + longitude;
            
            // Convert to radians
            return hourAngleDeg * Math.PI / 180;
        }

        // Compute timezone offset minutes from longitude (approximate):
        // Each 15° of longitude corresponds to one hour offset from UTC.
        function computeTimezoneOffsetMinutes(longitude) {
            // round to nearest timezone meridian
            const hours = Math.round(longitude / 15);
            return hours * 60;
        }

        function normalizeLongitude(longitude) {
            let value = longitude;
            while (value <= -180) value += 360;
            while (value > 180) value -= 360;
            return value;
        }

        function calculateSubsolarLongitude(date) {
            const totalHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
            return normalizeLongitude(180 - totalHours * 15);
        }

        function getSunDirection(date) {
            const declinationDeg = calculateSolarDeclination(date) * 180 / Math.PI;
            const subsolarLongitude = calculateSubsolarLongitude(date);
            const world = sphericalToCartesian(declinationDeg, subsolarLongitude);
            const view = applyOrientation(world.x, world.y, world.z);
            const length = Math.hypot(view.x, view.y, view.z) || 1;
            return {
                x: view.x / length,
                y: view.y / length,
                z: view.z / length
            };
        }

        function drawIlluminationOverlay(cx, cy, sunDirection) {
            const resolution = Math.max(180, Math.min(320, Math.round(R * 1.1)));

            if (!lightingCanvas || lightingCanvas.width !== resolution || lightingCanvas.height !== resolution) {
                lightingCanvas = document.createElement('canvas');
                lightingCanvas.width = resolution;
                lightingCanvas.height = resolution;
                lightingCtx = lightingCanvas.getContext('2d');
                lightingImageData = lightingCtx.createImageData(resolution, resolution);
            }

            const data = lightingImageData.data;

            for (let py = 0; py < resolution; py++) {
                const ny = 1 - ((py + 0.5) / resolution) * 2;
                for (let px = 0; px < resolution; px++) {
                    const nx = ((px + 0.5) / resolution) * 2 - 1;
                    const index = (py * resolution + px) * 4;
                    const radiusSq = nx * nx + ny * ny;

                    if (radiusSq > 1) {
                        data[index + 3] = 0;
                        continue;
                    }

                    const nz = Math.sqrt(1 - radiusSq);
                    const lightAmount = nx * sunDirection.x + ny * sunDirection.y + nz * sunDirection.z;
                    const day = Math.max(0, lightAmount);
                    const night = Math.max(0, -lightAmount);
                    const twilight = Math.max(0, 1 - Math.abs(lightAmount) / 0.14);

                    let r = 0;
                    let g = 0;
                    let b = 0;
                    let alpha = 0;

                    if (night > 0) {
                        r += 6;
                        g += 10;
                        b += 18;
                        alpha += 0.12 + Math.pow(night, 0.78) * 0.56;
                    }

                    if (day > 0) {
                        r += 255;
                        g += 252;
                        b += 248;
                        alpha += 0.03 + Math.pow(day, 0.92) * 0.16;
                    }

                    if (twilight > 0) {
                        r = r * (1 - twilight * 0.35) + 255 * twilight * 0.35;
                        g = g * (1 - twilight * 0.35) + 188 * twilight * 0.35;
                        b = b * (1 - twilight * 0.35) + 128 * twilight * 0.35;
                        alpha += twilight * 0.12;
                    }

                    data[index] = Math.max(0, Math.min(255, Math.round(r)));
                    data[index + 1] = Math.max(0, Math.min(255, Math.round(g)));
                    data[index + 2] = Math.max(0, Math.min(255, Math.round(b)));
                    data[index + 3] = Math.max(0, Math.min(255, Math.round(alpha * 255)));
                }
            }

            lightingCtx.putImageData(lightingImageData, 0, 0);

            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(lightingCanvas, cx - R, cy - R, R * 2, R * 2);
            ctx.restore();
        }

        // Calculate the terminator line points
        function calculateTerminatorLine() {
            const points = [];
            const now = new Date();
            const solarDeclination = calculateSolarDeclination(now);
            
            // Calculate points for both day and night sides
            for (let i = 0; i <= 360; i += 2) {
                const longitude = i - 180; // From -180 to 180
                
                // Calculate the latitude where the sun is at the horizon (sun altitude = 0)
                // This uses the formula: sin(altitude) = sin(lat)*sin(dec) + cos(lat)*cos(dec)*cos(HA)
                // For altitude = 0: cos(lat) = -tan(dec) * tan(HA)
                // But we'll use a simpler approach that works well for visualization
                
                // Calculate hour angle for this longitude
                const hourAngle = calculateHourAngle(now, longitude);
                
                // Calculate latitude where sun is at horizon
                // Using formula: sin(0) = sin(lat)*sin(dec) + cos(lat)*cos(dec)*cos(HA)
                // Rearranging: tan(lat) = -cos(dec)*cos(HA) / sin(dec)
                // Which simplifies to: lat = arctan(-cos(dec)*cos(HA) / sin(dec))
                
                // Special case handling near poles
                let latitude;
                if (Math.abs(solarDeclination) > 0.01) {
                    latitude = Math.atan(-Math.cos(solarDeclination) * Math.cos(hourAngle) / Math.sin(solarDeclination));
                    latitude = latitude * 180 / Math.PI; // Convert to degrees
                    
                    // Clamp to realistic values
                    latitude = Math.max(Math.min(latitude, 90), -90);
                } else {
                    // Near equinox, terminator is nearly vertical
                    latitude = longitude > 0 ? 90 : -90;
                }
                
                points.push({ lat: latitude, lon: longitude });
            }
            
            return points;
        }

        function drawSphere() {
            const cx = width/2;
            const cy = height/2;
            const now = new Date();
            const sunDirection = getSunDirection(now);

            // Atmosphere glow
            ctx.beginPath();
            ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(117, 167, 214, 0.12)';
            ctx.shadowColor = 'rgba(117, 167, 214, 0.18)';
            ctx.shadowBlur = 32;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Globe background
            const grad = ctx.createRadialGradient(cx - R*0.34, cy - R*0.42, R*0.16, cx, cy, R);
            grad.addColorStop(0, '#fbfdff');
            grad.addColorStop(0.4, '#dce9ff');
            grad.addColorStop(0.76, '#a7bfec');
            grad.addColorStop(1, '#5f78a9');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI*2);
            ctx.fill();

            drawIlluminationOverlay(cx, cy, sunDirection);

            // Globe shadow
            const shadowGrad = ctx.createRadialGradient(cx + R * 0.2, cy + R * 0.22, R * 0.22, cx, cy, R);
            shadowGrad.addColorStop(0, 'rgba(14, 23, 40, 0)');
            shadowGrad.addColorStop(1, 'rgba(14, 23, 40, 0.24)');
            ctx.fillStyle = shadowGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.fill();

            // Draw terminator (day/night boundary)
            if (showTerminator) {
                const terminatorPoints = calculateTerminatorLine();
                if (terminatorPoints.length > 0) {
                    ctx.beginPath();
                    let first = true;
                    
                    for (const point of terminatorPoints) {
                        const p = project3D(point.lat, point.lon);
                        // Only draw points on the visible side of the globe
                        if (p.z <= 0) { 
                            first = true; 
                            continue; 
                        }
                        
                        const sx = cx + p.x;
                        const sy = cy - p.y;
                        
                        if (first) { 
                            ctx.moveTo(sx, sy); 
                            first = false; 
                        } else { 
                            ctx.lineTo(sx, sy); 
                        }
                    }
                    
                    ctx.strokeStyle = 'rgba(255, 188, 134, 0.92)';
                    ctx.lineWidth = 2.4;
                    ctx.shadowColor = 'rgba(255, 170, 112, 0.26)';
                    ctx.shadowBlur = 8;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }

            // Edge highlight and shading
            const edgeGrad = ctx.createRadialGradient(cx, cy, R*0.6, cx, cy, R);
            edgeGrad.addColorStop(0.9, 'rgba(255,255,255,0)');
            edgeGrad.addColorStop(1, 'rgba(15,25,45,0.12)');
            ctx.fillStyle = edgeGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI*2);
            ctx.fill();

            const glossGrad = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.42, R * 0.04, cx - R * 0.28, cy - R * 0.3, R * 0.78);
            glossGrad.addColorStop(0, 'rgba(255,255,255,0.72)');
            glossGrad.addColorStop(0.4, 'rgba(255,255,255,0.18)');
            glossGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = glossGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.fill();

            // Draw graticule: meridians and parallels
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(64, 91, 142, 0.24)';

            // Meridians
            const meridians = 24;
            for (let m=0;m<meridians;m++){
                const lambda = (m/meridians)*360 - 180;
                drawLongitude(lambda, 'rgba(76, 104, 158, 0.2)');
            }

            // Parallels
            const parallels = 13; // from -60 to 60 roughly
            for (let p=0;p<parallels;p++){
                const phi = (p/(parallels-1))*180 - 90;
                drawLatitude(phi, 'rgba(76, 104, 158, 0.2)');
            }

            // Equator and prime meridian stronger
            drawLatitude(0, 'rgba(62, 89, 156, 0.62)', 1.5);
            drawLongitude(0, 'rgba(62, 89, 156, 0.62)', 1.5);

            // location marker and lines
            if (hasLocation) {
                drawLongitude(lon, 'rgba(255,110,92,0.88)', 1.8);
                drawLatitude(lat, 'rgba(255,110,92,0.88)', 1.8);

                const p = project3D(lat, lon);
                const visible = p.z > 0.15 * R; // some tolerance
                if (visible) {
                    const sx = width/2 + p.x;
                    const sy = height/2 - p.y;
                    // shadow
                    ctx.beginPath();
                    ctx.fillStyle = 'rgba(0,0,0,0.18)';
                    ctx.arc(sx+4, sy+5, 7, 0, Math.PI*2);
                    ctx.fill();
                    // red dot
                    ctx.beginPath();
                    ctx.fillStyle = '#ff725f';
                    ctx.arc(sx, sy, 6.5, 0, Math.PI*2);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                    ctx.lineWidth = 1.4;
                    ctx.stroke();
                }
            }

            // Outer outline
            ctx.beginPath();
            ctx.lineWidth = 1.6;
            ctx.strokeStyle = 'rgba(35, 53, 91, 0.26)';
            ctx.arc(cx, cy, R, 0, Math.PI*2);
            ctx.stroke();
        }

        function drawLongitude(lambdaDeg, stroke, lw=0.9) {
            const cx = width/2;
            const cy = height/2;
            ctx.beginPath();
            let first = true;
            for (let phi = -90; phi <= 90; phi += 2) {
                const p = project3D(phi, lambdaDeg);
                if (p.z <= 0) { first = true; continue; }
                const sx = cx + p.x;
                const sy = cy - p.y;
                if (first) { ctx.moveTo(sx, sy); first = false; } else { ctx.lineTo(sx, sy); }
            }
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lw;
            ctx.stroke();
        }

        function drawLatitude(phiDeg, stroke, lw=0.9) {
            const cx = width/2;
            const cy = height/2;
            ctx.beginPath();
            let first = true;
            for (let lambda = -180; lambda <= 180; lambda += 2) {
                const p = project3D(phiDeg, lambda);
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

            // If we're animating a center-on-longitude, drive rotY toward targetRotY
            if (centerAnimating && targetRotY !== null) {
                const delta = normalizeAngle(targetRotY - rotY);
                const stepFactor = 0.18; // interpolation factor (0..1)
                if (Math.abs(delta) < 0.0008) {
                    rotY = targetRotY;
                    centerAnimating = false;
                    targetRotY = null;
                    // restore previous auto-rotation state
                    if (prevRotating !== null) {
                        rotating = prevRotating;
                        prevRotating = null;
                    }
                } else {
                    rotY = normalizeAngle(rotY + delta * stepFactor);
                }

            } else if (rotating && !isDragging) {
                // Rotate around the globe's physical axis (local Y axis transformed
                // by the current orientation). Build a quaternion from current
                // Euler angles, rotate about the axis in world space, then convert
                // back to Euler for rendering code that still expects rotX/rotY/rotZ.
                const orient = quatFromEulerXYZ(rotX, rotY, rotZ);
                // local north axis
                const localAxis = { x: 0, y: 1, z: 0 };
                const axisWorld = rotateVecByQuat(orient, localAxis);
                // small rotation quaternion about axisWorld
                const qAxis = quatFromAxisAngle(axisWorld.x, axisWorld.y, axisWorld.z, rotationSpeed);
                const newOrient = quatMultiply(qAxis, orient);
                const e = quatToEulerXYZ(newOrient);
                rotX = e[0]; rotY = e[1]; rotZ = e[2];
            }

            drawSphere();
            requestAnimationFrame(update);
        }

        // Try to obtain user location
        function setLocation(fromLat, fromLon) {
            lat = fromLat;
            lon = fromLon;
            hasLocation = true;
            
            // Update input boxes and sliders
            const latitudeInput = document.getElementById('latitude-input');
            const longitudeInput = document.getElementById('longitude-input');
            const latitudeSlider = document.getElementById('latitude-slider');
            const longitudeSlider = document.getElementById('longitude-slider');
            
            if (latitudeInput) latitudeInput.value = lat.toFixed(1);
            if (longitudeInput) longitudeInput.value = lon.toFixed(1);
            if (latitudeSlider) latitudeSlider.value = lat.toFixed(1);
            if (longitudeSlider) longitudeSlider.value = lon.toFixed(1);
            
            updateCoordinateDisplay();

            // Update global timezone offset (approximate) and notify listeners
            try {
                const tzOffset = computeTimezoneOffsetMinutes(lon);
                window.APP_TIMEZONE_OFFSET_MINUTES = tzOffset;
                window.dispatchEvent(new CustomEvent('timezoneChanged', { detail: { offsetMinutes: tzOffset } }));
            } catch (e) {
                console.warn('Failed to set timezone from location', e);
            }
        }

        // Expose lat and lon globally so they can be accessed from settings
        Object.defineProperty(window, 'lat', {
            get: function() { return lat; }
        });
        
        Object.defineProperty(window, 'lon', {
            get: function() { return lon; }
        });

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
            // Compute yaw so the given longitude faces the viewer.
            // With our spherical coordinates and rotation convention the
            // longitude that faces the viewer when rotY === 0 is +90°,
            // so the yaw required to bring `targetLon` to the front is
            // rotY = targetLon - 90° (in radians).
            const targetRad = (targetLon || 0) * Math.PI / 180;
            const desired = targetRad - Math.PI/2;

            // Smoothly animate to the target yaw instead of snapping.
            prevRotating = rotating;
            rotating = false;
            centerAnimating = true;
            targetRotY = normalizeAngle(desired);
        }

        // Expose centerOnLongitude globally so it can be called from settings
        window.centerOnLongitude = centerOnLongitude;
        window.hasLocation = () => hasLocation;

        // wire UI
        function wireUI() {
            const centerBtn = document.getElementById('globe-center-location');
            const globeSizeInput = document.getElementById('globe-size');
            const globeTiltInput = document.getElementById('globe-tilt');
            const resetTiltBtn = document.getElementById('reset-tilt');
            const globeSpeedInput = document.getElementById('globe-speed');
            const toggleBtn = document.getElementById('globe-rotate-toggle');
            const terminatorToggle = document.getElementById('terminator-toggle');
            
            // 新增的经纬度控制元素
            const latitudeInput = document.getElementById('latitude-input');
            const longitudeInput = document.getElementById('longitude-input');
            const latitudeSlider = document.getElementById('latitude-slider');
            const longitudeSlider = document.getElementById('longitude-slider');
            
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    rotating = !rotating;
                    const icon = toggleBtn.querySelector('i');
                    if (icon) {
                        if (rotating) {
                            icon.className = 'fas fa-pause';
                            toggleBtn.title = 'Pause Rotation';
                        } else {
                            icon.className = 'fas fa-play';
                            toggleBtn.title = 'Resume Rotation';
                        }
                    }
                });
            }
            
            if (centerBtn) {
                centerBtn.addEventListener('click', () => {
                    if (hasLocation) centerOnLongitude(lon);
                });
            }

            if (globeTiltInput) {
                // Set initial slider value to Earth's tilt in degrees
                globeTiltInput.value = 23.5;
                
                globeTiltInput.addEventListener('input', (e) => {
                    rotZ = (parseFloat(e.target.value) || 0) * Math.PI/180;
                });
            }

            if (resetTiltBtn) {
                resetTiltBtn.addEventListener('click', () => {
                    rotZ = earthAxialTilt;
                    if (globeTiltInput) {
                        globeTiltInput.value = 23.5;
                    }
                    
                    // 添加一个重置动画效果
                    const icon = resetTiltBtn.querySelector('i');
                    if (icon) {
                        icon.style.transform = 'rotate(360deg)';
                        setTimeout(() => {
                            icon.style.transform = 'rotate(0deg)';
                        }, 500);
                    }
                });
            }

            if (globeSpeedInput) {
                // Set initial slider value (2.5 corresponds to base speed with multiplier of 1.0)
                globeSpeedInput.value = 2.5;
                
                globeSpeedInput.addEventListener('input', (e) => {
                    const speedValue = parseFloat(e.target.value) || 0;
                    // Map slider value (0-10) to rotation speed (0-2x base speed)
                    rotationSpeed = baseRotationSpeed * (speedValue / 2.5);
                });
            }

            if (terminatorToggle) {
                terminatorToggle.addEventListener('click', () => {
                    showTerminator = !showTerminator;
                    terminatorToggle.textContent = showTerminator ? 'Hide Terminator' : 'Show Terminator';
                });
            }

            if (globeSizeInput) {
                const initialV = parseInt(globeSizeInput.value, 10) || 700;
                applyCanvasSize(initialV);
                globeSizeInput.addEventListener('input', () => {
                    const v = parseInt(globeSizeInput.value, 10) || 700;
                    applyCanvasSize(v);
                    resize();
                });
            }
            
            // 绑定经纬度控制事件
            if (latitudeInput && latitudeSlider) {
                // 初始化值
                latitudeInput.value = lat.toFixed(1);
                latitudeSlider.value = lat.toFixed(1);
                
                // 输入框事件
                latitudeInput.addEventListener('input', (e) => {
                    let value = parseFloat(e.target.value) || 0;
                    // 限制范围
                    value = Math.max(-90, Math.min(90, value));
                    lat = value;
                    latitudeSlider.value = value.toFixed(1);
                    hasLocation = true;
                    updateCoordinateDisplay();

                    // update timezone and broadcast
                    const tzOffset = computeTimezoneOffsetMinutes(lon);
                    window.APP_TIMEZONE_OFFSET_MINUTES = tzOffset;
                    window.dispatchEvent(new CustomEvent('timezoneChanged', { detail: { offsetMinutes: tzOffset } }));
                });
                
                // 滑块事件
                latitudeSlider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value) || 0;
                    lat = value;
                    latitudeInput.value = value.toFixed(1);
                    hasLocation = true;
                    updateCoordinateDisplay();

                    // update timezone and broadcast
                    const tzOffset = computeTimezoneOffsetMinutes(lon);
                    window.APP_TIMEZONE_OFFSET_MINUTES = tzOffset;
                    window.dispatchEvent(new CustomEvent('timezoneChanged', { detail: { offsetMinutes: tzOffset } }));
                });
            }
            
            if (longitudeInput && longitudeSlider) {
                // 初始化值
                longitudeInput.value = lon.toFixed(1);
                longitudeSlider.value = lon.toFixed(1);
                
                // 输入框事件
                longitudeInput.addEventListener('input', (e) => {
                    let value = parseFloat(e.target.value) || 0;
                    // 限制范围
                    value = Math.max(-180, Math.min(180, value));
                    lon = value;
                    longitudeSlider.value = value.toFixed(1);
                    hasLocation = true;
                    updateCoordinateDisplay();

                    // update timezone and broadcast
                    const tzOffset = computeTimezoneOffsetMinutes(lon);
                    window.APP_TIMEZONE_OFFSET_MINUTES = tzOffset;
                    window.dispatchEvent(new CustomEvent('timezoneChanged', { detail: { offsetMinutes: tzOffset } }));
                });
                
                // 滑块事件
                longitudeSlider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value) || 0;
                    lon = value;
                    longitudeInput.value = value.toFixed(1);
                    hasLocation = true;
                    updateCoordinateDisplay();

                    // update timezone and broadcast
                    const tzOffset = computeTimezoneOffsetMinutes(lon);
                    window.APP_TIMEZONE_OFFSET_MINUTES = tzOffset;
                    window.dispatchEvent(new CustomEvent('timezoneChanged', { detail: { offsetMinutes: tzOffset } }));
                });
            }

            // If globe view is hidden/shown we should trigger a resize so canvas stays crisp
            const obsTarget = document.getElementById('globe-view');
            if (obsTarget && window.ResizeObserver) {
                const obs = new ResizeObserver(() => { resize(); });
                obs.observe(obsTarget);
            }

            // Also observe window resize
            window.addEventListener('resize', () => {
                if (globeSizeInput) {
                    applyCanvasSize(parseInt(globeSizeInput.value, 10) || 700);
                }
                resize();
            });

            // Pointer drag for manual rotation (supports mouse and touch via pointer events)
            canvas.addEventListener('pointerdown', (ev) => {
                canvas.setPointerCapture(ev.pointerId);
                isDragging = true;
                lastPointer = { x: ev.clientX, y: ev.clientY };
                // temporarily pause auto-rotation while dragging
            });

            canvas.addEventListener('pointermove', (ev) => {
                if (!isDragging || !lastPointer) return;
                const dx = ev.clientX - lastPointer.x;
                const dy = ev.clientY - lastPointer.y;
                lastPointer = { x: ev.clientX, y: ev.clientY };
                const sens = 0.005; // sensitivity
                rotY += dx * sens;
                rotX += dy * sens;
                // clamp pitch to avoid flipping
                const maxPitch = Math.PI/2 - 0.01;
                if (rotX > maxPitch) rotX = maxPitch;
                if (rotX < -maxPitch) rotX = -maxPitch;
            });

            function endDrag(ev) {
                if (ev && ev.pointerId) canvas.releasePointerCapture(ev.pointerId);
                isDragging = false;
                lastPointer = null;
            }
            canvas.addEventListener('pointerup', endDrag);
            canvas.addEventListener('pointercancel', endDrag);
            canvas.addEventListener('pointerleave', endDrag);
        }
        
        // 更新坐标显示
        function updateCoordinateDisplay() {
            const latEl = document.getElementById('lat-value');
            const lonEl = document.getElementById('lon-value');
            if (latEl) latEl.textContent = lat.toFixed(2);
            if (lonEl) lonEl.textContent = lon.toFixed(2);
            // update timezone label (approximate) if element exists
            const tzEl = document.getElementById('timezone-display');
            if (tzEl) {
                try {
                    const tzOffset = computeTimezoneOffsetMinutes(lon);
                    window.APP_TIMEZONE_OFFSET_MINUTES = tzOffset;
                    const sign = tzOffset >= 0 ? '+' : '-';
                    const abs = Math.abs(tzOffset);
                    const hrs = Math.floor(abs / 60);
                    const mins = abs % 60;
                    const padded = mins.toString().padStart(2, '0');
                    tzEl.textContent = `UTC${sign}${hrs}${mins ? ':' + padded : ':00'}`;
                } catch (e) {
                    tzEl.textContent = 'UTC (unknown)';
                }
            }
        }

        window.refreshGlobeCanvas = () => {
            const globeSizeInput = document.getElementById('globe-size');
            if (globeSizeInput) {
                applyCanvasSize(parseInt(globeSizeInput.value, 10) || 700);
            }
            resize();
        };

        // init
        wireUI();
        window.refreshGlobeCanvas();
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(handleGeoSuccess, handleGeoError, {maximumAge: 600000, timeout: 8000});
        } else {
            handleGeoError();
        }

        requestAnimationFrame(update);
    }

    initWhenReady();
})();
