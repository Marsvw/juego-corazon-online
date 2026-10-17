// Character drawings, made from canvas shapes so the prototype needs no image
// files. Each draw function gets a context whose origin is the fighter's feet,
// facing right, and a pose describing what the fighter is doing.

const TAU = Math.PI * 2;

function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function eyes(ctx, p, x1, x2, y, r, look = 1.5) {
  if (p.hurt) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    for (const x of [x1, x2]) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y - r * 0.7);
      ctx.lineTo(x + r * 0.7, y + r * 0.7);
      ctx.moveTo(x + r * 0.7, y - r * 0.7);
      ctx.lineTo(x - r * 0.7, y + r * 0.7);
      ctx.stroke();
    }
    return;
  }
  const blink = p.t % 180 < 6;
  for (const x of [x1, x2]) {
    ctx.fillStyle = '#fff';
    ellipse(ctx, x, y, r, blink ? 1.2 : r);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (!blink) {
      ctx.fillStyle = '#111';
      ellipse(ctx, x + look, y, r * 0.45, r * 0.45);
      ctx.fill();
    }
  }
}

// How a held weapon (bat, trunk, katana...) is angled for the current move.
// Angle 0 points forward, negative points up.
export function weaponAngle(p, rest = -1.2) {
  const t = ease(p.progress);
  switch (p.moveId) {
    case 'jab':
      return lerp(-0.4, 0.3, t);
    case 'sideTilt':
    case 'fair':
    case 'sideSpecial':
      return lerp(-2.2, 0.7, t);
    case 'upTilt':
    case 'upAir':
      return lerp(0.6, -2.6, t);
    case 'downTilt':
      return lerp(0.2, 1.3, t);
    case 'downAir':
      return lerp(-1.2, 1.9, t);
    case 'nair':
      return p.progress * TAU * 1.5;
    case 'neutralSpecial':
      return p.progress < 0.4 ? lerp(-0.8, -2.9, ease(p.progress / 0.4)) : lerp(-2.9, 0.8, ease(Math.min(1, (p.progress - 0.4) / 0.2)));
    case 'upSpecial':
      return -1.6;
    case 'downSpecial':
    case 'downSpecialAir':
      return p.progress < 0.35 ? -1.8 : 1.4;
    default:
      return rest;
  }
}

function legs(ctx, p, xs, top, color, shoe, len = 18) {
  const run = p.running ? Math.sin(p.t * 0.45) : 0;
  xs.forEach((x, i) => {
    const swing = (i % 2 ? 1 : -1) * run * 7 + (p.air ? (i - (xs.length - 1) / 2) * 3 : 0);
    const footY = p.air ? -4 : 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + swing, footY - 6);
    ctx.stroke();
    if (shoe) shoe(x + swing, footY);
  });
  return len;
}

// ---------------------------------------------------------------------------

function drawTralalero(ctx, p, c) {
  const sneaker = (x, y) => {
    ctx.fillStyle = '#fff';
    rr(ctx, x - 7, y - 9, 18, 9, 4);
    ctx.fill();
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 4);
    ctx.quadraticCurveTo(x + 3, y - 2, x + 9, y - 7);
    ctx.lineTo(x + 2, y - 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(x - 7, y - 2, 18, 2);
  };
  legs(ctx, p, [-14, 0, 14], -28, c.dark, sneaker);

  const bob = p.running ? Math.abs(Math.sin(p.t * 0.45)) * 3 : Math.sin(p.t * 0.08) * 1.2;
  ctx.save();
  ctx.translate(0, -bob);

  // Tail
  const wag = Math.sin(p.t * 0.25) * 0.25;
  ctx.save();
  ctx.translate(-30, -50);
  ctx.rotate(wag);
  ctx.fillStyle = c.main;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(-22, -22);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-22, 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Body
  ctx.fillStyle = c.main;
  ellipse(ctx, 0, -50, 36, 25);
  ctx.fill();
  ctx.fillStyle = c.light;
  ellipse(ctx, 4, -40, 28, 13);
  ctx.fill();

  // Dorsal fin and side fin
  ctx.fillStyle = c.dark;
  ctx.beginPath();
  ctx.moveTo(-10, -72);
  ctx.lineTo(0, -96);
  ctx.lineTo(12, -72);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-2, -44);
  ctx.lineTo(-16, -30);
  ctx.lineTo(6, -38);
  ctx.closePath();
  ctx.fill();

  // Gills
  ctx.strokeStyle = c.dark;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(10 + i * 5, -52, 6, -0.9, 0.9);
    ctx.stroke();
  }

  // Mouth: opens wide for the chomp.
  const chomp = p.moveId === 'neutralSpecial' ? Math.sin(Math.min(1, p.progress * 2.2) * Math.PI) : 0;
  const open = 3 + chomp * 12;
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.moveTo(14, -44);
  ctx.quadraticCurveTo(28, -44 + open, 36, -46);
  ctx.quadraticCurveTo(28, -44 - open * 0.3, 14, -44);
  ctx.fill();
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) {
    const x = 17 + i * 4.5;
    ctx.beginPath();
    ctx.moveTo(x, -45);
    ctx.lineTo(x + 2, -41 + chomp * 3);
    ctx.lineTo(x + 4, -45);
    ctx.fill();
  }

  eyes(ctx, p, 18, 26, -58, 4.5, 1.5);
  ctx.restore();
}

function drawTungTung(ctx, p, c) {
  legs(ctx, p, [-9, 9], -14, c.dark, (x, y) => {
    ctx.fillStyle = c.dark;
    rr(ctx, x - 6, y - 6, 13, 6, 3);
    ctx.fill();
  });

  const bob = p.running ? Math.abs(Math.sin(p.t * 0.45)) * 2.5 : 0;
  ctx.save();
  ctx.translate(0, -bob);

  // Back arm
  ctx.strokeStyle = c.dark;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-16, -54);
  ctx.lineTo(-24, -36);
  ctx.stroke();

  // Log body with grain
  ctx.fillStyle = c.main;
  rr(ctx, -21, -98, 42, 86, 16);
  ctx.fill();
  ctx.strokeStyle = c.dark;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80, 45, 15, 0.45)';
  ctx.lineWidth = 1.5;
  for (const [x, y1, y2] of [[-13, -88, -30], [-4, -94, -60], [13, -84, -22], [-8, -44, -16]]) {
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.bezierCurveTo(x + 3, y1 + 12, x - 3, y2 - 12, x, y2);
    ctx.stroke();
  }
  // Top rings
  ctx.fillStyle = c.light;
  ellipse(ctx, 0, -94, 15, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(122, 79, 39, 0.6)';
  ellipse(ctx, 0, -94, 8, 2);
  ctx.stroke();

  // Face
  eyes(ctx, p, -6, 10, -72, 7, 2);
  ctx.strokeStyle = '#2b1606';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-14, -84);
  ctx.lineTo(-1, -81);
  ctx.moveTo(5, -81);
  ctx.lineTo(17, -84);
  ctx.stroke();
  ctx.fillStyle = '#2b1606';
  ctx.beginPath();
  if (p.hurt) ellipse(ctx, 3, -55, 5, 6);
  else ctx.arc(3, -58, 9, 0.15, Math.PI - 0.15);
  ctx.fill();

  // Front arm and bat
  const ang = weaponAngle(p, -1.25);
  const sx = 12;
  const sy = -54;
  const hx = sx + Math.cos(ang) * 16;
  const hy = sy + Math.sin(ang) * 16;
  ctx.strokeStyle = c.dark;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ang);
  ctx.fillStyle = '#e8c48a';
  ctx.strokeStyle = '#8a6232';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, -3);
  ctx.lineTo(18, -4);
  ctx.quadraticCurveTo(60, -9, 64, 0);
  ctx.quadraticCurveTo(60, 9, 18, 4);
  ctx.lineTo(-4, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5b3a1a';
  ctx.fillRect(-5, -3.5, 8, 7);
  ctx.restore();

  ctx.restore();
}

export const ART = {
  tralalero: drawTralalero,
  tungtung: drawTungTung,
};

export function drawCharacter(ctx, charId, pose, colors) {
  const fn = ART[charId];
  if (fn) fn(ctx, pose, colors);
}

// Draws a character standing still, centred in a w x h box. Used for menus.
export function drawPortrait(ctx, fighter, w, h, t = 0, flip = false) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  const scale = Math.min(w, h) / 120;
  ctx.translate(w / 2, h * 0.88);
  ctx.scale(flip ? -scale : scale, scale);
  drawCharacter(ctx, fighter.id, { t, progress: 0, moveId: null, running: false, air: false, hurt: false }, fighter.colors);
  ctx.restore();
}
