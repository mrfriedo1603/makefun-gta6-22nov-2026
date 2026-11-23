// missions.js — the story of Solmar Bay. Danny Reyes, a broke wheelman,
// takes jobs from fixer Mara Solis and climbs the crew. Each mission is a
// chain of steps: go to a marker, pick something (or someone) up, deliver
// it, lose the tail. All names, places and dialogue are original.

import { randomRoadPoint } from './city.js';

export const MISSIONS = [
  {
    id: 1, name: 'First Gear', giver: 'Mara Solis',
    brief: 'Mara needs a wheelman. Steal the sports car parked by the marina and bring it to her garage.',
    reward: 400,
    steps: [
      { kind: 'goto', text: 'Steal the sports car at the marina', at: 'marina' },
      { kind: 'drive', text: 'Bring the car to Mara\u2019s garage', at: 'garage' },
    ],
  },
  {
    id: 2, name: 'The Courier', giver: 'Mara Solis',
    brief: 'A package is waiting at the north market. Pick it up and drop it at the docks. The cops are jumpy tonight.',
    reward: 650,
    steps: [
      { kind: 'goto', text: 'Pick up the package at the north market', at: 'market' },
      { kind: 'drive', text: 'Deliver the package to the docks', at: 'docks' },
      { kind: 'escape', text: 'Lose the heat — get your wanted level to 0', at: null },
    ],
  },
  {
    id: 3, name: 'Getaway Driver', giver: 'Tomas "T" Alvarez',
    brief: 'T just hit a card game on Ocean Row. Pick him up and lose the patrol cars before the drop-off.',
    reward: 900,
    steps: [
      { kind: 'goto', text: 'Pick up T on Ocean Row', at: 'ocean' },
      { kind: 'escape', text: 'Lose the patrol cars (wanted to 0)', at: null },
      { kind: 'drive', text: 'Drop T at the safehouse', at: 'safehouse' },
    ],
  },
  {
    id: 4, name: 'Night Shift', giver: 'Mara Solis',
    brief: 'The crew needs a taxi for a midnight run. Grab any taxi, collect three fares across town, and bank the cash.',
    reward: 1200,
    steps: [
      { kind: 'goto', text: 'Steal a taxi', at: 'taxi' },
      { kind: 'collect', text: 'Collect fares: 0 / 3', at: 'fare', count: 3 },
      { kind: 'drive', text: 'Bank the night\u2019s cash at the garage', at: 'garage' },
    ],
  },
  {
    id: 5, name: 'The Big Score', giver: 'Mara Solis',
    brief: 'One last job: lift the armored van on the highway loop, hold off the whole department, and bring it home.',
    reward: 2500,
    steps: [
      { kind: 'goto', text: 'Intercept the armored van', at: 'van' },
      { kind: 'drive', text: 'Drive the van to the warehouse', at: 'warehouse' },
      { kind: 'escape', text: 'Shake the entire department (wanted to 0)', at: null },
    ],
  },
];

// Named places on the map, in world coordinates.
export function missionPlace(city, key, rng) {
  const spots = {
    marina: { x: 3100, y: 300 },
    garage: { x: 560, y: 560 },
    market: { x: 900, y: 220 },
    docks: { x: 2900, y: 2900 },
    ocean: { x: 2600, y: 900 },
    safehouse: { x: 1240, y: 2560 },
    warehouse: { x: 2200, y: 2200 },
  };
  if (spots[key]) return spots[key];
  if (key === 'taxi' || key === 'van' || key === 'fare') return randomRoadPoint(city, rng);
  return { x: 1700, y: 1700 };
}

export function createMissionState() {
  return { index: 0, step: 0, active: false, done: [], collected: 0, target: null, timer: 0, banner: '' };
}

export function startMission(state, city, rng) {
  const m = MISSIONS[state.index];
  if (!m) return null;
  state.active = true;
  state.step = 0;
  state.collected = 0;
  state.timer = 0;
  state.target = missionPlace(city, m.steps[0].at, rng);
  state.banner = m.name + ' — ' + m.brief;
  return m;
}

export function advanceMission(state, city, rng) {
  const m = MISSIONS[state.index];
  state.step++;
  if (state.step >= m.steps.length) {
    state.active = false;
    state.done.push(m.id);
    state.index++;
    return { finished: m };
  }
  const step = m.steps[state.step];
  state.target = step.at ? missionPlace(city, step.at, rng) : null;
  return { step };
}

export function currentStepText(state) {
  const m = MISSIONS[state.index];
  if (!m || !state.active) return '';
  const step = m.steps[state.step];
  if (step.kind === 'collect') return 'Collect fares: ' + state.collected + ' / ' + step.count;
  return step.text;
}
