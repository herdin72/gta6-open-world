// render.js — all drawing: city, cars, people, police, particles, HUD, minimap, menus.
// Top-down camera follows the player; day/night tint shifts with game time.
import { WORLD, COLORS } from './config.js';
import { isRoad, isWater, isBeach, districtAt, roadNameAt } from './world.js';
import { missionTitle } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  }
  resize();
  window.addEventListener('resize', resize);

  function text(str, x, y, size, color, align = 'left', bold = false) {
    ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }
  function drawCarShape(x, y, angle, len, wid, color, police = false) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#111'; ctx.fillRect(-len / 2 - 2, -wid / 2 - 2, len + 4, wid + 4);
    ctx.fillStyle = color; ctx.fillRect(-len / 2, -wid / 2, len, wid);
    ctx.fillStyle = 'rgba(180,220,255,0.85)'; ctx.fillRect(-len * 0.12, -wid / 2 + 3, len * 0.22, wid - 6);
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(len / 2 - 3, -wid / 2 + 2, 3, 6); ctx.fillRect(len / 2 - 3, wid / 2 - 8, 3, 6);
    ctx.fillStyle = '#ff5a4d'; ctx.fillRect(-len / 2, -wid / 2 + 2, 3, 6); ctx.fillRect(-len / 2, wid / 2 - 8, 3, 6);
    if (police) {
      const on = Math.floor(performance.now() / 300) % 2 === 0;
      ctx.fillStyle = on ? '#ff3b30' : '#2f7bff'; ctx.fillRect(-6, -wid / 2 - 1, 12, 5);
      ctx.fillStyle = on ? '#2f7bff' : '#ff3b30'; ctx.fillRect(-6, wid / 2 - 4, 12, 5);
      ctx.fillStyle = '#fff'; ctx.font = `700 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('PBPD', 0, 3);
    }
    ctx.restore();
  }
  function drawPerson(x, y, angle, color, name) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 4, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(Math.cos(angle) * 5, Math.sin(angle) * 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawCity(state, city, cam, zoom) {
    const x0 = cam.x - W / 2 / zoom - 80, y0 = cam.y - H / 2 / zoom - 80;
    const x1 = cam.x + W / 2 / zoom + 80, y1 = cam.y + H / 2 / zoom + 80;
    // Ground
    ctx.fillStyle = COLORS.grass; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Water + beach (west edge)
    ctx.fillStyle = COLORS.water; ctx.fillRect(x0, y0, Math.max(0, WORLD.beach - 60 - x0), y1 - y0);
    ctx.fillStyle = COLORS.sand; ctx.fillRect(WORLD.beach - 60, y0, 60, y1 - y0);
    // Roads
    const pitch = WORLD.block + WORLD.road;
    ctx.fillStyle = COLORS.road;
    for (let i = 0; i * pitch < WORLD.size; i++) {
      ctx.fillRect(i * pitch, y0, WORLD.road, y1 - y0);
      ctx.fillRect(x0, i * pitch, x1 - x0, WORLD.road);
    }
    // Road centre dashes
    ctx.fillStyle = COLORS.roadLine;
    for (let i = 0; i * pitch < WORLD.size; i++) {
      const c = i * pitch + WORLD.road / 2;
      for (let d = 0; d < WORLD.size; d += 60) {
        if (d > y0 && d < y1) ctx.fillRect(c - 2, d, 4, 28);
        if (d > x0 && d < x1) ctx.fillRect(d, c - 2, 28, 4);
      }
    }
    // Parks / plaza blocks are grass already; draw buildings with shadow + roof detail
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let wy = b.y + 24; wy < b.y + b.h - 10; wy += 26) for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 24) ctx.fillRect(wx, wy, 12, 14);
      if (b.w > 110) text(b.name, b.x + b.w / 2, b.y + b.h / 2, 13, 'rgba(255,255,255,0.85)', 'center', true);
    }
    // Trees
    for (const t of city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    // Pickups
    for (const pk of city.pickups) {
      if (pk.taken || pk.x < x0 || pk.x > x1 || pk.y < y0 || pk.y > y1) continue;
      const bob = Math.sin(state.time * 3 + pk.bob) * 3;
      ctx.fillStyle = pk.kind === 'cash' ? '#ffd34d' : pk.kind === 'health' ? '#ff5a6e' : '#7dff8a';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'A', pk.x, pk.y + bob + 4);
    }
    // Mission marker
    if (state.missionObjective) {
      const o = state.missionObjective;
      const pulse = 1 + Math.sin(state.time * 4) * 0.15;
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,211,77,0.25)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(o.x, o.y - o.r - 34); ctx.lineTo(o.x - 10, o.y - o.r - 12); ctx.lineTo(o.x + 10, o.y - o.r - 12); ctx.closePath(); ctx.fill();
    }
    // Safehouse marker
    ctx.fillStyle = '#7dff8a'; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('⌂ SAFEHOUSE', 420, 2200 - 90);
  }

  function drawMinimap(state, city) {
    const S = 168, mx = W - S - 16, my = 16;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,22,0.82)'; ctx.fillRect(mx - 6, my - 6, S + 12, S + 12);
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2; ctx.strokeRect(mx - 6, my - 6, S + 12, S + 12);
    const k = S / WORLD.size;
    ctx.fillStyle = '#2e7d46'; ctx.fillRect(mx, my, S, S);
    ctx.fillStyle = '#1e6f9e'; ctx.fillRect(mx, my, WORLD.beach * k, S);
    ctx.fillStyle = '#2b2f36';
    const pitch = WORLD.block + WORLD.road;
    for (let i = 0; i * pitch < WORLD.size; i++) { ctx.fillRect(mx + i * pitch * k, my, WORLD.road * k, S); ctx.fillRect(mx, my + i * pitch * k, S, WORLD.road * k); }
    ctx.fillStyle = '#c96f4a';
    for (const b of city.buildings) ctx.fillRect(mx + b.x * k, my + b.y * k, Math.max(2, b.w * k), Math.max(2, b.h * k));
    if (state.missionObjective) { ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(mx + state.missionObjective.x * k, my + state.missionObjective.y * k, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#7dff8a'; ctx.fillRect(mx + 420 * k - 3, my + 2200 * k - 3, 6, 6);
    for (const cop of state.police) { ctx.fillStyle = '#4d8dff'; ctx.beginPath(); ctx.arc(mx + cop.x * k, my + cop.y * k, 4, 0, Math.PI * 2); ctx.fill(); }
    // Player arrow
    const px = mx + state.player.x * k, py = my + state.player.y * k;
    ctx.save(); ctx.translate(px, py); ctx.rotate(state.player.angle);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'left';
    ctx.fillText(districtAt(state.player.x, state.player.y) + '  •  ' + roadNameAt(state.player.x, state.player.y), mx, my + S + 22);
    ctx.restore();
  }

  function drawHud(game, missions) {
    const s = game.state;
    // Top-left panel
    ctx.fillStyle = 'rgba(10,14,22,0.78)'; ctx.fillRect(14, 14, 250, 108);
    ctx.strokeStyle = 'rgba(255,211,77,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(14, 14, 250, 108);
    text('PALMERA BAY', 26, 38, 17, '#ffd34d', 'left', true);
    text('$' + s.money.toLocaleString(), 26, 64, 22, '#7dff8a', 'left', true);
    // Health bar
    ctx.fillStyle = '#333'; ctx.fillRect(26, 74, 150, 12);
    ctx.fillStyle = s.health > 50 ? '#4caf50' : s.health > 25 ? '#ff9800' : '#f44336';
    ctx.fillRect(26, 74, 150 * Math.max(0, s.health) / 100, 12);
    text('HP ' + Math.max(0, Math.round(s.health)), 184, 85, 13, '#fff');
    // Wanted stars
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '☆';
    text(stars, 26, 110, 20, '#ffd34d');
    text('Ammo ' + s.ammo, 190, 110, 13, '#fff');
    // Speed / vehicle
    if (!s.player.onFoot && s.player.car) {
      const kmh = Math.round(Math.abs(s.player.car.speed) * 0.36);
      ctx.fillStyle = 'rgba(10,14,22,0.78)'; ctx.fillRect(14, H - 78, 190, 64);
      text(kmh + ' km/h', 26, H - 42, 26, '#fff', 'left', true);
      text(s.player.car.model.name, 26, H - 22, 13, '#ffd34d');
    } else {
      ctx.fillStyle = 'rgba(10,14,22,0.78)'; ctx.fillRect(14, H - 78, 230, 64);
      text('ON FOOT', 26, H - 42, 20, '#fff', 'left', true);
      text('E near a car to steal it  •  F punch  •  Click shoot', 26, H - 22, 12, '#cfd6de');
    }
    // Mission tracker (top centre)
    const mtext = missions.state.text || (missions.state.done.length ? 'Free roam — press M for the next job.' : 'Press M to start your first job with Rosa.');
    ctx.fillStyle = 'rgba(10,14,22,0.78)';
    const mw = Math.min(640, ctx.measureText(mtext).width + 60);
    ctx.fillRect((W - mw) / 2, 14, mw, 52);
    ctx.strokeStyle = 'rgba(255,211,77,0.6)'; ctx.strokeRect((W - mw) / 2, 14, mw, 52);
    text('★ ' + (missions.state.activeId ? missionTitle(missions.state.activeId) : 'PALMERA BAY'), W / 2, 36, 14, '#ffd34d', 'center', true);
    text(mtext.length > 90 ? mtext.slice(0, 90) + '…' : mtext, W / 2, 56, 13, '#fff', 'center');
    // Message toast
    if (s.messageT > 0 && s.message) {
      ctx.fillStyle = 'rgba(10,14,22,0.85)'; ctx.fillRect((W - 520) / 2, H - 140, 520, 40);
      text(s.message, W / 2, H - 113, 15, '#ffe9a8', 'center', true);
    }
    // Controls hint
    text('WASD move/drive  •  Shift run  •  E enter car  •  F punch  •  Click shoot  •  M mission  •  P pause  •  N mute', W / 2, H - 8, 12, 'rgba(255,255,255,0.75)', 'center');
    drawMinimap(s, game.city);
  }

  function drawPanel(title, lines, prompt, accent = '#ffd34d') {
    ctx.fillStyle = 'rgba(5,8,14,0.72)'; ctx.fillRect(0, 0, W, H);
    const w = Math.min(680, W - 40), h = 150 + lines.length * 30;
    const x = (W - w) / 2, y = (H - h) / 2;
    ctx.fillStyle = '#141a26'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    text(title, W / 2, y + 58, 40, accent, 'center', true);
    lines.forEach((ln, i) => text(ln, W / 2, y + 104 + i * 30, 16, '#e8ecf1', 'center'));
    text(prompt, W / 2, y + h - 26, 16, '#ffd34d', 'center', true);
  }

  function draw(game, missions, screen, saveInfo) {
    const s = game.state;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const zoom = s.player.onFoot ? 0.85 : 0.72;
    const cam = { x: s.player.x, y: s.player.y };
    ctx.clearRect(0, 0, W, H);
    if (screen === SCREEN_TITLE) {
      // Backdrop: city from above, centred on downtown
      const fake = { ...s, player: { ...s.player, x: 1300, y: 1300, angle: 0 } };
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.scale(0.55, 0.55); ctx.translate(-1300, -1300);
      drawCity(fake, game.city, { x: 1300, y: 1300 }, 0.55);
      ctx.restore();
      drawPanel('PALMERA BAY', [
        'An original open-world crime game — explore on foot and by car,',
        'steal cars, outrun the PBPD, and run jobs for Rosa and Tito.',
        'Missions: 4 jobs, $2,450 in rewards. Free roam after the story.',
        saveInfo ? `Save found: $${saveInfo.money} • ${saveInfo.missionsDone}/4 jobs done — press C to continue.` : 'No save yet — your progress saves automatically.',
      ], 'Press SPACE to start  •  C continue  •  WASD move, E steal car, click shoot', '#ffd34d');
      text('Danny Cruz is back in town.', W / 2, H - 48, 15, '#ffd34d', 'center');
      return;
    }
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-cam.x, -cam.y);
    drawCity(s, game.city, cam, zoom);
    // Cars
    for (const car of s.cars) drawCarShape(car.x, car.y, car.angle, car.model.len, car.model.wid, car.model.color, car.police);
    // Peds
    for (const ped of s.peds) drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.name);
    // Bullets
    ctx.fillStyle = '#ffe08a';
    for (const b of s.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
    // Particles
    for (const pt of s.particles) { ctx.globalAlpha = Math.max(0, pt.life / pt.max); ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    // Player on foot
    if (s.player.onFoot) {
      drawPerson(s.player.x, s.player.y, s.player.angle, '#ffcf3f', 'Danny');
      // Aim line
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.player.x, s.player.y); ctx.lineTo(s.player.x + Math.cos(s.player.angle) * 34, s.player.y + Math.sin(s.player.angle) * 34); ctx.stroke();
      // Name tag
      text('DANNY', s.player.x, s.player.y - 20, 11, '#fff', 'center', true);
    }
    ctx.restore();
    // Day/night tint
    const t = s.dayTime;
    const night = t > 0.75 || t < 0.15 ? 0.28 : t > 0.6 ? 0.12 : 0;
    if (night > 0) { ctx.fillStyle = `rgba(10,16,60,${night})`; ctx.fillRect(0, 0, W, H); }
    else if (t > 0.45 && t < 0.6) { ctx.fillStyle = 'rgba(255,140,60,0.10)'; ctx.fillRect(0, 0, W, H); }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(game, missions);
    if (screen === SCREEN_PAUSED) drawPanel('PAUSED', ['The city waits for you.', 'Progress is saved automatically.'], 'Press P to resume  •  R restart day', '#7dff8a');
    if (screen === SCREEN_OVER) {
      const reason = s.busted ? 'BUSTED' : 'WASTED';
      drawPanel(reason, [
        s.busted ? 'The PBPD caught you. Bail: $100.' : 'You woke up at the clinic. Bill: $150.',
        `Money: $${s.money}  •  Jobs done: ${s.missionsDone}/4  •  Cars stolen: ${s.carsStolen}`,
        'Palmera Bay is not done with you yet.',
      ], 'Press SPACE to get back on the streets', '#ff5a6e');
    }
    if (screen === SCREEN_WIN) drawPanel('PALMERA BAY IS YOURS', ['All 4 jobs done. $2,450 earned. The marina is free.', `Final money: $${s.money}`], 'Press SPACE for free roam', '#7dff8a');
  }

  return { draw, resize };
}
