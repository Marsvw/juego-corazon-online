// Stage layouts. Coordinates are world pixels with y pointing down; a
// platform's y is its top surface. Solid platforms block from the sides and
// below, soft ones can be jumped through and dropped through.

export const STAGES = {
  sahur: {
    id: 'sahur',
    name: 'Sahur Village',
    blurb: 'Night market rooftops. The platforms bounce to the drum.',
    blast: { left: -300, right: 1580, top: -260, bottom: 980 },
    platforms: [
      { id: 'main', x: 300, y: 500, w: 680, h: 70, solid: true },
      { id: 'left', x: 380, y: 370, w: 160, h: 14 },
      { id: 'right', x: 740, y: 370, w: 160, h: 14 },
      { id: 'top', x: 560, y: 250, w: 160, h: 14 },
    ],
    spawns: [
      { x: 420, y: 500 },
      { x: 860, y: 500 },
      { x: 560, y: 500 },
      { x: 720, y: 500 },
    ],
    respawn: { x: 640, y: 170 },
  },
};

export const STAGE_LIST = Object.values(STAGES);

// Copies a stage's platforms into match state so stage gimmicks can move them.
export function buildPlatforms(stage) {
  return stage.platforms.map((p) => ({ ...p, solid: !!p.solid, dx: 0, dy: 0, prevX: p.x, prevY: p.y }));
}

// Runs once per frame before fighters move. Records how far each platform
// moved so fighters standing on it get carried along.
export function updateStage(state) {
  for (const p of state.platforms) {
    p.prevX = p.x;
    p.prevY = p.y;
    p.dx = 0;
    p.dy = 0;
  }
}

export function mainPlatform(state) {
  return state.platforms.find((p) => p.solid) || state.platforms[0];
}
