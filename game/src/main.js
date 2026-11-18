// main.js — boot, loop, screens, save/load, missions wiring and screenshot mode.
// Palmera Bay: an original open-world crime game. Keyboard + mouse, offline, static files only.
//
// ?seed=N fixes the city. ?shot=start|play|chase|foot stages that scene, paints it twice
// and sets window.__shotReady for a screenshot.
import { STEP, SAVE_KEY, STORY } from './config.js';
import { createCity } from './world.js';
import { createGame } from './entities.js';
import { createMissions, missionTitle } from './missions.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_MISSION, ACTION_ENTER, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const city = createCity(seed);
const game = createGame(city, seed + 4);
game.city = city;
const missions = createMissions(game, city);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try { const raw = window.localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeSave() {
  try {
    const s = game.state;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ money: s.money, missionsDone: s.missionsDone, carsStolen: s.carsStolen, kills: s.kills, x: s.player.x, y: s.player.y, health: s.health, ammo: s.ammo, done: missions.state.done }));
  } catch { /* private mode: progress lasts this visit only */ }
}
function applySave(save) {
  if (!save) return;
  const s = game.state;
  s.money = save.money ?? 40; s.missionsDone = save.missionsDone ?? 0; s.carsStolen = save.carsStolen ?? 0;
  s.kills = save.kills ?? 0; s.health = save.health ?? 100; s.ammo = save.ammo ?? 24;
  if (save.x) { s.player.x = save.x; s.player.y = save.y; }
  missions.state.done = save.done ?? [];
}

function runShot(name) {
  const scene = stageShot(name, game, missions);
  game.state.missionObjective = missions.state.objective;
  let painted = 0;
  function paint() {
    renderer.draw(game, missions, scene.screen, readSave());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0, last = performance.now(), saveTimer = 0, sirenTimer = 0;
  if (save) applySave(save);

  function announce(msg) { status.textContent = msg; }
  function startGame(fresh) {
    if (fresh) {
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      const g2 = game.state; g2.money = 40; g2.missionsDone = 0; g2.health = 100; g2.ammo = 24; g2.wanted = 0;
      g2.player.x = 700; g2.player.y = 700; g2.player.onFoot = true; g2.player.car = null;
      missions.state.done = []; missions.state.activeId = 0; missions.state.text = '';
    }
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(STORY.intro + ' Press M for your first job.');
    game.say('Welcome to Palmera Bay! Press M for your first job.', 5);
  }
  // One takeActions() per frame: screen actions use it here, per-step actions
  // (enter/punch) are carried in frameActs and consumed once by the first step.
  let frameActs = 0;
  function handleActions() {
    const actions = frameActs;
    if (input.takeMute()) { const m = audio.toggleMute(); game.say(m ? 'Sound muted (N to unmute).' : 'Sound on.'); }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(true);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; writeSave(); announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
      return;
    }
    if (screen === SCREEN_PAUSED) { if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY; return; }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) { game.resetAfterBustedOrWasted(); screen = SCREEN_PLAY; }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_MISSION) {
      if (missions.state.dialog) missions.advanceDialog();
      else if (!missions.state.activeId) {
        const next = [1, 2, 3, 4].find(id => !missions.state.done.includes(id));
        if (next) missions.start(next); else game.say('All jobs done! Free roam — earn cash from pickups and stay alive.');
      } else game.say('Finish the current job first — follow the yellow marker.');
    }
    if (actions & ACTION_CONFIRM) {
      if (missions.state.dialog) missions.advanceDialog();
    }
  }
  // Continue key (C) on the title screen
  window.addEventListener('keydown', (e) => {
    if (screen === SCREEN_TITLE && e.code === 'KeyC' && readSave()) { startGame(false); }
    if (screen === SCREEN_TITLE && e.code === 'Enter') startGame(true);
  });

  function buildInput() {
    const mouse = input.mouse();
    // Convert mouse screen coords to world coords for aiming
    const zoom = game.state.player.onFoot ? 0.85 : 0.72;
    const wx = game.state.player.x + (mouse.x - window.innerWidth / 2) / zoom;
    const wy = game.state.player.y + (mouse.y - window.innerHeight / 2) / zoom;
    const enter = !!(frameActs & ACTION_ENTER), punch = !!(frameActs & ACTION_PUNCH);
    frameActs &= ~(ACTION_ENTER | ACTION_PUNCH); // one-shot: first step this frame only
    return {
      moveX: input.moveX(), moveY: input.moveY(), run: input.run(),
      throttle: input.throttle(), steer: input.steer(),
      enter, punch,
      shoot: input.takeClick(), mouseX: wx, mouseY: wy, horn: input.horn(),
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    frameActs = input.takeActions();
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const inp = buildInput();
        game.step(STEP, inp);
        game.state.missionObjective = missions.state.objective;
        missions.step(STEP);
        accumulator -= STEP;
        // Sounds on events
        if (game.state.player.car) audio.engine(game.state.player.car.speed, true);
        if (game.state.wanted > 0) { sirenTimer -= STEP; if (sirenTimer <= 0) { sirenTimer = 1.1; audio.sirenTick(true); } }
        if (game.state.busted || game.state.wasted) { screen = SCREEN_OVER; audio.busted(); writeSave(); announce(game.state.busted ? 'Busted!' : 'Wasted!'); }
        if (missions.state.done.length === 4 && screen === SCREEN_PLAY) { screen = SCREEN_WIN; audio.jingle(); writeSave(); }
      }
      saveTimer += 1 / 60;
      if (saveTimer > 10) { saveTimer = 0; writeSave(); }
    } else accumulator = 0;
    renderer.draw(game, missions, screen, save);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; writeSave(); announce('Paused.'); }
  });
  announce('Palmera Bay. Press Space to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
