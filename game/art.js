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

function drawBombardiro(ctx, p, c) {
  // Landing gear
  const roll = p.running ? p.t * 0.5 : 0;
  for (const x of [-16, 14]) {
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, -26);
    ctx.lineTo(x, -10);
    ctx.stroke();
    if (!p.air) {
      ctx.fillStyle = '#111827';
      ellipse(ctx, x, -8, 8, 8);
      ctx.fill();
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(roll) * 5, -8 + Math.sin(roll) * 5);
      ctx.lineTo(x - Math.cos(roll) * 5, -8 - Math.sin(roll) * 5);
      ctx.stroke();
    }
  }

  const tilt = p.moveId === 'downSpecial' && p.progress > 0.2 ? 0.6 : p.moveId === 'upSpecial' ? -0.7 : p.air ? Math.sin(p.t * 0.1) * 0.05 : 0;
  ctx.save();
  ctx.translate(0, -40);
  ctx.rotate(tilt);

  // Tail fin and stabiliser
  ctx.fillStyle = c.plane;
  ctx.beginPath();
  ctx.moveTo(-34, -4);
  ctx.lineTo(-50, -30);
  ctx.lineTo(-40, -30);
  ctx.lineTo(-22, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4b5563';
  rr(ctx, -52, -4, 22, 6, 3);
  ctx.fill();

  // Fuselage
  ctx.fillStyle = c.plane;
  ellipse(ctx, -6, 0, 40, 15);
  ctx.fill();
  ctx.fillStyle = '#9ca3af';
  ellipse(ctx, -8, 5, 32, 6);
  ctx.fill();
  // Star insignia
  ctx.fillStyle = '#e5e7eb';
  ellipse(ctx, -22, -2, 6, 6);
  ctx.fill();

  // Bomb hanging underneath while dropping one
  if (p.moveId && p.moveId.startsWith('neutralSpecial') && p.progress < 0.35) {
    ctx.fillStyle = '#1f2937';
    ellipse(ctx, 4, 16, 10, 7);
    ctx.fill();
  }

  // Wing with spinning propeller
  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.lineTo(10, 2);
  ctx.lineTo(-2, 20);
  ctx.lineTo(-24, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#374151';
  ellipse(ctx, 8, 4, 6, 4);
  ctx.fill();
  const spin = Math.abs(Math.sin(p.t * 0.9));
  ctx.fillStyle = 'rgba(229, 231, 235, 0.55)';
  ellipse(ctx, 14, 4, 2.5, 4 + spin * 10);
  ctx.fill();

  // Crocodile head on the nose
  ctx.fillStyle = c.main;
  ellipse(ctx, 26, -6, 15, 12);
  ctx.fill();
  rr(ctx, 26, -12, 34, 12, 5);
  ctx.fill();
  ctx.fillStyle = c.dark;
  rr(ctx, 30, -2, 30, 7, 4);
  ctx.fill();
  // Teeth
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) {
    const x = 32 + i * 5.5;
    ctx.beginPath();
    ctx.moveTo(x, -1);
    ctx.lineTo(x + 2.5, 3);
    ctx.lineTo(x + 5, -1);
    ctx.fill();
  }
  // Nostrils and bumpy back
  ctx.fillStyle = c.dark;
  ellipse(ctx, 56, -11, 2, 1.5);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ellipse(ctx, 16 + i * 7, -17, 3, 2);
    ctx.fill();
  }
  // Eye bump
  ctx.fillStyle = c.main;
  ellipse(ctx, 26, -18, 7, 6);
  ctx.fill();
  eyes(ctx, p, 25, 25, -19, 4.2, 1.2);
  // Pilot goggles strap
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, -16);
  ctx.lineTo(22, -21);
  ctx.stroke();

  ctx.restore();
}

function drawBallerina(ctx, p, c) {
  const skin = '#f5d0b5';
  const spin = p.moveId === 'neutralSpecial';
  const run = p.running ? Math.sin(p.t * 0.45) : 0;

  // Legs, one up on pointe when idle
  ctx.strokeStyle = skin;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  const kick = p.moveId === 'downSpecial' && p.progress > 0.4 ? 1 : p.moveId === 'fair' || p.moveId === 'sideTilt' ? Math.sin(p.progress * Math.PI) : 0;
  const legs2 = [
    [-5, -36, -6 + run * 6, 0],
    [5, -36, 6 - run * 6 + kick * 26, p.air ? -10 : -kick * 22],
  ];
  for (const [x1, y1, x2, y2] of legs2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillStyle = c.dark;
    ellipse(ctx, x2 + 1, y2 - 1, 4, 2.5);
    ctx.fill();
  }

  // Tutu
  ctx.fillStyle = c.main;
  ctx.beginPath();
  const frill = spin ? p.t * 0.6 : 0;
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * TAU;
    const r = 26 + (i % 2 ? 4 : 0) + Math.sin(frill + i) * (spin ? 3 : 0);
    ctx.lineTo(Math.cos(a) * r, -38 + Math.sin(a) * r * 0.28);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.light;
  ellipse(ctx, 0, -40, 18, 3.5);
  ctx.fill();

  // Leotard torso
  ctx.fillStyle = c.dark;
  rr(ctx, -7, -58, 14, 20, 5);
  ctx.fill();

  // Arms in a ballet curve; stretch out to strike.
  ctx.strokeStyle = skin;
  ctx.lineWidth = 3.5;
  const reach = p.moveId === 'jab' || p.moveId === 'sideTilt' ? Math.sin(p.progress * Math.PI) : 0;
  ctx.beginPath();
  ctx.moveTo(6, -55);
  if (reach > 0.1) ctx.lineTo(16 + reach * 20, -54);
  else ctx.quadraticCurveTo(22, -70, 6, -94);
  ctx.moveTo(-6, -55);
  ctx.quadraticCurveTo(-22, -70, -6, -94);
  ctx.stroke();

  // Cappuccino cup head
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(-17, -84);
  ctx.lineTo(17, -84);
  ctx.lineTo(13, -60);
  ctx.lineTo(-13, -60);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(-18, -72, 6, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  // Foam with latte heart
  ctx.fillStyle = c.accent;
  ellipse(ctx, 0, -84, 17, 5);
  ctx.fill();
  ctx.fillStyle = '#fff7ed';
  ctx.beginPath();
  ctx.moveTo(0, -81);
  ctx.bezierCurveTo(-7, -84, -4, -89, 0, -86);
  ctx.bezierCurveTo(4, -89, 7, -84, 0, -81);
  ctx.fill();
  // Face
  eyes(ctx, p, -3, 7, -75, 3.5, 1);
  ctx.fillStyle = 'rgba(244, 114, 182, 0.5)';
  ellipse(ctx, -7, -68, 3, 2);
  ctx.fill();
  ellipse(ctx, 11, -68, 3, 2);
  ctx.fill();
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(2, -68, 3, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function drawPatapim(ctx, p, c) {
  const skin = '#d9a679';
  const run = p.running ? Math.sin(p.t * 0.4) : 0;
  const stomp = p.moveId === 'sideSpecial' ? Math.sin(Math.min(1, p.progress * 1.6) * Math.PI) : 0;

  // Huge feet
  for (const [i, x] of [-14, 14].entries()) {
    const lift = (i ? -run : run) * 4 + (i ? stomp * 18 : 0);
    const fx = x + (i ? stomp * 26 : 0);
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x * 0.6, -26);
    ctx.lineTo(fx, -8 - Math.max(0, lift));
    ctx.stroke();
    ctx.fillStyle = skin;
    ellipse(ctx, fx + 5, -6 - Math.max(0, lift), 16, 7);
    ctx.fill();
    ctx.fillStyle = '#c48a5c';
    for (let t = 0; t < 4; t++) {
      ellipse(ctx, fx + 15 + (t % 2), -9 + t * 2 - Math.max(0, lift), 3, 2.2);
      ctx.fill();
    }
  }

  // Trunk body
  ctx.fillStyle = c.main;
  rr(ctx, -22, -76, 44, 54, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 35, 15, 0.5)';
  ctx.lineWidth = 2;
  for (const x of [-12, 0, 12]) {
    ctx.beginPath();
    ctx.moveTo(x, -70);
    ctx.bezierCurveTo(x - 3, -55, x + 3, -40, x, -26);
    ctx.stroke();
  }

  // Long monkey arms
  const grab = p.moveId === 'neutralSpecial' ? Math.sin(Math.min(1, p.progress * 2.5) * Math.PI) : 0;
  const swing = p.moveId === 'upSpecial' ? 1 : 0;
  ctx.strokeStyle = c.dark;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(14, -58);
  if (grab > 0.1) ctx.lineTo(28 + grab * 32, -46);
  else if (swing) ctx.lineTo(20, -100);
  else ctx.quadraticCurveTo(30, -44, 22, -24 + run * 3);
  ctx.moveTo(-14, -58);
  ctx.quadraticCurveTo(-30, -44, -22, -24 - run * 3);
  ctx.stroke();
  if (grab > 0.1) {
    ctx.fillStyle = skin;
    ellipse(ctx, 30 + grab * 32, -46, 7, 7);
    ctx.fill();
  }
  if (swing) {
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, -100);
    ctx.lineTo(16, -220);
    ctx.stroke();
  }

  // Face with a long nose
  eyes(ctx, p, 2, 13, -66, 4, 1.5);
  ctx.fillStyle = '#e8a0a0';
  ellipse(ctx, 22, -56, 13, 6, 0.15);
  ctx.fill();
  ctx.strokeStyle = '#3b2412';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(8, -46, 5, 0.3, Math.PI - 0.3);
  ctx.stroke();

  // Leafy crown
  ctx.fillStyle = c.light;
  for (const [x, y, r] of [[-14, -78, 10], [-2, -84, 12], [12, -80, 10], [4, -74, 8], [-20, -70, 7]]) {
    ellipse(ctx, x, y + Math.sin(p.t * 0.05 + x) * 0.8, r, r * 0.8);
    ctx.fill();
  }
  ctx.fillStyle = '#4ade80';
  ellipse(ctx, -4, -86, 6, 4);
  ctx.fill();

  // Frosty breath for the "brr brr" move
  if (p.moveId === 'downSpecial' && p.progress > 0.25 && p.progress < 0.5) {
    ctx.fillStyle = 'rgba(165, 243, 252, 0.5)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + p.t * 0.2;
      ellipse(ctx, Math.cos(a) * 60, -46 + Math.sin(a) * 36, 10, 10);
      ctx.fill();
    }
  }
}

function drawChimpanzini(ctx, p, c) {
  const fur = c.fur;
  legs(ctx, p, [-7, 7], -18, fur, (x, y) => {
    ctx.fillStyle = '#4a2c17';
    ellipse(ctx, x + 2, y - 3, 6, 3);
    ctx.fill();
  });

  const bob = p.running ? Math.abs(Math.sin(p.t * 0.45)) * 3 : 0;
  ctx.save();
  ctx.translate(0, -bob);

  // Peel flaps hanging around the waist
  ctx.fillStyle = c.main;
  ctx.strokeStyle = c.dark;
  ctx.lineWidth = 1.5;
  const flap = Math.sin(p.t * 0.2) * 3;
  for (const [x, dir] of [[-14, -1], [0, 0], [14, 1]]) {
    ctx.beginPath();
    ctx.moveTo(x - 7, -40);
    ctx.quadraticCurveTo(x + dir * 18, -30 + flap, x + dir * 14 - 2, -14 + flap);
    ctx.quadraticCurveTo(x + dir * 6, -24, x + 7, -40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Banana body
  ctx.fillStyle = c.main;
  ctx.beginPath();
  ctx.moveTo(-14, -18);
  ctx.bezierCurveTo(-22, -46, -12, -66, 2, -70);
  ctx.bezierCurveTo(16, -66, 20, -44, 14, -18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = c.dark;
  ctx.stroke();
  ctx.fillStyle = c.light;
  ellipse(ctx, 4, -44, 6, 18);
  ctx.fill();
  ctx.fillStyle = '#3f2a14';
  rr(ctx, -3, -20, 8, 5, 2);
  ctx.fill();

  // Arms
  ctx.strokeStyle = fur;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  const throwing = p.moveId === 'neutralSpecial' ? Math.sin(Math.min(1, p.progress * 1.8) * Math.PI) : 0;
  const punch = p.moveId === 'jab' || p.moveId === 'sideTilt' ? Math.sin(p.progress * Math.PI) : 0;
  ctx.beginPath();
  ctx.moveTo(12, -48);
  if (throwing > 0.1) ctx.lineTo(16 - throwing * 6, -78);
  else ctx.lineTo(24 + punch * 18, -40 - punch * 4);
  ctx.moveTo(-12, -48);
  ctx.lineTo(-22, -36 + Math.sin(p.t * 0.3) * 2);
  ctx.stroke();
  if (throwing > 0.1 && p.progress < 0.35) {
    ctx.fillStyle = c.main;
    ellipse(ctx, 12, -84, 9, 5, -0.6);
    ctx.fill();
  }

  // Chimp head
  ctx.fillStyle = fur;
  ellipse(ctx, 2, -76, 15, 14);
  ctx.fill();
  ellipse(ctx, -12, -76, 5, 6);
  ctx.fill();
  ellipse(ctx, 16, -76, 5, 6);
  ctx.fill();
  ctx.fillStyle = '#e8c39e';
  ellipse(ctx, 5, -72, 10, 9);
  ctx.fill();
  eyes(ctx, p, 1, 9, -78, 3.3, 1.2);
  ctx.strokeStyle = '#4a2c17';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(5, -69, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawLirili(ctx, p, c) {
  const cactus = c.cactus;
  // Elephant legs in sandals
  legs(ctx, p, [-10, 10], -18, c.main, (x, y) => {
    ctx.fillStyle = '#92400e';
    rr(ctx, x - 8, y - 3, 18, 3, 1.5);
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 3);
    ctx.lineTo(x + 2, y - 8);
    ctx.lineTo(x + 7, y - 3);
    ctx.stroke();
  });

  // Cactus body with an arm
  ctx.fillStyle = cactus;
  rr(ctx, -17, -60, 34, 46, 14);
  ctx.fill();
  rr(ctx, -30, -56, 10, 26, 5);
  ctx.fill();
  rr(ctx, -30, -38, 18, 9, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 70, 20, 0.6)';
  ctx.lineWidth = 2;
  for (const x of [-8, 0, 8]) {
    ctx.beginPath();
    ctx.moveTo(x, -56);
    ctx.lineTo(x, -18);
    ctx.stroke();
  }
  ctx.strokeStyle = '#f7fee7';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) {
    const x = -15 + (i % 5) * 7.5;
    const y = -52 + Math.floor(i / 5) * 18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y - 3);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3, y - 3);
    ctx.stroke();
  }

  // Elephant head
  ctx.fillStyle = c.dark;
  ellipse(ctx, -8, -72, 13, 16, -0.2);
  ctx.fill();
  ctx.fillStyle = c.main;
  ellipse(ctx, 6, -74, 18, 16);
  ctx.fill();
  ctx.fillStyle = '#f9a8d4';
  ellipse(ctx, -8, -72, 7, 10, -0.2);
  ctx.fill();

  // Trunk: swings for attacks
  const ang = p.moveId ? weaponAngle(p, 0.9) : 0.9 + Math.sin(p.t * 0.06) * 0.15;
  const len = p.moveId === 'sideSpecial' ? 30 + Math.sin(p.progress * Math.PI) * 60 : 30;
  ctx.strokeStyle = c.main;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(20, -70);
  ctx.quadraticCurveTo(20 + Math.cos(ang - 0.5) * len * 0.6, -70 + Math.sin(ang - 0.5) * len * 0.6, 20 + Math.cos(ang) * len, -70 + Math.sin(ang) * len);
  ctx.stroke();

  // Tusk and eye
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(16, -64);
  ctx.quadraticCurveTo(22, -58, 26, -62);
  ctx.stroke();
  eyes(ctx, p, 10, 10, -80, 4, 1.2);

  // Pocket watch for the time freeze
  if (p.moveId === 'downSpecial') {
    ctx.fillStyle = '#facc15';
    ellipse(ctx, 34, -50, 10, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ellipse(ctx, 34, -50, 7.5, 7.5);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(34, -50);
    ctx.lineTo(34 + Math.cos(p.t * 0.2) * 6, -50 + Math.sin(p.t * 0.2) * 6);
    ctx.stroke();
  }
}

function drawAssassino(ctx, p, c) {
  legs(ctx, p, [-7, 7], -18, c.dark, (x, y) => {
    ctx.fillStyle = c.dark;
    ellipse(ctx, x + 2, y - 3, 6, 3);
    ctx.fill();
  });

  // Katana on the back
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-20, -30);
  ctx.lineTo(-4, -86);
  ctx.stroke();

  // Cup body
  ctx.fillStyle = c.main;
  ctx.beginPath();
  ctx.moveTo(-18, -78);
  ctx.lineTo(18, -78);
  ctx.lineTo(15, -20);
  ctx.quadraticCurveTo(0, -14, -15, -20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d6d3d1';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = c.main;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(-19, -50, 9, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  // Coffee top
  ctx.fillStyle = '#4a2c1a';
  ellipse(ctx, 0, -78, 18, 5);
  ctx.fill();
  ctx.fillStyle = c.light;
  ellipse(ctx, -3, -79, 8, 2.2);
  ctx.fill();

  // Ninja mask band and fluttering tails
  ctx.fillStyle = c.dark;
  ctx.fillRect(-18, -66, 36, 12);
  const flutter = Math.sin(p.t * 0.35) * 4;
  ctx.beginPath();
  ctx.moveTo(-17, -62);
  ctx.quadraticCurveTo(-30, -66 + flutter, -38, -58 + flutter);
  ctx.lineTo(-36, -54 + flutter);
  ctx.quadraticCurveTo(-28, -60, -17, -57);
  ctx.fill();
  if (!p.hurt) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -61);
    ctx.lineTo(8, -63);
    ctx.lineTo(7, -58);
    ctx.closePath();
    ctx.moveTo(10, -63);
    ctx.lineTo(16, -61);
    ctx.lineTo(11, -58);
    ctx.closePath();
    ctx.fill();
  } else {
    eyes(ctx, p, 4, 13, -60, 3, 0);
  }

  // Arm with katana
  const stance = p.moveId === 'downSpecial';
  const ang = stance ? -0.3 : weaponAngle(p, -0.9);
  const sx = 10;
  const sy = -46;
  const hx = sx + Math.cos(ang) * 14;
  const hy = sy + Math.sin(ang) * 14;
  ctx.strokeStyle = c.dark;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(stance ? Math.PI - 0.3 : ang);
  ctx.fillStyle = '#111827';
  ctx.fillRect(-4, -2.5, 12, 5);
  ctx.fillStyle = '#a16207';
  ctx.fillRect(7, -4, 3, 8);
  const blade = ctx.createLinearGradient(10, 0, 56, 0);
  blade.addColorStop(0, '#e5e7eb');
  blade.addColorStop(1, '#ffffff');
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(10, -2.5);
  ctx.lineTo(54, -1.5);
  ctx.lineTo(58, 1.5);
  ctx.lineTo(10, 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Counter stance glint
  if (stance && p.progress < 0.6) {
    const g = 0.5 + 0.5 * Math.sin(p.t * 0.6);
    ctx.fillStyle = `rgba(196, 181, 253, ${0.4 + g * 0.5})`;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const r = i % 2 ? 4 : 12;
      ctx.lineTo(-14 + Math.cos(a) * r, -50 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
}

export const ART = {
  tralalero: drawTralalero,
  tungtung: drawTungTung,
  bombardiro: drawBombardiro,
  ballerina: drawBallerina,
  patapim: drawPatapim,
  chimpanzini: drawChimpanzini,
  lirili: drawLirili,
  assassino: drawAssassino,
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
