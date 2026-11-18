// world.js — Palmera Bay city generation and collision. Pure logic, no drawing, no DOM.
// Grid city: roads every 260px, blocks hold buildings / parks / plaza; beach + water on the west edge.
import { WORLD, BUILDING_COLORS, mulberry32, clamp } from './config.js';

export const ROAD_NAMES = ['Ocean Drive', 'Palm Row', 'Coral Ave', 'Sunset Blvd', 'Marina Way', 'Flamingo St', 'Bayside Rd', 'Neon Lane'];
export const DISTRICTS = ['Oceanfront', 'Downtown', 'Marina District', 'Old Town', 'Palm Heights', 'The Docks'];

export function isRoad(x, y) {
  if (x < 0 || y < 0 || x >= WORLD.size || y >= WORLD.size) return false;
  const pitch = WORLD.block + WORLD.road;
  const mx = x % pitch, my = y % pitch;
  return mx < WORLD.road || my < WORLD.road;
}
export function isWater(x, y) { return x < WORLD.beach - 60; }
export function isBeach(x, y) { return x >= WORLD.beach - 60 && x < WORLD.beach; }
export function districtAt(x, y) {
  const gx = Math.floor(x / 900), gy = Math.floor(y / 900);
  return DISTRICTS[(gx + gy * 2) % DISTRICTS.length];
}
export function roadNameAt(x, y) {
  const pitch = WORLD.block + WORLD.road;
  const ix = Math.floor(x / pitch), iy = Math.floor(y / pitch);
  return ROAD_NAMES[(ix + iy) % ROAD_NAMES.length];
}

export function createCity(seed = 7) {
  const rand = mulberry32(seed);
  const buildings = [], trees = [], lamps = [], pickups = [];
  const pitch = WORLD.block + WORLD.road;
  const blocks = Math.floor(WORLD.size / pitch);
  for (let bx = 0; bx < blocks; bx++) {
    for (let by = 0; by < blocks; by++) {
      const x0 = bx * pitch + WORLD.road, y0 = by * pitch + WORLD.road;
      const kind = rand();
      if (kind < 0.14) { // park
        for (let i = 0; i < 6; i++) trees.push({ x: x0 + 30 + rand() * 200, y: y0 + 30 + rand() * 200, r: 12 + rand() * 10 });
        continue;
      }
      if (kind < 0.2) continue; // empty plaza / parking lot
      const w = 90 + rand() * 90, h = 90 + rand() * 90;
      const bx2 = x0 + (WORLD.block - w) / 2, by2 = y0 + (WORLD.block - h) / 2;
      buildings.push({
        x: bx2, y: by2, w, h, color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)],
        height: 1 + Math.floor(rand() * 3),
        name: (by === 0 ? 'Hotel ' : by % 3 === 0 ? 'Apts ' : 'Offices ') + String.fromCharCode(65 + bx) + (by + 1),
      });
      if (rand() < 0.5) trees.push({ x: x0 + 20 + rand() * 200, y: y0 + 20 + rand() * 200, r: 10 + rand() * 8 });
    }
  }
  // Street lamps along roads
  for (let i = 0; i < WORLD.size; i += 350) {
    lamps.push({ x: WORLD.road / 2, y: i }); lamps.push({ x: i, y: WORLD.road / 2 });
  }
  // Cash / health / ammo pickups scattered on sidewalks
  const pickupKinds = ['cash', 'health', 'ammo', 'cash', 'health'];
  for (let i = 0; i < 70; i++) {
    const x = 120 + rand() * (WORLD.size - 240), y = 120 + rand() * (WORLD.size - 240);
    if (isRoad(x, y) || collidesBuilding(x, y, 10)) continue;
    pickups.push({ x, y, kind: pickupKinds[i % pickupKinds.length], taken: false, bob: rand() * 6 });
  }
  function collidesBuilding(x, y, r) {
    for (const b of buildings) if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    return null;
  }
  function collideCircle(x, y, r) {
    const b = collidesBuilding(x, y, r);
    if (b) return b;
    if (x < WORLD.beach - 50 || x > WORLD.size - 20 || y < 20 || y > WORLD.size - 20) return { wall: true };
    return null;
  }
  // Snap a point to the nearest road centre (for spawning cars / mission markers).
  function nearestRoadPoint(x, y) {
    const pitch2 = WORLD.block + WORLD.road;
    const cx = Math.round((x - WORLD.road / 2) / pitch2) * pitch2 + WORLD.road / 2;
    const cy = Math.round((y - WORLD.road / 2) / pitch2) * pitch2 + WORLD.road / 2;
    return { x: clamp(cx, 100, WORLD.size - 100), y: clamp(cy, 100, WORLD.size - 100) };
  }
  function randomRoadPoint() {
    const rx = WORLD.road / 2 + Math.floor(rand() * blocks) * pitch;
    const ry = WORLD.road / 2 + Math.floor(rand() * blocks) * pitch;
    return Math.random() < 0.5 ? { x: rx, y: 200 + rand() * 2200 } : { x: 200 + rand() * 2200, y: ry };
  }
  return { buildings, trees, lamps, pickups, collidesBuilding, collideCircle, nearestRoadPoint, randomRoadPoint, blocks };
}
