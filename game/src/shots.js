// shots.js — screenshot scenes behind ?shot=start|play|chase|foot.
// Each stages a real game state (no fake pixels): the cover shows a police chase
// with the HUD, minimap and mission tracker; others show driving and on-foot play.
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

// Drive the player car forward with a little steering for a number of steps.
function driveSteps(game, steps, steer = 0) {
  for (let i = 0; i < steps; i++) {
    game.step(1 / 60, { moveX: 0, moveY: 0, throttle: 1, steer, run: false, enter: false, punch: false, shoot: false, mouseX: game.state.player.x + 200, mouseY: game.state.player.y });
  }
}
function walkSteps(game, steps) {
  for (let i = 0; i < steps; i++) {
    game.step(1 / 60, { moveX: 1, moveY: -0.5, throttle: 0, steer: 0, run: true, enter: false, punch: false, shoot: false, mouseX: game.state.player.x + 200, mouseY: game.state.player.y });
  }
}

export function stageShot(name, game, missions) {
  // Stage on a straight road (centre y=745) so driving shots show speed, not a crash.
  game.state.player.x = 460; game.state.player.y = 745;
  const near = game.state.cars[0];
  if (near) { near.x = 505; near.y = 745; near.angle = 0; near.speed = 0; }
  const hearJob = () => { missions.advanceDialog(); missions.advanceDialog(); missions.advanceDialog(); };
  if (name === 'start') return { screen: SCREEN_TITLE };
  if (name === 'foot') {
    game.state.player.x = 700; game.state.player.y = 700;
    missions.start(1); hearJob();
    walkSteps(game, 60 * 3);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // Steal a car, get wanted, let police chase — the cover shot.
    missions.start(3); hearJob();
    game.enterCar();
    game.addWanted(2);
    driveSteps(game, 60 * 3, 0);
    return { screen: SCREEN_PLAY };
  }
  // Default 'play': driving through downtown with traffic
  missions.start(2); hearJob();
  game.enterCar();
  driveSteps(game, 60 * 4, 0);
  return { screen: SCREEN_PLAY };
}
