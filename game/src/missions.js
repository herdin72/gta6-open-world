// missions.js — the Palmera Bay story: 4 missions with dialogue, objectives, timers and win/fail.
// A mission is a small state machine driven by the game step; the renderer reads mission.text.
import { MISSION_LIST, dist } from './config.js';

const DIALOGUE = {
  1: [
    ['Rosa', 'Danny! My taco truck broke down and the lunch crowd is coming. Steal a car — any car — and bring it to my truck on Ocean Drive.'],
    ['Danny', 'Steal a car? First day back and I am already a criminal. Fine.'],
  ],
  2: [
    ['Rosa', 'You drive good. Now take this cooler of tacos to the marina office before they get cold. 90 seconds. No crashing into everything.'],
    ['Danny', 'Tacos, a timer, and your faith in me. What could go wrong?'],
  ],
  3: [
    ['Tito', 'The PBPD impounded my boat over a parking ticket. I need a distraction: get 2 stars, then lose the cops and meet me at the safehouse. Do not get busted.'],
    ['Danny', 'So the plan is: commit crimes, then hide. I am great at hiding.'],
  ],
  4: [
    ['Tito', 'Last job. The marina office safe holds the impound fees — $1,200. Grab the cash, then get to the safehouse with the cops on you. Make it count, Danny.'],
    ['Danny', 'One score and we are free. Let us go.'],
  ],
};

export function missionTitle(id) { return MISSION_LIST.find(m => m.id === id)?.title ?? 'Free Roam'; }

export function createMissions(game, city) {
  const state = { activeId: 0, step: 0, timer: 0, text: '', objective: null, done: [], failed: false, dialogIdx: 0, dialog: null, cashAt: null };

  function start(id) {
    const def = MISSION_LIST.find(m => m.id === id);
    if (!def) return false;
    state.activeId = id; state.step = 0; state.failed = false; state.dialog = DIALOGUE[id]; state.dialogIdx = 0;
    state.timer = 0; state.cashAt = null;
    state.text = `${def.title} — ${def.giver}: press Enter to hear the job.`;
    state.objective = null;
    game.say(`${def.title}: talk with Enter.`);
    return true;
  }
  function advanceDialog() {
    if (!state.dialog) return false;
    if (state.dialogIdx < state.dialog.length) {
      const [who, line] = state.dialog[state.dialogIdx++];
      state.text = `${who}: "${line}"`;
      game.say(`${who}: ${line}`, 5);
      return true;
    }
    state.dialog = null;
    beginObjective();
    return false;
  }
  function beginObjective() {
    const g = game.state;
    if (state.activeId === 1) {
      state.objective = { x: 1250, y: 430, r: 70, label: 'Bring a car to Rosa’s taco truck' };
      state.text = 'Steal a car (E near a car) and drive it to Rosa’s taco truck — the yellow marker.';
    } else if (state.activeId === 2) {
      state.timer = 90; state.step = 1;
      state.objective = { x: 2150, y: 2150, r: 70, label: 'Deliver tacos to the marina office' };
      state.text = 'Deliver the tacos to the marina office (yellow marker) before the timer runs out!';
    } else if (state.activeId === 3) {
      state.objective = { x: 420, y: 2200, r: 80, label: 'Lose the cops, then reach the safehouse' };
      state.text = 'Get 2 wanted stars (steal a car / punch someone), then lose the cops and reach the safehouse.';
      game.addWanted(0);
    } else if (state.activeId === 4) {
      state.cashAt = { x: 2150, y: 2150 };
      state.objective = { x: 2150, y: 2150, r: 60, label: 'Grab the cash at the marina office' };
      state.text = 'Go to the marina office and grab the cash (walk into the yellow marker).';
    }
  }
  function complete() {
    const def = MISSION_LIST.find(m => m.id === state.activeId);
    game.state.money += def.reward; game.state.missionsDone += 1; game.state.score += def.reward;
    state.done.push(state.activeId);
    game.say(`Mission complete: ${def.title}! +$${def.reward}`, 5);
    game.spawnParticles(game.state.player.x, game.state.player.y, '#7dff8a', 30, 240);
    const next = state.activeId + 1;
    state.activeId = 0; state.objective = null; state.text = next <= 4 ? `Next job available: ${missionTitle(next)}. Press M to start it.` : 'All jobs done! Palmera Bay is yours — free roam, earn cash, stay alive.';
  }
  function fail(reason) {
    state.failed = true; state.activeId = 0; state.objective = null;
    state.text = `Mission failed: ${reason} Press M to retry.`;
    game.say(`Mission failed: ${reason}`, 5);
  }

  function step(dt) {
    const g = game.state;
    if (state.dialog) return; // waiting for Enter through the dialogue
    if (!state.activeId) return;
    if (state.activeId === 2) {
      state.timer -= dt;
      if (state.timer <= 0) { fail('The tacos went cold.'); return; }
      state.text = `Deliver the tacos! ${Math.ceil(state.timer)}s left — marina office, yellow marker.`;
    }
    if (!state.objective) return;
    const d = dist(g.player.x, g.player.y, state.objective.x, state.objective.y);
    if (state.activeId === 1) {
      if (!g.player.onFoot && d < state.objective.r) complete();
      else state.text = g.player.onFoot ? 'Steal a car first! Walk up to a car and press E.' : `Drive to Rosa’s taco truck — ${Math.round(d)}m away.`;
    } else if (state.activeId === 2) {
      if (d < state.objective.r) complete();
    } else if (state.activeId === 3) {
      if (g.wanted < 2 && state.step === 0) state.text = 'Get 2 wanted stars first — steal a car or start trouble.';
      else if (g.wanted >= 2) { state.step = 1; state.text = 'Now LOSE the cops (hide until stars drop), then reach the safehouse.'; }
      if (state.step === 1 && g.wanted === 0 && d < state.objective.r) complete();
      else if (state.step === 1 && g.wanted === 0) state.text = `Cops lost! Get to the safehouse — ${Math.round(d)}m away.`;
      if (g.busted) fail('You got busted.');
    } else if (state.activeId === 4) {
      if (state.step === 0 && d < state.objective.r) {
        state.step = 1; g.money += 0;
        state.objective = { x: 420, y: 2200, r: 80, label: 'Escape to the safehouse' };
        game.addWanted(3);
        state.text = 'Cash grabbed! 3 stars! Escape to the safehouse NOW.';
        game.say('You grabbed the marina cash! 3 stars — RUN!', 5);
      } else if (state.step === 1) {
        if (d < state.objective.r && g.wanted <= 2) complete();
        else if (d < state.objective.r) state.text = 'Too hot! Lose at least one star before entering the safehouse.';
        else state.text = `Escape to the safehouse — ${Math.round(d)}m. Wanted: ${g.wanted} stars.`;
      }
      if (g.busted) fail('You got busted.');
    }
    if (g.wasted) fail('You got wasted.');
  }

  return { state, start, advanceDialog, step, complete, fail };
}
