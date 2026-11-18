// entities.js — player, cars, traffic, pedestrians, police and combat.
// Pure simulation (no drawing, no DOM) so the game logic can be tested headless.
import { PLAYER, CAR, POLICE, clamp, dist, angleTo, angleDiff, mulberry32 } from './config.js';

export const CAR_MODELS = [
  { name: 'Sunny Coupe', color: '#e8b13c', len: 52, wid: 26 },
  { name: 'Bay Sedan', color: '#4a7fb5', len: 56, wid: 28 },
  { name: 'Palm Pickup', color: '#c96f4a', len: 60, wid: 30 },
  { name: 'Neon Hatch', color: '#7a5aa0', len: 48, wid: 26 },
  { name: 'Coral Van', color: '#4aa08a', len: 62, wid: 30 },
  { name: 'Sunset Taxi', color: '#e8d44d', len: 56, wid: 28 },
];
export const PED_NAMES = ['Marta', 'Leo', 'Sofia', 'Carlos', 'Ana', 'Diego', 'Luna', 'Pedro'];

export function makeCar(x, y, angle, modelIdx, police = false) {
  const m = CAR_MODELS[modelIdx % CAR_MODELS.length];
  return { x, y, angle, speed: 0, model: m, police, driver: police ? 'cop' : null, hp: 100, siren: 0, honk: 0 };
}

export function createGame(city, seed = 11) {
  const rand = mulberry32(seed);
  const state = {
    time: 0, dayTime: 0.35, // 0..1 across a day; starts late morning
    money: 40, health: PLAYER.health, ammo: 24, wanted: 0, wantedHeat: 0,
    score: 0, kills: 0, carsStolen: 0, missionsDone: 0,
    player: { x: 700, y: 700, angle: -Math.PI / 2, speed: 0, onFoot: true, car: null, punchCd: 0, shootCd: 0, hurtCd: 0, running: false },
    cars: [], peds: [], police: [], bullets: [], particles: [], pickups: city.pickups,
    mission: null, missionStep: 0, missionTimer: 0, message: '', messageT: 0, busted: false, wasted: false,
    stats: { distance: 0 },
  };
  // Spawn parked + traffic cars on roads
  for (let i = 0; i < 16; i++) {
    const p = city.randomRoadPoint();
    const horizontal = Math.abs(p.x % 350) < 100;
    state.cars.push(makeCar(p.x, p.y, horizontal ? 0 : Math.PI / 2, i));
  }
  for (let i = 0; i < 14; i++) {
    const p = city.randomRoadPoint();
    state.peds.push({ x: p.x + (rand() - 0.5) * 60, y: p.y + (rand() - 0.5) * 60, angle: rand() * Math.PI * 2, speed: 40 + rand() * 40, name: PED_NAMES[i % PED_NAMES.length], color: `hsl(${Math.floor(rand() * 360)},60%,55%)`, flee: 0, walkT: rand() * 4 });
  }

  function say(text, seconds = 3.5) { state.message = text; state.messageT = seconds; }
  function addWanted(n) { state.wanted = clamp(state.wanted + n, 0, 5); state.wantedHeat = state.wanted > 0 ? 12 : 0; }
  function spawnParticles(x, y, color, n, speed = 120) {
    for (let i = 0; i < n; i++) state.particles.push({ x, y, vx: (rand() - 0.5) * speed * 2, vy: (rand() - 0.5) * speed * 2, life: 0.4 + rand() * 0.4, max: 0.8, color, size: 2 + rand() * 4 });
  }
  function nearestCar(maxD = 70) {
    let best = null, bd = maxD;
    for (const c of state.cars) { const d = dist(state.player.x, state.player.y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  function enterCar() {
    const car = nearestCar();
    if (!car) return false;
    state.player.car = car; state.player.onFoot = false; state.player.speed = 0;
    state.carsStolen += 1;
    if (!car.police) { addWanted(1); say(`You stole a ${car.model.name}! The owner called the cops!`); spawnParticles(car.x, car.y, '#ffd34d', 10); }
    else say(`You got in the ${car.model.name}.`);
    return true;
  }
  function exitCar() {
    const car = state.player.car; if (!car) return;
    const px = car.x + Math.cos(car.angle + Math.PI / 2) * 40, py = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    state.player.x = px; state.player.y = py; state.player.onFoot = true; state.player.car = null; state.player.speed = 0;
    say('You got out.');
  }
  function shoot(targetX, targetY) {
    const p = state.player;
    if (p.shootCd > 0) return;
    if (state.ammo <= 0) { say('Out of ammo! Find green ammo crates.'); p.shootCd = 0.4; return; }
    state.ammo -= 1; p.shootCd = 0.22;
    const a = angleTo(p.x, p.y, targetX, targetY);
    state.bullets.push({ x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.7, fromPolice: false });
    spawnParticles(p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, '#ffe08a', 4, 200);
    addWanted(0); // shooting in public draws heat via hits below
  }
  function punch() {
    const p = state.player;
    if (p.punchCd > 0) return;
    p.punchCd = 0.45;
    const reach = 46;
    const tx = p.x + Math.cos(p.angle) * reach, ty = p.y + Math.sin(p.angle) * reach;
    let hit = false;
    for (const ped of state.peds) if (dist(tx, ty, ped.x, ped.y) < 30) { ped.flee = 3; hit = true; spawnParticles(ped.x, ped.y, '#ff6b6b', 6); }
    for (const car of state.cars) if (dist(tx, ty, car.x, car.y) < 40) { car.hp -= 8; hit = true; spawnParticles(car.x, car.y, '#ffb84d', 6); }
    if (hit) { addWanted(1); say('That was a crime. The cops noticed.'); }
  }

  function updateCarPhysics(car, throttle, steer, dt) {
    if (throttle > 0) car.speed += CAR.accel * dt;
    else if (throttle < 0) car.speed -= (car.speed > 5 ? CAR.brake : CAR.accel * 0.6) * dt;
    else car.speed *= Math.pow(0.4, dt);
    car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
    if (Math.abs(car.speed) > 5) car.angle += steer * CAR.turn * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 200, 0.3, 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt, ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = city.collideCircle(nx, ny, 22);
    if (hit) { if (Math.abs(car.speed) > 180) { spawnParticles(nx, ny, '#ff9d4d', 10); car.hp -= 8; if (car === state.player.car) { state.health -= 4; say('Crash! Watch the buildings.'); } } car.speed *= -0.25; }
    else { car.x = nx; car.y = ny; state.stats.distance += Math.abs(car.speed) * dt; }
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car === state.player.car || car.police) continue;
      // Simple traffic: cruise along its heading, turn at intersections, stop for nothing.
      car.speed = 130 + Math.sin(state.time * 0.3 + car.x) * 30;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt, ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const pitch = 350;
      const nearIntersection = (Math.abs((nx % pitch)) < 60 || Math.abs((ny % pitch)) < 60);
      if (city.collideCircle(nx, ny, 22)) { car.angle += Math.PI / 2; continue; }
      if (nearIntersection && rand() < dt * 0.5) car.angle += (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      car.x = nx; car.y = ny;
      // Bump the player if it runs them over
      if (state.player.onFoot && dist(car.x, car.y, state.player.x, state.player.y) < 30) {
        state.health -= 6 * dt; state.player.hurtCd = 0.5;
        state.player.x += Math.cos(car.angle) * 30; state.player.y += Math.sin(car.angle) * 30;
      }
    }
  }

  function updatePeds(dt) {
    for (const ped of state.peds) {
      ped.walkT -= dt;
      if (ped.flee > 0) { ped.flee -= dt; ped.angle = angleTo(state.player.x, state.player.y, ped.x, ped.y); ped.speed = 180; }
      else {
        ped.speed = 55;
        if (ped.walkT <= 0) { ped.walkT = 2 + rand() * 3; ped.angle += (rand() - 0.5) * 2.4; }
      }
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt, ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (!city.collideCircle(nx, ny, 10)) { ped.x = nx; ped.y = ny; }
      else ped.angle += Math.PI / 2;
    }
  }

  function updatePolice(dt, input) {
    // Wanted decays when hidden (no police nearby and not committing crimes)
    if (state.wanted > 0) {
      state.wantedHeat -= dt;
      const nearest = state.police.reduce((m, c) => Math.min(m, dist(c.x, c.y, state.player.x, state.player.y)), 9999);
      if (state.wantedHeat <= 0 && nearest > 500) { state.wanted = Math.max(0, state.wanted - 1); state.wantedHeat = 10; if (state.wanted === 0) say('You lost the cops. Stay clean.'); }
    }
    const wantCount = state.wanted === 0 ? 0 : state.wanted === 1 ? 1 : state.wanted === 2 ? 2 : 3;
    // Spawn police cars
    state._policeTimer = (state._policeTimer || 0) - dt;
    if (state.police.length < wantCount && state._policeTimer <= 0) {
      state._policeTimer = POLICE.spawnDelay;
      const a = rand() * Math.PI * 2;
      const car = makeCar(state.player.x + Math.cos(a) * 420, state.player.y + Math.sin(a) * 420, a, 1, true);
      car.model = { name: 'PBPD Cruiser', color: '#20242c', len: 56, wid: 28 };
      state.police.push(car); state.cars.push(car);
      say(state.wanted >= 3 ? 'PBPD is on you — lose them!' : 'A PBPD cruiser is chasing you!');
    }
    for (const cop of [...state.police]) {
      cop.siren += dt;
      const target = state.player.car || state.player;
      const d = dist(cop.x, cop.y, target.x, target.y);
      const wantAngle = angleTo(cop.x, cop.y, target.x, target.y);
      cop.angle += clamp(angleDiff(cop.angle, wantAngle), -2.4 * dt, 2.4 * dt);
      cop.speed = clamp(cop.speed + (POLICE.chaseSpeed - cop.speed) * dt, 0, POLICE.chaseSpeed);
      const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt, ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
      if (!city.collideCircle(nx, ny, 22)) { cop.x = nx; cop.y = ny; } else { cop.angle += Math.PI / 3; cop.speed *= 0.5; }
      // Ram / arrest
      if (d < 44) {
        if (state.player.onFoot) {
          state._arrestT = (state._arrestT || 0) + dt;
          if (state._arrestT > 1.6) { state.busted = true; state.money = Math.max(0, state.money - 100); say('BUSTED! The PBPD took $100 bail.'); }
          else if (state._arrestT > 0.4) say('The cop is grabbing you — RUN! (Shift)');
        } else {
          // Cop rams the player's car
          const pc = state.player.car;
          pc.speed *= 0.94; cop.speed *= 0.9;
          if (Math.abs(pc.speed) > 100) spawnParticles(pc.x, pc.y, '#9db4ff', 4);
        }
      } else state._arrestT = 0;
      // Police shoot at 3+ stars (inaccurate: most shots miss a moving player)
      if (state.wanted >= 3 && d < 380 && rand() < dt * 0.4) {
        const a = angleTo(cop.x, cop.y, state.player.x, state.player.y) + (rand() - 0.5) * 0.2;
        state.bullets.push({ x: cop.x, y: cop.y, vx: Math.cos(a) * 800, vy: Math.sin(a) * 800, life: 0.8, fromPolice: true });
      }
      if (d > 900) { // despawn far cops
        state.police = state.police.filter(c => c !== cop);
        state.cars = state.cars.filter(c => c !== cop);
      }
    }
    if (state.wanted === 0 && state.police.length) { state.police = []; state.cars = state.cars.filter(c => !c.police); }
  }

  function updateBullets(dt) {
    for (const b of [...state.bullets]) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || city.collideCircle(b.x, b.y, 4)) { state.bullets = state.bullets.filter(x => x !== b); spawnParticles(b.x, b.y, '#c9c9c9', 3, 80); continue; }
      if (b.fromPolice) {
        if (dist(b.x, b.y, state.player.x, state.player.y) < 16) { state.health -= 7; state.bullets = state.bullets.filter(x => x !== b); spawnParticles(state.player.x, state.player.y, '#ff6b6b', 6); }
      } else {
        for (const ped of state.peds) if (dist(b.x, b.y, ped.x, ped.y) < 16) { ped.flee = 4; state.bullets = state.bullets.filter(x => x !== b); spawnParticles(ped.x, ped.y, '#ff6b6b', 8); addWanted(1); state.kills += 1; break; }
        for (const cop of state.police) if (dist(b.x, b.y, cop.x, cop.y) < 26) { cop.hp -= 30; state.bullets = state.bullets.filter(x => x !== b); spawnParticles(cop.x, cop.y, '#ffb84d', 8); addWanted(1); if (cop.hp <= 0) { state.police = state.police.filter(c => c !== cop); state.cars = state.cars.filter(c => c !== cop); spawnParticles(cop.x, cop.y, '#ff9d4d', 24, 260); say('You wrecked a PBPD cruiser! +2 stars.'); addWanted(1); } break; }
      }
    }
  }

  function updatePickups() {
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      if (dist(state.player.x, state.player.y, pk.x, pk.y) < 30) {
        pk.taken = true;
        if (pk.kind === 'cash') { state.money += 50; say('Picked up $50 cash!'); }
        if (pk.kind === 'health') { state.health = clamp(state.health + 40, 0, 100); say('Health +40!'); }
        if (pk.kind === 'ammo') { state.ammo += 24; say('Ammo +24!'); }
        spawnParticles(pk.x, pk.y, '#7dff8a', 12);
      }
    }
  }

  function step(dt, input) {
    state.time += dt;
    state.dayTime = (state.dayTime + dt / 240) % 1; // full day every 4 minutes
    if (state.messageT > 0) state.messageT -= dt;
    const p = state.player;
    p.punchCd = Math.max(0, p.punchCd - dt); p.shootCd = Math.max(0, p.shootCd - dt); p.hurtCd = Math.max(0, p.hurtCd - dt);
    if (input.enter) { if (p.onFoot) enterCar(); else exitCar(); input.enter = false; }
    if (input.punch) { if (p.onFoot) punch(); input.punch = false; }
    if (input.shoot) { if (p.onFoot) shoot(input.mouseX, input.mouseY); input.shoot = false; }
    // Aim on foot follows the mouse (world coords)
    if (p.onFoot && input.mouseX !== undefined) p.angle = angleTo(p.x, p.y, input.mouseX, input.mouseY);
    if (p.onFoot) {
      const sp = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      let mx = input.moveX, my = input.moveY;
      const len = Math.hypot(mx, my) || 1; mx /= len; my /= len;
      const moving = Math.abs(input.moveX) + Math.abs(input.moveY) > 0.1;
      const nx = p.x + mx * sp * dt * (moving ? 1 : 0), ny = p.y + my * sp * dt * (moving ? 1 : 0);
      if (!city.collideCircle(nx, p.y, 14)) p.x = nx;
      if (!city.collideCircle(p.x, ny, 14)) p.y = ny;
      p.speed = moving ? sp : 0;
      p.running = !!input.run;
    } else if (p.car) {
      updateCarPhysics(p.car, input.throttle, input.steer, dt);
      p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle; p.speed = p.car.speed;
      // In-car shooting: ram damage + honk
      if (input.shoot && p.car) { /* drive-by handled by bullets from car */ }
    }
    updateTraffic(dt); updatePeds(dt); updatePolice(dt, input); updateBullets(dt); updatePickups();
    // Particles
    for (const pt of [...state.particles]) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; if (pt.life <= 0) state.particles = state.particles.filter(x => x !== pt); }
    // Car smoke when damaged
    if (p.car && p.car.hp < 50 && Math.random() < dt * 6) spawnParticles(p.car.x, p.car.y, '#888', 2, 60);
    if (state.health <= 0 && !state.wasted) { state.wasted = true; say('WASTED! You wake up at the clinic, $150 lighter.'); state.money = Math.max(0, state.money - 150); }
    return state;
  }

  function resetAfterBustedOrWasted() {
    state.health = 100; state.wanted = 0; state.wantedHeat = 0; state.busted = false; state.wasted = false;
    state.police = []; state.cars = state.cars.filter(c => !c.police);
    state.player.x = 700; state.player.y = 700; state.player.onFoot = true; state.player.car = null;
  }

  return { state, step, say, addWanted, enterCar, exitCar, shoot, punch, spawnParticles, nearestCar, resetAfterBustedOrWasted };
}
