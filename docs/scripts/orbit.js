(function(){
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  // Resize for DPR
  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.min(100);
    const h = Math.min(100);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const centralRadius = 25;
  const satelliteRadius =10;
  const orbitA = 40; // semi-major
  const orbitB = 20; // semi-minor
  const orbitSpeed = 4;      // radians/sec
  const yawSpeed = 0;        // major axis rotation
  const pitchSpeed = 3;      // tilt oscillation
  const rollSpeed = .021;      // added roll rotation

  const centralColor = { base:'#04294c', mid:'#0d4b80', rim:'#032037' };
  const satColor     = { base:'#073067', mid:'#1a67a6', rim:'#021a2f' };

  function sphereGradient(ctx, x, y, r, color) {
    const lx = x - r * 0.35;
    const ly = y - r * 0.35;
    const grad = ctx.createRadialGradient(lx, ly, r * 0.08, x, y, r);
    grad.addColorStop(0, color.mid);
    grad.addColorStop(0.6, color.base);
    grad.addColorStop(1, color.rim);
    return grad;
  }

  function softShadow(ctx, x, y, r, intensity=0.45) {
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.22 * intensity})`;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.9, r * 1.35, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function project3D(x, y, z, cx, cy, scale=1) {
    const perspective = 500 / (500 - z);
    return {
      x: cx + x * perspective * scale,
      y: cy + y * perspective * scale,
      scale: perspective
    };
  }

  let paused = false;
  let last = performance.now() / 1000;
  let theta = 0;
  let yaw = 0;
  let pitchPhase = 0;
  let roll = 0;

  function step(nowMs) {
  const now = nowMs / 1000;
  const dt = Math.min(0.033, now - last);
  last = now;

  if (!paused) {
    theta += orbitSpeed * dt;
    yaw += yawSpeed * dt;
    pitchPhase += pitchSpeed * dt;
    roll += rollSpeed * dt;
  }

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cx = w / 2;
  const cy = h / 2;
  ctx.clearRect(0, 0, w, h);

  // Pitch oscillates between -25° and 25°
  const pitch = Math.sin(pitchPhase) * (Math.PI / 7);

  // --- Calculate all orbit points with full rotation ---
  const orbitPoints = [];
  const steps = 100;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;

    let x = orbitA * Math.cos(angle);
    let y = 0;
    let z = orbitB * Math.sin(angle);

    // Roll rotation (Z-axis)
    let x1 = x * Math.cos(roll) - y * Math.sin(roll);
    let y1 = x * Math.sin(roll) + y * Math.cos(roll);
    let z1 = z;

    // Pitch rotation (X-axis)
    let x2 = x1;
    let y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch);
    let z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch);

    // Yaw rotation (Y-axis)
    let x3 = x2 * Math.cos(yaw) + z2 * Math.sin(yaw);
    let y3 = y2;
    let z3 = -x2 * Math.sin(yaw) + z2 * Math.cos(yaw);

    // Project 2D point
    const p = project3D(x3, y3, z3, cx, cy);

    orbitPoints.push({ x3, y3, z3, px: p.x, py: p.y });
  }

  // Helper to draw path from points array
  function drawPath(points) {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      if (i === 0) ctx.moveTo(points[i].px, points[i].py);
      else ctx.lineTo(points[i].px, points[i].py);
    }
   // ctx.stroke();
  }

  // Draw behind points first
  //ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;

  const behindPoints = orbitPoints.filter(p => p.z3 <= 0);
  if (behindPoints.length) drawPath(behindPoints);

  //ctx.restore();

  // --- Calculate satellite position with same rotations ---

  let x = orbitA * Math.cos(theta);
  let y = 0;
  let z = orbitB * Math.sin(theta);

  // Roll rotation (Z-axis)
  let x1 = x * Math.cos(roll) - y * Math.sin(roll);
  let y1 = x * Math.sin(roll) + y * Math.cos(roll);
  let z1 = z;

  // Pitch rotation (X-axis)
  let x2 = x1;
  let y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch);
  let z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch);

  // Yaw rotation (Y-axis)
  let x3 = x2 * Math.cos(yaw) + z2 * Math.sin(yaw);
  let y3 = y2;
  let z3 = -x2 * Math.sin(yaw) + z2 * Math.cos(yaw);

  // Project satellite position
  const satPos = project3D(x3, y3, z3, cx, cy);

  // Central sphere always at (0,0,0)
  const centralPos = project3D(0, 0, 0, cx, cy);

  // Draw central sphere here (between behind and front path)
 

  // Draw satellite based on depth order
  const satelliteBehind = z3 > 0;

  if (satelliteBehind) {
    // Satellite behind central sphere
    softShadow(ctx, satPos.x, satPos.y, satelliteRadius * satPos.scale, 0.9);
    ctx.beginPath();
    ctx.arc(satPos.x, satPos.y, satelliteRadius * satPos.scale, 0, Math.PI * 2);
    ctx.fillStyle = sphereGradient(ctx, satPos.x, satPos.y, satelliteRadius * satPos.scale, satColor);
    ctx.fill();
  }
 softShadow(ctx, centralPos.x, centralPos.y, centralRadius, 1.0);
  ctx.beginPath();
  ctx.arc(centralPos.x, centralPos.y, centralRadius, 0, Math.PI * 2);
  ctx.fillStyle = sphereGradient(ctx, centralPos.x, centralPos.y, centralRadius, centralColor);
  ctx.fill();

  // Draw front points path over sphere
  //ctx.save();
 // ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  //ctx.lineWidth = 1;

  const frontPoints = orbitPoints.filter(p => p.z3 > 0);
  if (frontPoints.length) drawPath(frontPoints);

  ctx.restore();
  if (!satelliteBehind) {
    // Satellite in front of central sphere
    softShadow(ctx, satPos.x, satPos.y, satelliteRadius * satPos.scale, 0.9);
    ctx.beginPath();
    ctx.arc(satPos.x, satPos.y, satelliteRadius * satPos.scale, 0, Math.PI * 2);
    ctx.fillStyle = sphereGradient(ctx, satPos.x, satPos.y, satelliteRadius * satPos.scale, satColor);
    ctx.fill();
  }

  requestAnimationFrame(step);
}

  requestAnimationFrame(step);

  document.getElementById('toggle').addEventListener('click', e => {
    e.preventDefault();
    paused = !paused;
    e.target.textContent = paused ? 'Resume' : 'Pause';
  });
})();
