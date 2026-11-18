// config.js — tuning, palette and story constants for Palmera Bay.
// Original city, characters and story. Nothing here comes from any commercial game.
export const WORLD = { size: 2600, block: 260, road: 90, beach: 180 };
export const COLORS = {
  grass: '#3f8f4f', grass2: '#357f45', road: '#2b2f36', roadLine: '#e8d44d',
  sidewalk: '#8d9299', water: '#1e6f9e', sand: '#e0c98f', park: '#2e7d46', plaza: '#9aa0a8',
};
export const BUILDING_COLORS = ['#c96f4a', '#4a7fb5', '#b5a04a', '#7a5aa0', '#4aa08a', '#a04a6e', '#5a8a4a', '#b57a4a'];
export const PLAYER = { walkSpeed: 210, runSpeed: 330, health: 100, punchDamage: 12, bulletDamage: 34 };
export const CAR = { accel: 420, brake: 700, maxSpeed: 560, reverseMax: 180, turn: 2.9 };
export const POLICE = { chaseSpeed: 520, arrestRange: 46, spawnDelay: 2.2 };
export const MISSION_LIST = [
  { id: 1, title: 'First Wheels', giver: 'Rosa', reward: 250 },
  { id: 2, title: 'The Rosa Run', giver: 'Rosa', reward: 400 },
  { id: 3, title: 'Heat on Ocean Drive', giver: 'Tito', reward: 600 },
  { id: 4, title: 'The Marina Score', giver: 'Tito', reward: 1200 },
];
export const STORY = {
  city: 'Palmera Bay',
  hero: 'Danny Cruz',
  intro: 'Danny Cruz is back in Palmera Bay with $40 and a busted scooter. Rosa runs a taco truck on Ocean Drive and Tito runs the marina. Do jobs, stay alive, get rich.',
};
export const SAVE_KEY = 'palmera-bay-save-v1';
export const STEP = 1 / 60;
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
